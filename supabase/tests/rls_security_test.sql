-- BookWorm database security & integrity test.
-- Runs entirely inside a transaction and ROLLS BACK, so it leaves no data behind.
-- Run as the postgres role (Supabase SQL editor, MCP execute_sql, or psql).
-- Any failed expectation raises an exception and aborts the script.

begin;

-- Make sure ASSERT statements are evaluated.
set local plpgsql.check_asserts = on;

-- Fixtures: two auth users. The on_auth_user_created trigger must create profiles.
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('a1111111-1111-4111-8111-111111111111', 'rls-a@bookworm.test', '{"display_name":"Alice Test"}', 'authenticated', 'authenticated'),
  ('b2222222-2222-4222-8222-222222222222', 'rls-b@bookworm.test', '{"display_name":"Bob Test"}', 'authenticated', 'authenticated');

do $$
begin
  assert (select display_name from public.profiles where id = 'a1111111-1111-4111-8111-111111111111') = 'Alice Test',
    'signup trigger did not create profile for user A';
  assert (select count(*) from public.profiles where id = 'b2222222-2222-4222-8222-222222222222') = 1,
    'signup trigger did not create profile for user B';
end $$;

-- ---------------------------------------------------------------- User A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

insert into public.library_items (volume_id) values ('testVolA001');
insert into public.logs (volume_id, body, rating) values ('testVolA001', 'Alice log', 5);
insert into public.logs (volume_id, body) values ('testVolA001', 'Alice log without rating');

do $$
declare n int;
begin
  assert (select reading_status from public.library_items where volume_id = 'testVolA001') = 'want_to_read',
    'new saves must default to want_to_read';

  -- Duplicate save rejected
  begin
    insert into public.library_items (volume_id) values ('testVolA001');
    raise exception 'FAIL: duplicate save was accepted';
  exception when unique_violation then null;
  end;

  -- Log for a book not in the library rejected by composite FK
  begin
    insert into public.logs (volume_id, body) values ('notSaved0001', 'should fail');
    raise exception 'FAIL: log for unsaved book was accepted';
  exception when foreign_key_violation then null;
  end;

  -- Rating range enforced
  begin
    insert into public.logs (volume_id, body, rating) values ('testVolA001', 'bad rating', 6);
    raise exception 'FAIL: rating 6 was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.logs (volume_id, body, rating) values ('testVolA001', 'bad rating', 0);
    raise exception 'FAIL: rating 0 was accepted';
  exception when check_violation then null;
  end;

  -- Empty body rejected
  begin
    insert into public.logs (volume_id, body) values ('testVolA001', '   ');
    raise exception 'FAIL: blank log body was accepted';
  exception when check_violation then null;
  end;

  -- Impersonation: user_id is not an insertable column
  begin
    insert into public.logs (user_id, volume_id, body)
    values ('b2222222-2222-4222-8222-222222222222', 'testVolA001', 'impersonation');
    raise exception 'FAIL: client-supplied log user_id was accepted';
  exception when insufficient_privilege then null;
  end;

  -- Status updates: valid accepted, invalid rejected
  update public.library_items set reading_status = 'reading' where volume_id = 'testVolA001';
  assert (select reading_status from public.library_items where volume_id = 'testVolA001') = 'reading',
    'status update to reading failed';
  begin
    update public.library_items set reading_status = 'abandoned' where volume_id = 'testVolA001';
    raise exception 'FAIL: invalid reading_status was accepted';
  exception when check_violation then null;
  end;

  -- Ownership fields are not updatable
  begin
    update public.library_items set user_id = 'b2222222-2222-4222-8222-222222222222' where volume_id = 'testVolA001';
    raise exception 'FAIL: library user_id was updatable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.logs set user_id = 'b2222222-2222-4222-8222-222222222222';
    raise exception 'FAIL: log user_id was updatable';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.library_items set volume_id = 'otherVol0001' where volume_id = 'testVolA001';
    raise exception 'FAIL: library volume_id was updatable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.logs set volume_id = 'otherVol0001';
    raise exception 'FAIL: log volume_id was updatable';
  exception when insufficient_privilege then null;
  end;

  -- Whitespace padding cannot bypass the body length limit
  begin
    insert into public.logs (volume_id, body) values ('testVolA001', 'x' || repeat(' ', 6000));
    raise exception 'FAIL: oversized padded log body was accepted';
  exception when check_violation then null;
  end;

  -- Client cannot forge ids or timestamps on save
  begin
    insert into public.library_items (volume_id, created_at) values ('testVolA002', '2000-01-01');
    raise exception 'FAIL: client-supplied created_at was accepted';
  exception when insufficient_privilege then null;
  end;

  -- Own log edits work
  update public.logs set body = 'Alice log (edited)', rating = 4 where body = 'Alice log';
  get diagnostics n = row_count;
  assert n = 1, 'owner could not edit own log';
end $$;

-- ---------------------------------------------------------------- User B
select set_config('request.jwt.claims', '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

insert into public.library_items (volume_id) values ('testVolB001');

do $$
declare n int;
begin
  -- B cannot see A's library (only B's own row is visible)
  assert (select count(*) from public.library_items) = 1, 'FAIL: user B sees rows other than their own';
  assert (select count(*) from public.library_items where user_id = 'a1111111-1111-4111-8111-111111111111') = 0,
    'FAIL: user B can read user A''s library';

  -- B can read A's public logs
  assert (select count(*) from public.logs where volume_id = 'testVolA001') = 2, 'FAIL: user B cannot read public logs';

  -- B cannot modify or delete A's logs (RLS filters them out)
  update public.logs set body = 'hijacked' where volume_id = 'testVolA001';
  get diagnostics n = row_count;
  assert n = 0, 'FAIL: user B modified user A''s logs';

  delete from public.logs where volume_id = 'testVolA001';
  get diagnostics n = row_count;
  assert n = 0, 'FAIL: user B deleted user A''s logs';

  -- B cannot change A's library rows
  update public.library_items set reading_status = 'finished' where user_id = 'a1111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  assert n = 0, 'FAIL: user B updated user A''s library';

  -- B cannot insert a library row owned by A
  begin
    insert into public.library_items (user_id, volume_id)
    values ('a1111111-1111-4111-8111-111111111111', 'testVolB002');
    raise exception 'FAIL: user B inserted a library row for user A';
  exception when insufficient_privilege then null;  -- RLS with-check violation
  end;

  -- B cannot log against A's library membership (B has not saved the book)
  begin
    insert into public.logs (volume_id, body) values ('testVolA001', 'piggyback');
    raise exception 'FAIL: user B logged a book only user A saved';
  exception when foreign_key_violation then null;
  end;

  -- B cannot rename A's profile
  update public.profiles set display_name = 'hacked' where id = 'a1111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  assert n = 0, 'FAIL: user B renamed user A';
end $$;

-- ---------------------------------------------------------------- Anonymous
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  assert (select count(*) from public.logs where volume_id = 'testVolA001') = 2, 'FAIL: anon cannot read public logs';
  assert (select display_name from public.profiles where id = 'a1111111-1111-4111-8111-111111111111') = 'Alice Test',
    'FAIL: anon cannot read display names';

  begin
    perform 1 from public.profiles where created_at is not null;
    raise exception 'FAIL: anon can read profile created_at';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles set display_name = 'anon edit';
    raise exception 'FAIL: anon can update profiles';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.logs;
    raise exception 'FAIL: anon can delete logs';
  exception when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.library_items;
    raise exception 'FAIL: anon can query library_items';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.logs (volume_id, body) values ('testVolA001', 'anon write');
    raise exception 'FAIL: anon inserted a log';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------- Cascade
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

delete from public.library_items where volume_id = 'testVolA001';

do $$
begin
  assert (select count(*) from public.library_items where volume_id = 'testVolB001') = 0,
    'FAIL: user A can see user B''s library';
end $$;

do $$
begin
  assert (select count(*) from public.logs where volume_id = 'testVolA001') = 0,
    'FAIL: removing a library item did not cascade to its logs';
end $$;

reset role;
select 'ALL BOOKWORM DATABASE SECURITY TESTS PASSED' as result;

rollback;
