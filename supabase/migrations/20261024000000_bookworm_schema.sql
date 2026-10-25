-- BookWorm schema: profiles, library_items, logs.
-- Authorization is enforced here (constraints, column grants, RLS), never only in React.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: public display names only (no email or other account details)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Raw length is capped (padding cannot bypass it) and at least one visible character is required.
  display_name text not null
    constraint profiles_display_name_valid
    check (char_length(display_name) <= 50 and display_name ~ '[^[:space:]]'),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Public reader identity. Holds only data safe to show next to public logs.';

-- Profile creation is tied to Supabase Auth: every new auth user gets a profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'display_name', ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if requested_name = '' then
    requested_name := 'Reader';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, left(requested_name, 50));

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- library_items: private per-user shelves
-- ---------------------------------------------------------------------------
create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  volume_id text not null
    constraint library_items_volume_id_format
    check (volume_id ~ '^[A-Za-z0-9_-]{4,40}$'),
  reading_status text not null default 'want_to_read'
    constraint library_items_reading_status_valid
    check (reading_status in ('want_to_read', 'reading', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_items_user_volume_unique unique (user_id, volume_id)
);

create index library_items_user_created_idx
  on public.library_items (user_id, created_at desc);

create trigger library_items_set_updated_at
  before update on public.library_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- logs: public reading logs, only for books in the author's own library
-- ---------------------------------------------------------------------------
create table public.logs (
  id uuid primary key default gen_random_uuid(),
  -- Also references profiles so PostgREST can embed the author's display name.
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  volume_id text not null,
  body text not null
    constraint logs_body_valid
    check (char_length(body) <= 5000 and body ~ '[^[:space:]]'),
  rating integer
    constraint logs_rating_range
    check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A log can only exist while the same user has the same book saved.
  -- Removing the library item removes its logs.
  constraint logs_library_item_fk
    foreign key (user_id, volume_id)
    references public.library_items (user_id, volume_id)
    on delete cascade
);

create index logs_volume_created_idx on public.logs (volume_id, created_at desc);
create index logs_user_volume_idx on public.logs (user_id, volume_id);

create trigger logs_set_updated_at
  before update on public.logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges: start from nothing, grant only what the app needs.
-- Column-level UPDATE grants stop ownership fields (id, user_id, volume_id,
-- timestamps) from being changed through the API.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.library_items, public.logs from anon, authenticated;

-- Only the fields needed to show log authors are readable.
grant select (id, display_name) on public.profiles to anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select, delete on public.library_items to authenticated;
grant insert (volume_id, reading_status) on public.library_items to authenticated;
grant update (reading_status) on public.library_items to authenticated;

grant select on public.logs to anon, authenticated;
grant insert (volume_id, body, rating) on public.logs to authenticated;
grant update (body, rating) on public.logs to authenticated;
grant delete on public.logs to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.library_items enable row level security;
alter table public.logs enable row level security;

-- profiles
create policy "Profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- library_items: owner-only for every operation
create policy "Users read their own library"
  on public.library_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add to their own library"
  on public.library_items for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update their own library"
  on public.library_items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users remove from their own library"
  on public.library_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- logs: public read, owner-only writes (library membership enforced by FK)
create policy "Logs are publicly readable"
  on public.logs for select
  to anon, authenticated
  using (true);

create policy "Users write their own logs"
  on public.logs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users edit their own logs"
  on public.logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete their own logs"
  on public.logs for delete
  to authenticated
  using ((select auth.uid()) = user_id);
