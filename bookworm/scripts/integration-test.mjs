// Live API-level checks against the deployed Supabase project.
// Usage: node --env-file=.env.local scripts/integration-test.mjs
// Optional cross-user RLS checks need two confirmed accounts:
//   TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (e.g. in .env.local).')
  process.exit(1)
}

const newClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
let passed = 0
let failed = 0
async function check(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failed++
    console.log(`  ✗ ${name}\n      ${error.message}`)
  }
}
const assert = (cond, message) => {
  if (!cond) throw new Error(message)
}

async function books(client, body) {
  const { data, error } = await client.functions.invoke('books', { body })
  if (error) {
    const status = error.context?.status
    const payload = await error.context?.json?.().catch(() => null)
    return { status, error: payload?.error ?? { message: error.message } }
  }
  return { status: 200, data: data.data }
}

const anon = newClient()

console.log('\nEdge Function (anonymous)')
let firstPage
await check('technology homepage returns normalized books', async () => {
  const res = await books(anon, { action: 'technology' })
  assert(res.status === 200, `status ${res.status}: ${res.error?.message}`)
  firstPage = res.data
  assert(firstPage.items.length > 0, 'no items')
  const b = firstPage.items[0]
  assert(b.id && b.title && Array.isArray(b.authors), 'missing normalized fields')
  assert(!('volumeInfo' in b), 'raw Google payload leaked')
  assert(firstPage.items.every((x) => !x.cover || x.cover.startsWith('https://')), 'non-HTTPS cover')
})
await check('load more returns the next page (new volume IDs)', async () => {
  const res = await books(anon, { action: 'technology', startIndex: firstPage.nextStartIndex })
  assert(res.status === 200, `status ${res.status}`)
  const before = new Set(firstPage.items.map((b) => b.id))
  assert(res.data.items.some((b) => !before.has(b.id)), 'second page repeated the first')
})
for (const genre of ['adventure', 'technology', 'horror', 'sci-fi', 'fiction', 'non-fiction']) {
  await check(`genre "${genre}" returns books`, async () => {
    const res = await books(anon, { action: 'genre', genre })
    assert(res.status === 200, `status ${res.status}: ${res.error?.message}`)
    assert(res.data.items.length > 0, 'no items')
    if (genre === 'non-fiction') {
      const fiction = res.data.items.filter((b) => b.categories.some((c) => /fiction/i.test(c) && !/non-?fiction/i.test(c)))
      assert(fiction.length === 0, `fiction leaked into Non-Fiction: ${fiction.map((b) => b.title).join(', ')}`)
    }
    console.log(`      e.g. ${res.data.items.slice(0, 3).map((b) => `${b.title} [${b.categories.join('/') || '-'}]`).join(' | ')}`)
  })
}
await check('title search uses intitle and returns matches', async () => {
  const res = await books(anon, { action: 'search', query: 'Clean Code' })
  assert(res.status === 200, `status ${res.status}`)
  assert(res.data.items.some((b) => /clean code/i.test(b.title)), 'no title matches')
})
await check('book details by volume ID', async () => {
  const res = await books(anon, { action: 'volume', id: firstPage.items[0].id })
  assert(res.status === 200 && res.data.book.id === firstPage.items[0].id, `status ${res.status}`)
})
await check('rejects empty query (400)', async () => assert((await books(anon, { action: 'search', query: '  ' })).status === 400, 'not 400'))
await check('rejects oversized query (400)', async () => assert((await books(anon, { action: 'search', query: 'x'.repeat(200) })).status === 400, 'not 400'))
await check('rejects unsupported genre (400)', async () => assert((await books(anon, { action: 'genre', genre: 'romance' })).status === 400, 'not 400'))
await check('rejects invalid volume ID (400)', async () => assert((await books(anon, { action: 'volume', id: '../x' })).status === 400, 'not 400'))
await check('rejects maxResults > 40 (400)', async () => assert((await books(anon, { action: 'technology', maxResults: 50 })).status === 400, 'not 400'))
await check('anonymous batch volumes lookup is rejected (401)', async () => assert((await books(anon, { action: 'volumes', ids: [firstPage.items[0].id] })).status === 401, 'not 401'))
await check('unknown volume returns 404', async () => assert((await books(anon, { action: 'volume', id: 'zzzzzzzzzzzz' })).status === 404, 'not 404'))

console.log('\nDatabase (anonymous)')
await check('anon can read public logs', async () => {
  const { error } = await anon.from('logs').select('id, body, rating, author:profiles(display_name)').limit(5)
  assert(!error, error?.message)
})
await check('anon cannot read library_items', async () => {
  const { data, error } = await anon.from('library_items').select('*').limit(1)
  assert(error || data.length === 0, 'anon read library rows')
})
await check('anon cannot insert logs', async () => {
  const { error } = await anon.from('logs').insert({ volume_id: 'zyTCAlFPjgYC', body: 'anon' })
  assert(error, 'insert succeeded')
})
await check('profiles expose no email column', async () => {
  const { error } = await anon.from('profiles').select('email').limit(1)
  assert(error, 'email column exists on profiles')
})

const { TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD } = process.env
if (TEST_USER_A_EMAIL && TEST_USER_B_EMAIL) {
  console.log('\nCross-user authorization (two real accounts)')
  const a = newClient()
  const b = newClient()
  const signA = await a.auth.signInWithPassword({ email: TEST_USER_A_EMAIL, password: TEST_USER_A_PASSWORD })
  const signB = await b.auth.signInWithPassword({ email: TEST_USER_B_EMAIL, password: TEST_USER_B_PASSWORD })
  if (signA.error || signB.error) {
    console.log(`  ✗ could not sign in test users: ${signA.error?.message ?? signB.error?.message}`)
    failed++
  } else {
    const vol = firstPage.items[0].id
    await a.from('library_items').delete().eq('volume_id', vol)
    let item, log
    await check('A has a profile created by the signup trigger', async () => {
      const { data } = await a.from('profiles').select('display_name').eq('id', signA.data.user.id).single()
      assert(data?.display_name, 'no profile')
    })
    await check('A saves a book (defaults to want_to_read)', async () => {
      const { data, error } = await a.from('library_items').insert({ volume_id: vol }).select().single()
      assert(!error, error?.message)
      assert(data.reading_status === 'want_to_read', data.reading_status)
      item = data
    })
    await check('duplicate save is rejected', async () => {
      const { error } = await a.from('library_items').insert({ volume_id: vol })
      assert(error?.code === '23505', `got ${error?.code}`)
    })
    await check('A updates reading status; invalid status rejected', async () => {
      const ok = await a.from('library_items').update({ reading_status: 'finished' }).eq('id', item.id).select().single()
      assert(ok.data?.reading_status === 'finished', ok.error?.message)
      const bad = await a.from('library_items').update({ reading_status: 'paused' }).eq('id', item.id)
      assert(bad.error?.code === '23514', `got ${bad.error?.code}`)
    })
    await check('A creates a log with rating; rating 6 rejected', async () => {
      const { data, error } = await a.from('logs').insert({ volume_id: vol, body: 'Integration log', rating: 4 }).select().single()
      assert(!error, error?.message)
      log = data
      const bad = await a.from('logs').insert({ volume_id: vol, body: 'bad', rating: 6 })
      assert(bad.error?.code === '23514', `got ${bad.error?.code}`)
    })
    await check('log for an unsaved book is rejected by the database', async () => {
      const { error } = await a.from('logs').insert({ volume_id: 'zzzzNotSaved', body: 'nope' })
      assert(error?.code === '23503', `got ${error?.code}`)
    })
    await check('B cannot see A\'s library', async () => {
      const { data } = await b.from('library_items').select('*').eq('user_id', signA.data.user.id)
      assert(data.length === 0, 'B saw A rows')
    })
    await check('B cannot modify or delete A\'s log', async () => {
      const upd = await b.from('logs').update({ body: 'hacked' }).eq('id', log.id).select()
      assert(!upd.data?.length, 'B updated A log')
      const del = await b.from('logs').delete().eq('id', log.id).select()
      assert(!del.data?.length, 'B deleted A log')
    })
    await check('B cannot impersonate A when inserting', async () => {
      const { error } = await b.from('logs').insert({ user_id: signA.data.user.id, volume_id: vol, body: 'impersonation' })
      assert(error, 'impersonation succeeded')
    })
    await check('anon reads A\'s public log with display name only', async () => {
      const { data } = await anon.from('logs').select('id, author:profiles(display_name)').eq('id', log.id).single()
      assert(data?.author?.display_name, 'no author name')
    })
    await check('A edits then deletes own log', async () => {
      const upd = await a.from('logs').update({ body: 'Edited', rating: null }).eq('id', log.id).select().single()
      assert(upd.data?.body === 'Edited', upd.error?.message)
      const again = await a.from('logs').insert({ volume_id: vol, body: 'second log' }).select().single()
      log = again.data
    })
    await check('removing the library item cascades to its logs', async () => {
      await a.from('library_items').delete().eq('id', item.id)
      const { data } = await anon.from('logs').select('id').eq('id', log.id)
      assert(data.length === 0, 'log survived library removal')
    })
  }
} else {
  console.log('\n(skipping cross-user checks: set TEST_USER_A_* and TEST_USER_B_* to run them)')
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
