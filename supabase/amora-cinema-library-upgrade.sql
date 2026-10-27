begin;
-- Additive: existing apps, buckets and couple records are preserved.
alter table public.namora_files add column if not exists taken_at timestamptz;
alter table public.namora_files add column if not exists drive_owner text;
alter table public.namora_files add column if not exists catalogued_at timestamptz;
grant update(taken_at) on public.namora_files to authenticated;
alter table public.namora_files drop constraint if exists namora_files_taken_range;
alter table public.namora_files add constraint namora_files_taken_range check(taken_at is null or taken_at between '1800-01-01'::timestamptz and '2200-01-01'::timestamptz);
drop policy if exists couple_insert on public.namora_files;
create policy couple_insert on public.namora_files for insert to authenticated with check(couple_id=(select namora_private.couple_id()) and creator=(select auth.uid()) and drive_id is null and drive_at is null and drive_owner is null and catalogued_at is null);
create or replace function namora_private.library_metadata_changed() returns trigger language plpgsql security invoker set search_path='' as $begin if new.name is distinct from old.name or new.caption is distinct from old.caption or new.folder is distinct from old.folder or new.taken_at is distinct from old.taken_at then new.catalogued_at:=null;end if;return new;end;$;
revoke all on function namora_private.library_metadata_changed() from public,anon,authenticated;
drop trigger if exists amora_library_metadata on public.namora_files;
create trigger amora_library_metadata before update on public.namora_files for each row execute function namora_private.library_metadata_changed();
create or replace function public.namora_drive_lock(file_id uuid,target uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare affected integer;begin
 update public.namora_files set drive_lock_until=now()+interval '2 minutes' where id=file_id and couple_id=target and (drive_lock_until is null or drive_lock_until<now());
 get diagnostics affected=row_count;return affected=1;
end;$$;
create table if not exists public.namora_cinema_rooms(
 id uuid primary key default gen_random_uuid(),host_couple uuid not null references public.namora_couples(id) on delete cascade,
 host_id uuid not null references auth.users(id) on delete cascade,title text not null check(length(btrim(title)) between 1 and 70),
 mode text not null default 'idle' check(mode in ('idle','screen','video')),media_url text not null default '',
 playing boolean not null default false,position double precision not null default 0 check(position between 0 and 864000),
 updated_at timestamptz not null default now(),epoch uuid not null default gen_random_uuid(),
 expires_at timestamptz not null default now()+interval '10 minutes',closed boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists namora_cinema_host on public.namora_cinema_rooms(host_couple,created_at desc);
create table if not exists public.namora_cinema_invites(
 room_id uuid not null references public.namora_cinema_rooms(id) on delete cascade,
 couple_id uuid not null references public.namora_couples(id) on delete cascade,primary key(room_id,couple_id)
);
create index if not exists namora_cinema_invited on public.namora_cinema_invites(couple_id,room_id);
create table if not exists public.namora_cinema_people(
 room_id uuid not null references public.namora_cinema_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,couple_id uuid not null references public.namora_couples(id) on delete cascade,
 client_id uuid not null,last_seen timestamptz not null default now(),primary key(room_id,user_id)
);
create index if not exists namora_cinema_people_user on public.namora_cinema_people(user_id);
create index if not exists namora_cinema_people_couple on public.namora_cinema_people(couple_id);
create table if not exists public.namora_cinema_signals(
 id bigint generated always as identity primary key,room_id uuid not null references public.namora_cinema_rooms(id) on delete cascade,
 sender uuid not null,recipient uuid not null,sender_client uuid not null,recipient_client uuid not null,
 epoch uuid not null,payload jsonb not null check(octet_length(payload::text)<=50000),created_at timestamptz not null default now()
);
create index if not exists namora_cinema_signals_inbox on public.namora_cinema_signals(room_id,recipient,id);
create table if not exists public.namora_cinema_messages(
 id bigint generated always as identity primary key,room_id uuid not null references public.namora_cinema_rooms(id) on delete cascade,
 sender uuid not null,body text not null check(length(btrim(body)) between 1 and 1000),created_at timestamptz not null default now()
);
create index if not exists namora_cinema_messages_room on public.namora_cinema_messages(room_id,id desc);
-- RPC only: no direct Data API access to room membership or SDP.
alter table public.namora_cinema_rooms enable row level security;
alter table public.namora_cinema_invites enable row level security;
alter table public.namora_cinema_people enable row level security;
alter table public.namora_cinema_signals enable row level security;
alter table public.namora_cinema_messages enable row level security;
revoke all on public.namora_cinema_rooms,public.namora_cinema_invites,public.namora_cinema_people,public.namora_cinema_signals,public.namora_cinema_messages from public,anon,authenticated;
grant all on public.namora_cinema_rooms,public.namora_cinema_invites,public.namora_cinema_people,public.namora_cinema_signals,public.namora_cinema_messages to service_role;
create or replace function namora_private.cinema_action(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();cid uuid;act text:=coalesce(payload->>'action','list');
 r public.namora_cinema_rooms;p public.namora_cinema_people;q public.namora_cinema_people;
 rid uuid;client uuid;target uuid;body text;vurl text;
begin
 if uid is null then raise exception 'Entre na sua conta.';end if;
 cid:=namora_private.couple_id();if cid is null then raise exception 'Entre em um vínculo primeiro.';end if;
 if act='list' then
 return coalesce((select jsonb_agg(to_jsonb(x)) from(
 select s.id,s.title,s.host_id,s.host_couple,s.mode,s.created_at,s.expires_at,
 coalesce(pr.display_name,co.name) host_name
 from public.namora_cinema_rooms s join public.namora_couples co on co.id=s.host_couple
 left join public.namora_social_profiles pr on pr.couple_id=s.host_couple
 where not s.closed and s.expires_at>now() and(s.host_couple=cid or(
 namora_private.social_friend(cid,s.host_couple) and exists(select 1 from public.namora_cinema_invites i where i.room_id=s.id and i.couple_id=cid)))
 order by s.created_at desc limit 30)x),'[]'::jsonb);
 end if;
 client:=(payload->>'client')::uuid;if client is null then raise exception 'Abra a sala novamente.';end if;
 if act='create' then
 perform pg_advisory_xact_lock(hashtext(uid::text),5291);
 if (select count(*) from public.namora_cinema_rooms where host_couple=cid and not closed and expires_at>now())>=3 then raise exception 'Encerre uma sala antes de abrir outra.';end if;
 insert into public.namora_cinema_rooms(host_couple,host_id,title) values(cid,uid,left(coalesce(nullif(btrim(payload->>'title'),''),'Nosso cinema'),70)) returning * into r;
 insert into public.namora_cinema_people(room_id,user_id,couple_id,client_id)values(r.id,uid,cid,client);
 return to_jsonb(r);
 end if;
 rid:=(payload->>'id')::uuid;
 select * into r from public.namora_cinema_rooms where id=rid for update;
 if r.id is null or r.closed or r.expires_at<=now() then raise exception 'Esta sala foi encerrada.';end if;
 if cid<>r.host_couple and(not namora_private.social_friend(cid,r.host_couple) or not exists(select 1 from public.namora_cinema_invites where room_id=rid and couple_id=cid)) then raise exception 'Somente o vínculo anfitrião e casais amigos convidados podem entrar.';end if;
 if act='join' then
 if (select count(*) from public.namora_cinema_people where room_id=rid and user_id<>uid and last_seen>now()-interval '2 minutes')>=8 then raise exception 'Esta sala chegou ao limite de 8 pessoas.';end if;
 insert into public.namora_cinema_people(room_id,user_id,couple_id,client_id) values(rid,uid,cid,client)
 on conflict(room_id,user_id) do update set client_id=excluded.client_id,couple_id=excluded.couple_id,last_seen=now();
 return to_jsonb(r);
 end if;
 select * into p from public.namora_cinema_people where room_id=rid and user_id=uid and couple_id=cid and client_id=client;
 if p.user_id is null then raise exception 'Entre nesta sala para continuar. Outra aba pode ter assumido sua sessão.';end if;
 if act='leave' then
 delete from public.namora_cinema_people where room_id=rid and user_id=uid;
 delete from public.namora_cinema_signals where room_id=rid and (sender=uid or recipient=uid);
 if uid=r.host_id then update public.namora_cinema_rooms set closed=true,playing=false,media_url='' where id=rid;delete from public.namora_cinema_people where room_id=rid;delete from public.namora_cinema_signals where room_id=rid;end if;
 return '{"ok":true}'::jsonb;
 end if;
 update public.namora_cinema_people set last_seen=now() where room_id=rid and user_id=uid;
 if uid=r.host_id then update public.namora_cinema_rooms set expires_at=now()+interval '10 minutes' where id=rid;end if;
 if act in ('invite','revoke') then
 if cid<>r.host_couple then raise exception 'Somente o casal anfitrião pode convidar.';end if;
 target:=(payload->>'couple')::uuid;
 if target is null or target=cid then raise exception 'Escolha um casal amigo.';end if;
 if act='invite' then
 if not namora_private.social_friend(cid,target) then raise exception 'Aceitem a amizade antes de convidar.';end if;
 if(select count(*) from public.namora_cinema_invites where room_id=rid)>=3 and not exists(select 1 from public.namora_cinema_invites where room_id=rid and couple_id=target) then raise exception 'Convide até 3 casais amigos por sala.';end if;
 insert into public.namora_cinema_invites values(rid,target) on conflict do nothing;
 else
 delete from public.namora_cinema_invites where room_id=rid and couple_id=target;
 delete from public.namora_cinema_signals where room_id=rid and(sender in(select user_id from public.namora_cinema_people where room_id=rid and couple_id=target) or recipient in(select user_id from public.namora_cinema_people where room_id=rid and couple_id=target));
 delete from public.namora_cinema_people where room_id=rid and couple_id=target;
 end if;return '{"ok":true}'::jsonb;
 end if;
 if act='media' then
 if uid<>r.host_id then raise exception 'Somente quem criou a sala controla a sessão.';end if;
 if payload->>'mode' not in('idle','screen','video') then raise exception 'Modo inválido.';end if;
 vurl:=coalesce(payload->>'url','');
 if payload->>'mode'='video' and (length(vurl)>2000 or vurl!~* '^https://[^[:space:]]+\.(mp4|webm)(\?[^[:space:]]*)?$') then raise exception 'Use um link HTTPS direto de vídeo MP4 ou WebM.';end if;
 update public.namora_cinema_rooms set mode=payload->>'mode',media_url=case when payload->>'mode'='video' then vurl else '' end,playing=false,position=0,updated_at=now(),epoch=gen_random_uuid() where id=rid returning * into r;
 delete from public.namora_cinema_signals where room_id=rid;
 return to_jsonb(r);
 end if;
 if act='playback' then
 if uid<>r.host_id or r.mode<>'video' or r.epoch<>(payload->>'epoch')::uuid then raise exception 'A reprodução mudou. Atualize a sala.';end if;
 update public.namora_cinema_rooms set playing=coalesce((payload->>'playing')::boolean,false),position=greatest(0,least(864000,(payload->>'position')::double precision)),updated_at=now() where id=rid;
 return '{"ok":true}'::jsonb;
 end if;
 if act='signal' then
 if r.mode<>'screen' or r.epoch<>(payload->>'epoch')::uuid then raise exception 'Esta transmissão terminou.';end if;
 target:=(payload->>'target')::uuid;
 select x.* into q from public.namora_cinema_people x join public.namora_members m on m.user_id=x.user_id and m.couple_id=x.couple_id
 where x.room_id=rid and x.user_id=target and x.last_seen>now()-interval '2 minutes' and (x.couple_id=r.host_couple or (namora_private.social_friend(x.couple_id,r.host_couple) and exists(select 1 from public.namora_cinema_invites where room_id=rid and couple_id=x.couple_id)));
 if q.user_id is null or target=uid or (uid<>r.host_id and target<>r.host_id) then raise exception 'Destino da transmissão inválido.';end if;
 if (coalesce(payload->'signal'->>'type','') not in('offer','answer','ice')) or payload->'signal' is null or octet_length((payload->'signal')::text)>50000 then raise exception 'Sinal inválido.';end if;
 if (payload->'signal'->>'type'='offer' and uid<>r.host_id) or(payload->'signal'->>'type'='answer' and target<>r.host_id) then raise exception 'Sinal inválido.';end if;
 if(select count(*) from public.namora_cinema_signals where room_id=rid and sender=uid and created_at>now()-interval '1 minute')>400 then raise exception 'Aguarde para conectar novamente.';end if;
 insert into public.namora_cinema_signals(room_id,sender,recipient,sender_client,recipient_client,epoch,payload)values(rid,uid,target,client,q.client_id,r.epoch,payload->'signal');
 return '{"ok":true}'::jsonb;
 end if;
 if act='message' then
 body:=btrim(payload->>'body');if coalesce(length(body),0) not between 1 and 1000 then raise exception 'Escreva até 1.000 caracteres.';end if;
 if(select count(*) from public.namora_cinema_messages where room_id=rid and sender=uid and created_at>now()-interval '1 minute')>=30 then raise exception 'Aguarde um instante para enviar mais mensagens.';end if;
 insert into public.namora_cinema_messages(room_id,sender,body)values(rid,uid,body);return '{"ok":true}'::jsonb;
 end if;
 if act<>'poll' then raise exception 'Ação inválida.';end if;
 delete from public.namora_cinema_signals where room_id=rid and created_at<now()-interval '3 minutes';
 return jsonb_build_object('room',to_jsonb(r),'clock',now(),
 'people',coalesce((select jsonb_agg(jsonb_build_object('user_id',x.user_id,'client_id',x.client_id,'couple_id',x.couple_id,'name',m.name)) from public.namora_cinema_people x join public.namora_members m on m.user_id=x.user_id and m.couple_id=x.couple_id where x.room_id=rid and x.last_seen>now()-interval '2 minutes' and(x.couple_id=r.host_couple or (namora_private.social_friend(x.couple_id,r.host_couple) and exists(select 1 from public.namora_cinema_invites where room_id=rid and couple_id=x.couple_id)))),'[]'::jsonb),
 'invited',coalesce((select jsonb_agg(couple_id) from public.namora_cinema_invites where room_id=rid),'[]'::jsonb),
 'signals',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.namora_cinema_signals s where s.room_id=rid and s.recipient=uid and s.recipient_client=client and s.epoch=r.epoch and s.id>coalesce((payload->>'after')::bigint,0)),'[]'::jsonb),
 'messages',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from(select z.id,z.body,z.sender,z.created_at,coalesce(m.name,'Participante') name from public.namora_cinema_messages z left join public.namora_members m on m.user_id=z.sender where z.room_id=rid order by z.id desc limit 60)x),'[]'::jsonb));
end;$$;
revoke all on function namora_private.cinema_action(jsonb) from public,anon;
grant execute on function namora_private.cinema_action(jsonb) to authenticated;
create or replace function public.namora_cinema(payload jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select namora_private.cinema_action(payload)$$;
revoke all on function public.namora_cinema(jsonb) from public,anon;
grant execute on function public.namora_cinema(jsonb) to authenticated;
commit;
