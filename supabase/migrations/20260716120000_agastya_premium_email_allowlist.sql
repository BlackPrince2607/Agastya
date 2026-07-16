-- Auto-grant is_premium when a session is linked to an allowlisted founder email.
create or replace function public.agastya_grant_premium_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.supabase_user_id is not null and exists (
    select 1
    from auth.users u
    where u.id = new.supabase_user_id
      and lower(u.email) = any (array['sohambhalotia@gmail.com']::text[])
  ) then
    new.is_premium := true;
  end if;
  return new;
end;
$$;

drop trigger if exists agastya_sessions_premium_allowlist on public.agastya_sessions;
create trigger agastya_sessions_premium_allowlist
  before insert or update of supabase_user_id, is_premium
  on public.agastya_sessions
  for each row
  execute function public.agastya_grant_premium_allowlist();
