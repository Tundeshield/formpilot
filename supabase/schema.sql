-- FormPilot schema. Run once in the Supabase SQL editor.
-- Every table is protected by row-level security: a user can only ever touch their own rows.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes integer,
  status text not null default 'uploaded' check (status in ('uploaded', 'extracted', 'merged', 'failed')),
  extracted jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists documents_user_idx on public.documents (user_id, created_at desc);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('generate', 'regenerate', 'extract')),
  units integer not null default 1,
  host text,
  created_at timestamptz not null default now()
);
create index if not exists usage_user_idx on public.usage_events (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own documents" on public.documents;
create policy "own documents" on public.documents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Usage: users can read and append their own events, but never edit or delete them.
drop policy if exists "read own usage" on public.usage_events;
create policy "read own usage" on public.usage_events for select using (user_id = auth.uid());
drop policy if exists "insert own usage" on public.usage_events;
create policy "insert own usage" on public.usage_events for insert with check (user_id = auth.uid());

-- Create an empty profile row automatically on sign-up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, data)
  values (new.id, jsonb_build_object('contact', jsonb_build_object('email', new.email)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Private storage bucket for uploaded CVs. Files live under {user_id}/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['application/pdf', 'text/plain', 'text/markdown',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

drop policy if exists "own files read" on storage.objects;
create policy "own files read" on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own files write" on storage.objects;
create policy "own files write" on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own files delete" on storage.objects;
create policy "own files delete" on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
