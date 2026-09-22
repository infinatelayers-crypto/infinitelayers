-- Admin login rate limiting (serverless-safe: state lives in the DB).
-- Blocks after 5 failed attempts from the same key within 15 minutes.
-- Run after previous migrations. Safe to run repeatedly.

create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_key text not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists login_attempts_key_idx
  on public.login_attempts (attempt_key, created_at desc);

alter table public.login_attempts enable row level security;
-- No public policies: only SECURITY DEFINER functions below may touch it.
revoke all on public.login_attempts from anon, authenticated;

-- Returns true if the key is currently allowed to attempt a login.
create or replace function public.login_allowed(p_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fails integer;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    return true;
  end if;

  select count(*) into v_fails
  from public.login_attempts
  where attempt_key = p_key
    and succeeded = false
    and created_at > now() - interval '15 minutes';

  return v_fails < 5;
end;
$$;

revoke all on function public.login_allowed(text) from public;
grant execute on function public.login_allowed(text) to anon, authenticated;

-- Records an attempt. On success, clears prior failures for that key.
create or replace function public.record_login_attempt(p_key text, p_succeeded boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key is null or length(trim(p_key)) = 0 then
    return;
  end if;

  insert into public.login_attempts (attempt_key, succeeded)
  values (p_key, coalesce(p_succeeded, false));

  if p_succeeded then
    delete from public.login_attempts
    where attempt_key = p_key and succeeded = false;
  end if;

  -- Opportunistic cleanup of old rows.
  delete from public.login_attempts
  where created_at < now() - interval '1 day';
end;
$$;

revoke all on function public.record_login_attempt(text, boolean) from public;
grant execute on function public.record_login_attempt(text, boolean) to anon, authenticated;
