begin;
-- All private to the current vínculo; device consent belongs exclusively to its user.
create table if not exists public.namora_personal_status(
 user_id uuid primary key references public.namora_members(user_id) on delete cascade,
 couple_id uuid not null references public.namora_couples(id) on delete cascade,
 nickname text not null default '' check(length(nickname)<=50),bio text not null default '' check(length(bio)<=280),
 emoji text not null default '💜' check(length(emoji)<=12),mood text not null default 'tranquilo' check(length(mood)<=40),
 mood_level integer not null default 3 check(mood_level between 1 and 5),note text not null default '' check(length(note)<=140),
 share_device boolean not null default false,share_apps boolean not null default false,
 snapshot jsonb not null default '{}',updated_at timestamptz not null default now(),device_at timestamptz
);
create index if not exists namora_status_couple on public.namora_personal_status(couple_id);
create table if not exists public.namora_music_queue(
 id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.namora_couples(id) on delete cascade,
 creator uuid not null references auth.users(id) on delete cascade,title text not null check(length(title) between 1 and 200),
 url text not null check(length(url)<=2000),provider text not null check(provider in ('youtube','audio')),
 created_at timestamptz not null default now()
);
create index if not exists namora_queue_couple on public.namora_music_queue(couple_id,created_at,id);
create table if not exists public.namora_music_session(
 couple_id uuid primary key references public.namora_couples(id) on delete cascade,
 track_id uuid references public.namora_music_queue(id) on delete set null,playing boolean not null default false,
 position double precision not null default 0 check(position between 0 and 86400),
 revision integer not null default 0,updated_at timestamptz not null default now(),controller uuid references auth.users(id) on delete set null
);
create table if not exists public.namora_music_app(id boolean primary key default true check(id),ciphertext text not null,updated_at timestamptz not null default now());
do $$declare t text;begin foreach t in array array['namora_personal_status','namora_music_queue','namora_music_session','namora_music_app'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end$$;
create or replace function namora_private.companion(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();cid uuid:=namora_private.couple_id();act text:=coalesce(p->>'action','status');personal_row public.namora_personal_status;session_row public.namora_music_session;track_row public.namora_music_queue;snap jsonb;apps jsonb;v text;since_at timestamptz;
begin
 if uid is null or cid is null then raise exception 'Entre em um vínculo primeiro.';end if;
 if octet_length(p::text)>18000 then raise exception 'Conteúdo muito grande.';end if;
 if act in ('profile','consent','device') then
  insert into public.namora_personal_status(user_id,couple_id) values(uid,cid) on conflict(user_id) do update set couple_id=cid,snapshot=case when namora_personal_status.couple_id<>cid then '{}'::jsonb else namora_personal_status.snapshot end;
  select * into personal_row from public.namora_personal_status where user_id=uid for update;
  if act='profile' then
   update public.namora_personal_status set nickname=left(coalesce(p->>'nickname',nickname),50),bio=left(coalesce(p->>'bio',bio),280),emoji=left(coalesce(p->>'emoji',emoji),12),mood=left(coalesce(p->>'mood',mood),40),mood_level=coalesce((p->>'level')::integer,mood_level),note=left(coalesce(p->>'note',note),140),updated_at=now() where user_id=uid;
  elsif act='consent' then
   update public.namora_personal_status set share_device=coalesce((p->>'device')::boolean,false),share_apps=coalesce((p->>'device')::boolean,false) and coalesce((p->>'apps')::boolean,false),snapshot='{}',device_at=null where user_id=uid;
  elsif personal_row.share_device then
   snap:=jsonb_build_object('platform',case when p->>'platform'='android' then 'android' else 'web' end,'online',coalesce((p->>'online')::boolean,false));
   if p->>'platform'='android' then
    if p ? 'battery' then snap:=snap||jsonb_build_object('battery',greatest(0,least(100,(p->>'battery')::integer)));end if;
    snap:=snap||jsonb_build_object('charging',coalesce((p->>'charging')::boolean,false),'screen',coalesce((p->>'screen')::boolean,false),'locked',coalesce((p->>'locked')::boolean,false),'connection',case when p->>'connection' in ('wifi','mobile','offline','ethernet','other') then p->>'connection' else 'other' end,'usageAllowed',coalesce((p->>'usageAllowed')::boolean,false));
    if personal_row.share_apps and coalesce((p->>'usageAllowed')::boolean,false) then
     if jsonb_typeof(p->'usage')='array' then
      select coalesce(jsonb_agg(jsonb_build_object('name',left(x->>'name',80),'minutes',greatest(0,least(1440,(x->>'minutes')::integer)))),'[]') into apps from (select x from jsonb_array_elements(p->'usage') x limit 12) a;
     else apps:='[]';end if;
     snap:=snap||jsonb_build_object('app',left(coalesce(p->>'app',''),80),'usage',apps,'usageDay',left(coalesce(p->>'usageDay',''),10));
    end if;
   end if;
   update public.namora_personal_status set snapshot=snap,device_at=now() where user_id=uid;
  end if;
  return jsonb_build_object('ok',true);
 elsif act='notifications' then
  since_at:=greatest(now()-interval '24 hours',least(now(),coalesce((p->>'since')::timestamptz,now())));
  return jsonb_build_object('server_time',now(),'events',coalesce((select jsonb_agg(x order by created_at) from(
   select 'safety:'||e.id key,e.kind kind,e.body body,e.created_at,'map' route from public.namora_safety_events e where e.couple_id=cid and e.user_id<>uid and e.created_at>=since_at
   union all select 'chat:'||m.id,'message',left(m.body,200),m.created_at,'chat' from public.namora_messages m where m.couple_id=cid and m.sender<>uid and m.created_at>=since_at
   union all select 'social:'||m.id,'message','Nova mensagem na caixa dos casais',m.created_at,'social-chat' from public.namora_social_messages m where m.to_couple=cid and m.created_at>=since_at
   order by created_at desc limit 100)x),'[]'::jsonb));
 elsif act='queue-add' then
  perform pg_advisory_xact_lock(hashtext(cid::text));
  if (select count(*) from public.namora_music_queue where couple_id=cid)>=100 then raise exception 'A lista aceita até 100 músicas. Remova uma para adicionar outra.';end if;
  v:=coalesce(p->>'url','');
  if p->>'provider'='youtube' then
   if v!~'^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]{11}$' then raise exception 'Link do YouTube inválido.';end if;
  elsif p->>'provider'='audio' then
   if v!~*'^https://[^/@:[:space:]]+([:][0-9]+)?/[^[:space:]]+[.](mp3|m4a|ogg|wav|aac)([?][^[:space:]]*)?$' then raise exception 'Use um link HTTPS direto de áudio MP3, M4A, OGG, WAV ou AAC.';end if;
  else raise exception 'Fonte inválida.';end if;
  insert into public.namora_music_queue(couple_id,creator,title,url,provider) values(cid,uid,left(coalesce(nullif(btrim(p->>'title'),''),'Nossa música'),200),v,p->>'provider');
 elsif act='queue-remove' then
  delete from public.namora_music_queue where id=(p->>'id')::uuid and couple_id=cid;
 elsif act='playback' then
  insert into public.namora_music_session(couple_id) values(cid) on conflict do nothing;
  select * into session_row from public.namora_music_session where couple_id=cid for update;
  if coalesce((p->>'revision')::integer,-1)<>session_row.revision then raise exception 'A reprodução mudou. Tente novamente.';end if;
  select * into track_row from public.namora_music_queue where id=(p->>'id')::uuid and couple_id=cid;
  if not found then raise exception 'Escolha uma música da lista.';end if;
  update public.namora_music_session set track_id=track_row.id,playing=coalesce((p->>'playing')::boolean,false),position=greatest(0,least(86400,coalesce((p->>'position')::double precision,0))),updated_at=now(),controller=uid,revision=revision+1 where couple_id=cid;
 elsif act not in ('status','music') then raise exception 'Ação inválida.';
 end if;
 if act in ('queue-add','queue-remove','playback','music') then
  return jsonb_build_object('server_time',now(),'queue',coalesce((select jsonb_agg(t order by created_at,id) from public.namora_music_queue t where couple_id=cid),'[]'::jsonb),'session',(select to_jsonb(s) from public.namora_music_session s where couple_id=cid));
 end if;
 return jsonb_build_object('server_time',now(),'people',coalesce((select jsonb_agg(jsonb_build_object('user_id',user_id,'nickname',nickname,'bio',bio,'emoji',emoji,'mood',mood,'level',mood_level,'note',note,'share_device',share_device,'share_apps',share_apps,'snapshot',case when share_device and device_at>now()-interval '2 minutes' then snapshot else '{}'::jsonb end,'device_at',device_at,'updated_at',updated_at)) from public.namora_personal_status r where couple_id=cid and exists(select 1 from public.namora_members m where m.user_id=r.user_id and m.couple_id=cid)),'[]'::jsonb));
end;$$;
revoke all on function namora_private.companion(jsonb) from public,anon;
grant execute on function namora_private.companion(jsonb) to authenticated;
create or replace function public.namora_companion(payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select namora_private.companion(payload)$$;
revoke all on function public.namora_companion(jsonb) from public,anon;
grant execute on function public.namora_companion(jsonb) to authenticated;
commit;
