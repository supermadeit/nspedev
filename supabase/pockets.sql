-- Pockets: saved query results (command + snapshot payload), optionally shared
-- by link. Run once in the Supabase SQL editor (or fold into nspe-v2's
-- api/schema.sql alongside user_profiles / credit_ledger).
--
-- Model: the owner has full CRUD via RLS. Sharing does NOT open the table to
-- anonymous reads (that would let anyone enumerate every shared pocket with
-- the public anon key) — instead a security-definer function returns ONE row
-- by its unguessable uuid, and only if the owner flipped is_public on.

create table if not exists public.pockets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  command     text not null,
  title       text,
  payload     jsonb not null,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint pockets_command_len  check (char_length(command) <= 300),
  -- Guardrail against someone stuffing the table; the client also refuses
  -- oversized snapshots before sending.
  constraint pockets_payload_size check (pg_column_size(payload) <= 400000)
);

create index if not exists pockets_user_created_idx
  on public.pockets (user_id, created_at desc);

alter table public.pockets enable row level security;

drop policy if exists "own pockets" on public.pockets;
create policy "own pockets" on public.pockets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Per-user cap. Enforced here (not just in the UI) since a client-side check
-- is trivially bypassable. Raise the number to raise the cap.
create or replace function public.enforce_pocket_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.pockets where user_id = new.user_id) >= 10 then
    raise exception 'pocket_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pocket_limit on public.pockets;
create trigger trg_pocket_limit
  before insert on public.pockets
  for each row execute function public.enforce_pocket_limit();

-- Public read of a single shared pocket, by id.
create or replace function public.get_public_pocket(p_id uuid)
returns setof public.pockets
language sql
security definer
set search_path = public
stable
as $$
  select * from public.pockets where id = p_id and is_public = true;
$$;

grant execute on function public.get_public_pocket(uuid) to anon, authenticated;
