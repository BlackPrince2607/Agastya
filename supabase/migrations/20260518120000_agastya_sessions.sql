-- Agastya session persistence: anonymous onboarding → Supabase Auth merge.
-- Apply via Supabase SQL editor or `supabase db push` after linking the project.

-- ---------------------------------------------------------------------------
-- Sessions (backend writes via service role; users read own row after merge)
-- ---------------------------------------------------------------------------
create table if not exists public.agastya_sessions (
  session_id text primary key,
  device_install_id text,
  supabase_user_id uuid references auth.users (id) on delete set null,
  display_name text,
  gender text,
  focus_topics jsonb not null default '[]'::jsonb,
  palm_storage_path text,
  palm_analysis jsonb,
  preview_report jsonb,
  full_report jsonb,
  chat_tail jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agastya_sessions_supabase_user_id_idx
  on public.agastya_sessions (supabase_user_id)
  where supabase_user_id is not null;

create or replace function public.set_agastya_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agastya_sessions_updated_at on public.agastya_sessions;
create trigger agastya_sessions_updated_at
  before update on public.agastya_sessions
  for each row execute function public.set_agastya_sessions_updated_at();

alter table public.agastya_sessions enable row level security;

-- Authenticated users may read/update rows bound to their account.
drop policy if exists agastya_sessions_select_own on public.agastya_sessions;
create policy agastya_sessions_select_own
  on public.agastya_sessions
  for select
  to authenticated
  using (supabase_user_id = auth.uid());

drop policy if exists agastya_sessions_update_own on public.agastya_sessions;
create policy agastya_sessions_update_own
  on public.agastya_sessions
  for update
  to authenticated
  using (supabase_user_id = auth.uid())
  with check (supabase_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Palm captures bucket (private; FastAPI uploads with service role)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'palms',
  'palms',
  false,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png']::text[]
)
on conflict (id) do nothing;

drop policy if exists palms_service_insert on storage.objects;
create policy palms_service_insert
  on storage.objects
  for insert
  to service_role
  with check (bucket_id = 'palms');

drop policy if exists palms_service_select on storage.objects;
create policy palms_service_select
  on storage.objects
  for select
  to service_role
  using (bucket_id = 'palms');

drop policy if exists palms_service_update on storage.objects;
create policy palms_service_update
  on storage.objects
  for update
  to service_role
  using (bucket_id = 'palms')
  with check (bucket_id = 'palms');

-- Optional: owner reads own captures after login (path prefix = session_id).
drop policy if exists palms_owner_select on storage.objects;
create policy palms_owner_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'palms'
    and exists (
      select 1
      from public.agastya_sessions s
      where s.supabase_user_id = auth.uid()
        and (storage.foldername(name))[1] = s.session_id
    )
  );
