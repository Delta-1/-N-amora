-- (N)amora: additive installation. Existing applications/tables are not changed.
-- Run in the selected project's SQL Editor after choosing that project.
create schema if not exists namora_private;
revoke all on schema namora_private from public, anon;
grant usage on schema namora_private to authenticated;

create table if not exists public.namora_couples (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 70),
 since date, invite_hash text unique, invite_expires timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.namora_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 couple_id uuid not null references public.namora_couples(id) on delete cascade,
 slot integer not null check(slot in (1,2)), name text not null check(length(name) between 1 and 50),
 mood text not null default '', activity text not null default '', last_seen timestamptz not null default now(),
 unique(couple_id,slot)
);
create table if not exists public.namora_records (
 id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.namora_couples(id) on delete cascade,
 kind text not null check(kind in ('task','event','expense','milestone','idea')),data jsonb not null,
 creator uuid not null references auth.users(id),version integer not null default 1,
 created_at timestamptz not null default now()
);
create index if not exists namora_records_couple_created on public.namora_records(couple_id,created_at desc);
create table if not exists public.namora_locations (
 user_id uuid primary key references public.namora_members(user_id) on delete cascade,
 couple_id uuid not null references public.namora_couples(id) on delete cascade,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 accuracy integer not null check(accuracy between 0 and 100000),updated_at timestamptz not null default now()
);
create index if not exists namora_locations_couple on public.namora_locations(couple_id,updated_at);
create table if not exists namora_private.limits(user_id uuid not null,scope text not null,count integer not null,reset_at timestamptz not null,primary key(user_id,scope));
alter table namora_private.limits enable row level security;
revoke all on namora_private.limits from public,anon,authenticated;

-- Small, authenticated lookup prevents recursive membership policies.
create or replace function namora_private.couple_id() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then return null; end if;
 return (select couple_id from public.namora_members where user_id=auth.uid());
end $$;
revoke all on function namora_private.couple_id() from public,anon;
grant execute on function namora_private.couple_id() to authenticated;
alter table public.namora_couples enable row level security;
alter table public.namora_members enable row level security;
alter table public.namora_records enable row level security;
alter table public.namora_locations enable row level security;
revoke all on public.namora_couples,public.namora_members,public.namora_records,public.namora_locations from public,anon,authenticated;
grant select on public.namora_couples,public.namora_members,public.namora_records,public.namora_locations to authenticated;
drop policy if exists namora_couple_read on public.namora_couples;
create policy namora_couple_read on public.namora_couples for select to authenticated using (id=(select namora_private.couple_id()));
drop policy if exists namora_members_read on public.namora_members;
create policy namora_members_read on public.namora_members for select to authenticated using (couple_id=(select namora_private.couple_id()));
drop policy if exists namora_records_read on public.namora_records;
create policy namora_records_read on public.namora_records for select to authenticated using (couple_id=(select namora_private.couple_id()));
drop policy if exists namora_locations_read on public.namora_locations;
create policy namora_locations_read on public.namora_locations for select to authenticated using (couple_id=(select namora_private.couple_id()) and updated_at>now()-interval '15 minutes');

-- Writes are transactional and validate the acting user's membership.
-- Privileged logic stays in an unexposed schema, never in public.
create or replace function namora_private.perform_action(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); a text:=payload->>'action'; cid uuid; code text; pname text; title text;
 d jsonb; k text; rid uuid; expected integer; rows_changed integer; n integer; used_slot integer; at_time timestamptz; attempts integer;
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Entre na sua conta para continuar.'; end if;
 if payload is null or octet_length(payload::text)>20000 then raise exception 'Conteúdo inválido ou muito grande.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,42));
 select couple_id into cid from public.namora_members where user_id=uid;
 if a in ('create','join') then
  if cid is not null then raise exception 'Você já faz parte de um vínculo.'; end if;
  insert into namora_private.limits as l(user_id,scope,count,reset_at) values(uid,'link',1,now()+interval '1 minute')
  on conflict(user_id,scope) do update set count=case when l.reset_at<now() then 1 else l.count+1 end,reset_at=case when l.reset_at<now() then now()+interval '1 minute' else l.reset_at end returning count into attempts;
  if attempts>8 then return jsonb_build_object('error','Muitas tentativas. Aguarde um minuto.'); end if;
  pname:=btrim(payload->>'name');if pname is null or length(pname) not between 1 and 50 then raise exception 'Informe seu nome.'; end if;
  if a='create' then
   title:=btrim(payload->>'title');if title is null or length(title) not between 1 and 70 then raise exception 'Informe o nome do cantinho.'; end if;
   code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
   insert into public.namora_couples(name,since,invite_hash,invite_expires) values(title,nullif(payload->>'since','')::date,encode(sha256(convert_to(code,'UTF8')),'hex'),now()+interval '24 hours') returning id into cid;
   insert into public.namora_members(user_id,couple_id,slot,name) values(uid,cid,1,pname);
   return jsonb_build_object('ok',true,'code',code);
  else
   code:=upper(regexp_replace(payload->>'code','[\s-]','','g'));
   if code is null or code !~ '^[A-F0-9]{16}$' then return jsonb_build_object('error','O convite tem 16 letras e números.'); end if;
   select id into cid from public.namora_couples where invite_hash=encode(sha256(convert_to(code,'UTF8')),'hex') and invite_expires>now() for update;
   if cid is null then return jsonb_build_object('error','Convite inválido ou expirado. Peça um novo código.'); end if;
   select count(*),min(slot) into n,used_slot from public.namora_members where couple_id=cid;
   if n<>1 then return jsonb_build_object('error','Este vínculo já tem duas pessoas.'); end if;
   insert into public.namora_members(user_id,couple_id,slot,name) values(uid,cid,case when used_slot=1 then 2 else 1 end,pname);
   update public.namora_couples set invite_hash=null,invite_expires=null where id=cid;
   return jsonb_build_object('ok',true);
  end if;
 end if;
 if cid is null then raise exception 'Crie ou entre em um vínculo primeiro.'; end if;
 perform 1 from public.namora_couples where id=cid for update;
 if a='invite' then
  code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
  update public.namora_couples set invite_hash=encode(sha256(convert_to(code,'UTF8')),'hex'),invite_expires=now()+interval '24 hours' where id=cid;
  return jsonb_build_object('ok',true,'code',code);
 elsif a='profile' then
  pname:=btrim(payload->>'name');if pname is null or length(pname) not between 1 and 50 then raise exception 'Informe um nome de até 50 caracteres.'; end if;
  update public.namora_members set name=pname,last_seen=now() where user_id=uid;
 elsif a='mood' then
  if coalesce(payload->>'mood','') not in ('','feliz','apaixonado','tranquilo','cansado','precisando de carinho') then raise exception 'Humor inválido.'; end if;
  update public.namora_members set mood=coalesce(payload->>'mood',''),last_seen=now() where user_id=uid;
 elsif a='activity' then
  if coalesce(payload->>'activity','') not in ('','Em casa','Trabalhando','Estudando','Na faculdade','A caminho','Livre','Ocupado(a)') then raise exception 'Status inválido.'; end if;
  update public.namora_members set activity=coalesce(payload->>'activity',''),last_seen=now() where user_id=uid;
 elsif a='presence' then
  update public.namora_members set last_seen=now() where user_id=uid;
 elsif a='couple' then
  title:=btrim(payload->>'name');if title is null or length(title) not between 1 and 70 then raise exception 'Confira o nome do cantinho.'; end if;
  update public.namora_couples set name=title,since=nullif(payload->>'since','')::date where id=cid;
 elsif a='save' then
  d:=payload->'data';k:=d->>'kind';title:=btrim(d->>'title');
  if d is null or jsonb_typeof(d)<>'object' or k is null or k not in ('task','event','expense','milestone','idea') or title is null or length(title) not between 1 and 140 then raise exception 'Confira o tipo e o título do registro.'; end if;
  if k='task' then
   if coalesce(d->>'category','') not in ('Casa','Compras','Pessoal','Nós dois') or jsonb_typeof(d->'done') is distinct from 'boolean' then raise exception 'Confira a tarefa.'; end if;
   if d->>'assignee' is distinct from 'both' and not exists(select 1 from public.namora_members where couple_id=cid and user_id::text=d->>'assignee') then raise exception 'Responsável inválido.'; end if;
   if d->>'due' is not null then at_time:=(d->>'due')::timestamptz;end if;
  elsif k='expense' then
   if coalesce(d->>'cents','') !~ '^[0-9]+$' or (d->>'cents')::bigint not between 1 and 100000000 or jsonb_typeof(d->'shared') is distinct from 'boolean' or coalesce(d->>'category','') not in ('Casa','Alimentação','Faculdade','Lazer','Transporte','Outros') then raise exception 'Confira o valor e a categoria da despesa.'; end if;
   if not exists(select 1 from public.namora_members where couple_id=cid and user_id::text=d->>'payer') then raise exception 'Quem pagou precisa estar no vínculo.'; end if;
   perform (d->>'date')::date;if d->>'date' is null then raise exception 'Informe a data.';end if;
  elsif k='event' then
   if d->>'date' is null or coalesce(d->>'category','') not in ('Encontro','Faculdade','Aniversário','Outro') or length(coalesce(d->>'note',''))>500 then raise exception 'Confira o evento.'; end if;
   at_time:=(d->>'date')::timestamptz;
  elsif k='milestone' then
   if d->>'date' is null or coalesce(d->>'category','') not in ('Nos conhecemos','Primeiro encontro','Pedido de namoro','Noivado','Casamento','Outro') or jsonb_typeof(d->'annual') is distinct from 'boolean' or jsonb_typeof(d->'remind') is distinct from 'boolean' or length(coalesce(d->>'note',''))>500 then raise exception 'Confira os campos da memória.'; end if;
   perform (d->>'date')::date;
  elsif k='idea' then
   if length(coalesce(d->>'description',''))>1000 or length(coalesce(d->>'category',''))>50 or jsonb_typeof(d->'saved') is distinct from 'boolean' or jsonb_typeof(d->'done') is distinct from 'boolean' then raise exception 'Confira a ideia.'; end if;
  end if;
  if payload->>'id' is not null then
   rid:=(payload->>'id')::uuid;expected:=(payload->>'version')::integer;
   update public.namora_records set data=d,version=version+1 where id=rid and couple_id=cid and version=expected and kind=k;
   get diagnostics rows_changed=row_count;if rows_changed=0 then raise exception 'Este item mudou. Atualize a tela e tente novamente.';end if;
  else
   insert into public.namora_records(couple_id,kind,data,creator) values(cid,k,d,uid);
  end if;
 elsif a='delete' then
  delete from public.namora_records where id=(payload->>'id')::uuid and couple_id=cid and version=(payload->>'version')::integer;
  get diagnostics rows_changed=row_count;if rows_changed=0 then raise exception 'Este item já mudou. Atualize a tela.';end if;
 elsif a='location' then
  if payload->>'enabled'='false' then delete from public.namora_locations where user_id=uid;
  else
   if payload->>'latitude' is null or payload->>'longitude' is null or payload->>'accuracy' is null then raise exception 'Posição inválida.';end if;
   insert into public.namora_locations(user_id,couple_id,latitude,longitude,accuracy) values(uid,cid,(payload->>'latitude')::double precision,(payload->>'longitude')::double precision,round((payload->>'accuracy')::numeric)::integer)
   on conflict(user_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,updated_at=now(),couple_id=excluded.couple_id;
  end if;
 elsif a='leave' then
  delete from public.namora_locations where user_id=uid;
  delete from public.namora_members where user_id=uid;
  update public.namora_couples set invite_hash=null,invite_expires=null where id=cid;
 else raise exception 'Ação não encontrada.';
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function namora_private.perform_action(jsonb) from public,anon;
grant execute on function namora_private.perform_action(jsonb) to authenticated;
create or replace function public.namora_action(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select namora_private.perform_action(payload); $$;
revoke all on function public.namora_action(jsonb) from public,anon;
grant execute on function public.namora_action(jsonb) to authenticated;

-- Enable Realtime for only this application's tables.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['namora_couples','namora_members','namora_records','namora_locations'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
  end loop;
 end if;
end $$;
