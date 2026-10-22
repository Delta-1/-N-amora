begin;
create table if not exists public.namora_files(
 id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.namora_couples(id) on delete cascade,
 creator uuid not null default auth.uid() references auth.users(id),name text not null check(length(name) between 1 and 140),
 path text not null unique check(length(path)<512),mime text not null check(length(mime) between 1 and 150),
 bytes bigint not null check(bytes between 1 and 20971520),folder text not null default 'Documentos' check(length(folder) between 1 and 60),
 kind text not null default 'file' check(kind in ('photo','file')),caption text not null default '' check(length(caption)<=140),
 frame text not null default 'none',drive_id text,drive_at timestamptz,created_at timestamptz not null default now(),
 check(path like couple_id::text||'/'||id::text||'/%')
);
create index if not exists namora_files_couple_created on public.namora_files(couple_id,created_at desc);
create table if not exists public.namora_folders(couple_id uuid not null references public.namora_couples(id) on delete cascade,name text not null check(length(name) between 1 and 60),created_at timestamptz not null default now(),primary key(couple_id,name));
alter table public.namora_files enable row level security;
alter table public.namora_folders enable row level security;
revoke all on public.namora_files,public.namora_folders from public,anon,authenticated;
grant select,insert,delete on public.namora_files to authenticated;
grant update(name,folder,caption) on public.namora_files to authenticated;
grant select,insert,delete on public.namora_folders to authenticated;
grant all on public.namora_files,public.namora_folders to service_role;
drop policy if exists couple_read on public.namora_files;
create policy couple_read on public.namora_files for select to authenticated using(couple_id=(select namora_private.couple_id()));
drop policy if exists couple_insert on public.namora_files;
create policy couple_insert on public.namora_files for insert to authenticated with check(couple_id=(select namora_private.couple_id()) and creator=(select auth.uid()) and drive_id is null and drive_at is null);
drop policy if exists couple_update on public.namora_files;
create policy couple_update on public.namora_files for update to authenticated using(couple_id=(select namora_private.couple_id())) with check(couple_id=(select namora_private.couple_id()));
drop policy if exists couple_delete on public.namora_files;
create policy couple_delete on public.namora_files for delete to authenticated using(couple_id=(select namora_private.couple_id()));
drop policy if exists couple_read on public.namora_folders;
create policy couple_read on public.namora_folders for select to authenticated using(couple_id=(select namora_private.couple_id()));
drop policy if exists couple_insert on public.namora_folders;
create policy couple_insert on public.namora_folders for insert to authenticated with check(couple_id=(select namora_private.couple_id()));
drop policy if exists couple_delete on public.namora_folders;
create policy couple_delete on public.namora_folders for delete to authenticated using(couple_id=(select namora_private.couple_id()));
create table if not exists public.namora_integrations(couple_id uuid not null references public.namora_couples(id) on delete cascade,provider text not null check(provider in ('voice','drive')),ciphertext text not null,updated_at timestamptz not null default now(),primary key(couple_id,provider));
alter table public.namora_integrations enable row level security;
revoke all on public.namora_integrations from public,anon,authenticated;
grant all on public.namora_integrations to service_role;
create table if not exists namora_private.drive_oauth(state_hash text primary key,couple_id uuid not null references public.namora_couples(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,verifier text not null,expires_at timestamptz not null);
alter table namora_private.drive_oauth enable row level security;
revoke all on namora_private.drive_oauth from public,anon,authenticated;
grant usage on schema namora_private to service_role;
grant all on namora_private.drive_oauth to service_role;
-- OAuth state lives outside the exposed schema; tightly scoped RPCs are service-only.
create or replace function public.namora_oauth_state(payload jsonb,consume boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare r namora_private.drive_oauth; begin
 if consume then
  delete from namora_private.drive_oauth where state_hash=payload->>'hash' and user_id=(payload->>'user')::uuid and couple_id=(payload->>'couple')::uuid and expires_at>now() returning * into r;
  if r.state_hash is null then return null;end if;return jsonb_build_object('verifier',r.verifier);
 else
  delete from namora_private.drive_oauth where expires_at<now() or (user_id=(payload->>'user')::uuid and couple_id=(payload->>'couple')::uuid);
  insert into namora_private.drive_oauth values(payload->>'hash',(payload->>'couple')::uuid,(payload->>'user')::uuid,payload->>'verifier',now()+interval '10 minutes');return '{"ok":true}'::jsonb;
 end if;
end; $$;
revoke all on function public.namora_oauth_state(jsonb,boolean) from public,anon,authenticated;
grant execute on function public.namora_oauth_state(jsonb,boolean) to service_role;
alter table public.namora_files add column if not exists drive_lock_until timestamptz;
create or replace function public.namora_drive_lock(file_id uuid,target uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare affected integer;begin
 update public.namora_files set drive_lock_until=now()+interval '2 minutes' where id=file_id and couple_id=target and drive_id is null and (drive_lock_until is null or drive_lock_until<now());
 get diagnostics affected=row_count;return affected=1;
end;$$;
revoke all on function public.namora_drive_lock(uuid,uuid) from public,anon,authenticated;
grant execute on function public.namora_drive_lock(uuid,uuid) to service_role;
-- A dedicated private bucket never changes the access rules of Workspaces buckets.
insert into storage.buckets(id,name,public,file_size_limit) values('amora-private','amora-private',false,20971520)
on conflict(id) do update set public=false,file_size_limit=20971520;
drop policy if exists amora_files_read on storage.objects;
create policy amora_files_read on storage.objects for select to authenticated using(bucket_id='amora-private' and exists(select 1 from public.namora_files f where f.path=storage.objects.name and f.couple_id=(select namora_private.couple_id())));
drop policy if exists amora_files_upload on storage.objects;
create policy amora_files_upload on storage.objects for insert to authenticated with check(bucket_id='amora-private' and exists(select 1 from public.namora_files f where f.path=storage.objects.name and f.creator=(select auth.uid()) and f.couple_id=(select namora_private.couple_id())));
drop policy if exists amora_files_remove on storage.objects;
create policy amora_files_remove on storage.objects for delete to authenticated using(bucket_id='amora-private' and exists(select 1 from public.namora_files f where f.path=storage.objects.name and f.couple_id=(select namora_private.couple_id())));
-- Restrictive guards isolate this bucket even if another app has broad permissive policies.
-- For every other bucket these predicates are true, preserving its existing behavior.
drop policy if exists amora_bucket_guard on storage.objects;
create policy amora_bucket_guard on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'amora-private' or exists(select 1 from public.namora_files f where f.path=storage.objects.name and f.couple_id=(select namora_private.couple_id())))
 with check(bucket_id<>'amora-private' or exists(select 1 from public.namora_files f where f.path=storage.objects.name and f.creator=(select auth.uid()) and f.couple_id=(select namora_private.couple_id())));
drop policy if exists amora_bucket_anonymous_guard on storage.objects;
create policy amora_bucket_anonymous_guard on storage.objects as restrictive for all to anon using(bucket_id<>'amora-private') with check(bucket_id<>'amora-private');
drop policy if exists amora_bucket_no_overwrite on storage.objects;
create policy amora_bucket_no_overwrite on storage.objects as restrictive for update to authenticated using(bucket_id<>'amora-private') with check(bucket_id<>'amora-private');
commit;

