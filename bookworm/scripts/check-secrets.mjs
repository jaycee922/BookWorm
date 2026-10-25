// Fails if secrets or direct Google Books calls appear in the built bundle or
// in files tracked by git. Run after `npm run build`.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const dist = resolve(import.meta.dirname, '../dist')

const SECRET_PATTERNS = [
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
  [/sb_secret_[0-9A-Za-z_-]{10,}/, 'Supabase secret key'],
  [/sbp_[0-9a-f]{40}/, 'Supabase personal access token'],
  [/"role"\s*:\s*"service_role"/, 'decoded service_role JWT'],
  [/GOOGLE_BOOKS_API_KEY\s*=\s*(?!your-)[^\s'"]{8,}/, 'assigned Google Books key'],
]

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function decodedJwtRoles(text) {
  const roles = []
  for (const token of text.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []) {
    try {
      roles.push(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role)
    } catch {
      // not a JWT
    }
  }
  return roles
}

const problems = []
function scan(file, text, { bundle }) {
  for (const [pattern, label] of SECRET_PATTERNS) {
    if (pattern.test(text)) problems.push(`${label} in ${relative(root, file)}`)
  }
  if (decodedJwtRoles(text).includes('service_role')) problems.push(`service_role JWT in ${relative(root, file)}`)
  if (bundle && /googleapis\.com\/books/.test(text)) {
    problems.push(`direct Google Books URL in frontend bundle ${relative(root, file)}`)
  }
}

if (!existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` first.')
  process.exit(1)
}
const bundleFiles = walk(dist)
bundleFiles.forEach((f) => scan(f, readFileSync(f, 'utf8'), { bundle: true }))

let tracked = []
try {
  tracked = execSync('git ls-files -co --exclude-standard', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
} catch {
  console.warn('git not available; skipping repository scan')
}
for (const file of tracked) {
  const path = join(root, file)
  if (!existsSync(path) || statSync(path).size > 2_000_000 || file.endsWith('check-secrets.mjs')) continue
  scan(path, readFileSync(path, 'utf8'), { bundle: false })
}

if (problems.length) {
  console.error('Secret scan FAILED:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log(`Secret scan passed: ${bundleFiles.length} bundle files and ${tracked.length} repository files checked.`)
