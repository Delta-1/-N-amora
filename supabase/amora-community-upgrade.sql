-- Community identity belongs to the couple; private app data remains under its existing policies.
create table if not exists namora_private.administrators(user_id uuid primary key references auth.users(id) on delete cascade);
alter table namora_private.administrators enable row level security;
revoke all on namora_private.administrators from public,anon,authenticated;
insert into namora_private.administrators(user_id) select id from auth.users where lower(email)='deltaspriggan@gmail.com' and email_confirmed_at is not null on conflict do nothing;
create or replace function namora_private.is_administrator() returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and exists(select 1 from namora_private.administrators where user_id=auth.uid()) $$;
revoke all on function namora_private.is_administrator() from public,anon;
grant execute on function namora_private.is_administrator() to authenticated,service_role;
create or replace function public.namora_access() returns jsonb language sql security invoker set search_path='' as $$ select jsonb_build_object('administrator',namora_private.is_administrator(),'lilith',namora_private.is_administrator()) $$;
revoke all on function public.namora_access() from public,anon;
grant execute on function public.namora_access() to authenticated;
create table if not exists public.namora_social_profiles(
 couple_id uuid primary key references public.namora_couples(id) on delete cascade,
 handle text not null unique check(handle ~ '^[a-z0-9_.]{3,24}$'),
 display_name text not null check(length(display_name) between 1 and 70),
 bio text not null default '' check(length(bio)<=500),
 avatar_path text not null default '',cover_path text not null default '',
 theme text not null default 'lilac' check(theme in ('lilac','rose','night')),
 listed boolean not null default false,
 friend_code text not null unique default ('C'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
 updated_at timestamptz not null default now()
);
create table if not exists public.namora_social_friends(
 a uuid not null references public.namora_couples(id) on delete cascade,b uuid not null references public.namora_couples(id) on delete cascade,
 requested_by uuid not null references public.namora_couples(id) on delete cascade,status text not null default 'pending' check(status in ('pending','accepted')),
 created_at timestamptz not null default now(),primary key(a,b),check(a<b),check(requested_by in (a,b))
);
create table if not exists public.namora_social_blocks(blocker uuid not null references public.namora_couples(id) on delete cascade,blocked uuid not null references public.namora_couples(id) on delete cascade,primary key(blocker,blocked),check(blocker<>blocked));
create table if not exists public.namora_social_posts(id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.namora_social_profiles(couple_id) on delete cascade,author_id uuid references auth.users(id) on delete set null,body text not null check(length(body)<=3000),image_path text not null default '',hidden boolean not null default false,created_at timestamptz not null default now(),check(length(btrim(body))>0 or image_path<>''));
create index if not exists namora_social_posts_recent on public.namora_social_posts(created_at desc);
create table if not exists public.namora_social_likes(post_id uuid references public.namora_social_posts(id) on delete cascade,couple_id uuid references public.namora_couples(id) on delete cascade,primary key(post_id,couple_id));
create table if not exists public.namora_social_comments(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.namora_social_posts(id) on delete cascade,couple_id uuid not null references public.namora_social_profiles(couple_id) on delete cascade,body text not null check(length(btrim(body)) between 1 and 1000),created_at timestamptz not null default now());
create index if not exists namora_social_comments_post on public.namora_social_comments(post_id,created_at);
create table if not exists public.namora_social_messages(id uuid primary key default gen_random_uuid(),from_couple uuid not null references public.namora_couples(id) on delete cascade,to_couple uuid not null references public.namora_couples(id) on delete cascade,sender_id uuid references auth.users(id) on delete set null,body text not null check(length(btrim(body)) between 1 and 3000),created_at timestamptz not null default now(),check(from_couple<>to_couple));
create index if not exists namora_social_messages_thread on public.namora_social_messages(from_couple,to_couple,created_at desc);
create table if not exists public.namora_social_reports(id uuid primary key default gen_random_uuid(),post_id uuid references public.namora_social_posts(id) on delete cascade,reporter_couple uuid not null references public.namora_couples(id) on delete cascade,reason text not null check(length(btrim(reason)) between 1 and 500),created_at timestamptz not null default now(),unique(post_id,reporter_couple));
create table if not exists public.namora_now_playing(user_id uuid primary key references auth.users(id) on delete cascade,couple_id uuid not null references public.namora_couples(id) on delete cascade,provider text not null check(provider in ('spotify','youtube')),title text not null check(length(title)<=200),url text not null check(length(url)<=500),playing boolean not null default true,updated_at timestamptz not null default now());
create table if not exists public.namora_music_tokens(user_id uuid primary key references auth.users(id) on delete cascade,ciphertext text not null,updated_at timestamptz not null default now());
create table if not exists public.namora_whatsapp_sessions(user_id uuid primary key references auth.users(id) on delete cascade,couple_id uuid not null references public.namora_couples(id) on delete cascade,shared boolean not null default false,status text not null default 'disconnected',phone text not null default '',updated_at timestamptz not null default now());
create table if not exists public.namora_whatsapp_auth(user_id uuid primary key references auth.users(id) on delete cascade,ciphertext text not null,updated_at timestamptz not null default now());
create table if not exists public.namora_whatsapp_messages(id text not null,owner_id uuid not null references auth.users(id) on delete cascade,jid text not null,contact_name text not null default '',body text not null default '',from_me boolean not null,media_type text not null default '',created_at timestamptz not null default now(),primary key(owner_id,id));
alter table public.namora_whatsapp_messages add column if not exists payload jsonb;
create index if not exists namora_whatsapp_thread on public.namora_whatsapp_messages(owner_id,jid,created_at desc);
create table if not exists public.namora_app_config(id boolean primary key default true check(id),spotify_client_id text not null default '',gateway_url text not null default '',updated_at timestamptz not null default now());
insert into public.namora_app_config(id) values(true) on conflict do nothing;
create or replace function namora_private.social_blocked(x uuid,y uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.namora_social_blocks where (blocker=x and blocked=y) or (blocker=y and blocked=x))$$;
create or replace function namora_private.social_friend(x uuid,y uuid) returns boolean language sql stable security definer set search_path='' as $$select x is not null and y is not null and not namora_private.social_blocked(x,y) and exists(select 1 from public.namora_social_friends where a=least(x,y) and b=greatest(x,y) and status='accepted')$$;
create or replace function namora_private.social_visible(x uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and (x=namora_private.couple_id() or (not namora_private.social_blocked(x,namora_private.couple_id()) and exists(select 1 from public.namora_social_profiles where couple_id=x and listed)))$$;
revoke all on function namora_private.social_blocked(uuid,uuid),namora_private.social_friend(uuid,uuid),namora_private.social_visible(uuid) from public,anon;
grant execute on function namora_private.social_blocked(uuid,uuid),namora_private.social_friend(uuid,uuid),namora_private.social_visible(uuid) to authenticated;
do $$declare t text;begin foreach t in array array['namora_social_profiles','namora_social_friends','namora_social_blocks','namora_social_posts','namora_social_likes','namora_social_comments','namora_social_messages','namora_social_reports','namora_now_playing','namora_music_tokens','namora_whatsapp_sessions','namora_whatsapp_auth','namora_whatsapp_messages','namora_app_config'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end$$;
grant select on public.namora_social_profiles,public.namora_social_friends,public.namora_social_posts,public.namora_social_likes,public.namora_social_comments,public.namora_social_messages,public.namora_now_playing,public.namora_whatsapp_sessions,public.namora_app_config to authenticated;
drop policy if exists namora_social_profile_read on public.namora_social_profiles;
create policy namora_social_profile_read on public.namora_social_profiles for select to authenticated using(namora_private.social_visible(couple_id) or namora_private.social_friend(couple_id,namora_private.couple_id()));
drop policy if exists namora_social_friend_read on public.namora_social_friends;
create policy namora_social_friend_read on public.namora_social_friends for select to authenticated using(namora_private.couple_id() in (a,b));
drop policy if exists namora_social_post_read on public.namora_social_posts;
create policy namora_social_post_read on public.namora_social_posts for select to authenticated using(not hidden and namora_private.social_visible(couple_id));
drop policy if exists namora_social_like_read on public.namora_social_likes;
create policy namora_social_like_read on public.namora_social_likes for select to authenticated using(exists(select 1 from public.namora_social_posts where id=post_id));
drop policy if exists namora_social_comment_read on public.namora_social_comments;
create policy namora_social_comment_read on public.namora_social_comments for select to authenticated using(exists(select 1 from public.namora_social_posts where id=post_id));
drop policy if exists namora_social_message_read on public.namora_social_messages;
create policy namora_social_message_read on public.namora_social_messages for select to authenticated using(namora_private.couple_id() in (from_couple,to_couple) and namora_private.social_friend(from_couple,to_couple));
drop policy if exists namora_now_playing_read on public.namora_now_playing;
create policy namora_now_playing_read on public.namora_now_playing for select to authenticated using(couple_id=namora_private.couple_id() and updated_at>now()-interval '2 minutes');
drop policy if exists namora_whatsapp_session_read on public.namora_whatsapp_sessions;
create policy namora_whatsapp_session_read on public.namora_whatsapp_sessions for select to authenticated using(couple_id=namora_private.couple_id() and (user_id=auth.uid() or shared));
drop policy if exists namora_app_config_read on public.namora_app_config;
create policy namora_app_config_read on public.namora_app_config for select to authenticated using(true);
create or replace function namora_private.social_action(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();cid uuid:=namora_private.couple_id();a text:=coalesce(payload->>'action','state');target uuid;pid uuid;pr public.namora_social_profiles;body text;path text;code text;attempts integer;
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Entre na sua conta.';end if;
 if payload is null or octet_length(payload::text)>20000 then raise exception 'Pedido muito grande.';end if;
 if a='config' then
  if not namora_private.is_administrator() then raise exception 'Acesso exclusivo do administrador.';end if;
  if coalesce(payload->>'spotify_client_id','') !~ '^[a-zA-Z0-9]{0,80}$' or (coalesce(payload->>'gateway_url','')<>'' and payload->>'gateway_url' !~ '^https://[a-z0-9-]+\.up\.railway\.app$') then raise exception 'Configuração inválida.';end if;
  update public.namora_app_config set spotify_client_id=coalesce(payload->>'spotify_client_id',''),gateway_url=coalesce(payload->>'gateway_url',''),updated_at=now() where id;return jsonb_build_object('ok',true);
 end if;
 if a='admin' then
  if not namora_private.is_administrator() then raise exception 'Acesso exclusivo do administrador.';end if;
  return jsonb_build_object('profiles',(select count(*) from public.namora_social_profiles),'posts',(select count(*) from public.namora_social_posts),'reports',coalesce((select jsonb_agg(to_jsonb(r)) from (select * from public.namora_social_reports order by created_at desc limit 100)r),'[]'::jsonb));
 end if;
 if a='moderate' then
  if not namora_private.is_administrator() then raise exception 'Acesso exclusivo do administrador.';end if;
  update public.namora_social_posts set hidden=coalesce((payload->>'hidden')::boolean,true) where id=(payload->>'post_id')::uuid;return jsonb_build_object('ok',true);
 end if;
 if a='state' then
  return jsonb_build_object('profile',(select to_jsonb(p) from public.namora_social_profiles p where couple_id=cid),'profiles',coalesce((select jsonb_agg(to_jsonb(p)) from (select * from public.namora_social_profiles p where namora_private.social_visible(couple_id) and (coalesce(payload->>'search','')='' or position(lower(payload->>'search') in lower(handle||' '||display_name))>0) order by updated_at desc limit 100)p),'[]'::jsonb),'friends',coalesce((select jsonb_agg(jsonb_build_object('a',f.a,'b',f.b,'requested_by',f.requested_by,'status',f.status,'profile',to_jsonb(p))) from public.namora_social_friends f join public.namora_social_profiles p on p.couple_id=case when f.a=cid then f.b else f.a end where cid in (f.a,f.b) and not namora_private.social_blocked(f.a,f.b)),'[]'::jsonb),'config',(select jsonb_build_object('spotify_client_id',spotify_client_id,'gateway_url',gateway_url) from public.namora_app_config where id));
 end if;
 if a='feed' then
  return coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('profile',to_jsonb(sp),'likes',(select count(*) from public.namora_social_likes l where l.post_id=p.id),'liked',exists(select 1 from public.namora_social_likes l where l.post_id=p.id and l.couple_id=cid),'comments',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('profile',to_jsonb(cp))) from (select * from public.namora_social_comments where post_id=p.id order by created_at desc limit 30)c join public.namora_social_profiles cp on cp.couple_id=c.couple_id),'[]'::jsonb))) from (select * from public.namora_social_posts where not hidden and namora_private.social_visible(couple_id) and (coalesce(payload->>'couple_id','')='' or couple_id=(payload->>'couple_id')::uuid) and (coalesce(payload->>'before','')='' or created_at<(payload->>'before')::timestamptz) order by created_at desc limit 30)p join public.namora_social_profiles sp on sp.couple_id=p.couple_id),'[]'::jsonb);
 end if;
 if cid is null then raise exception 'Crie ou entre em um vínculo para usar a comunidade.';end if;
 if a='thread' then
  target:=(payload->>'couple_id')::uuid;if not namora_private.social_friend(cid,target) then raise exception 'Adicionem-se como amigos antes de conversar.';end if;
  return coalesce((select jsonb_agg(to_jsonb(m) order by created_at) from (select * from public.namora_social_messages where ((from_couple=cid and to_couple=target) or(from_couple=target and to_couple=cid)) and (coalesce(payload->>'before','')='' or created_at<(payload->>'before')::timestamptz) order by created_at desc limit 100)m),'[]'::jsonb);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,83));
 insert into namora_private.limits as l(user_id,scope,count,reset_at) values(uid,'community',1,now()+interval '1 minute') on conflict(user_id,scope) do update set count=case when l.reset_at<now() then 1 else l.count+1 end,reset_at=case when l.reset_at<now() then now()+interval '1 minute' else l.reset_at end returning count into attempts;
 if attempts>100 then raise exception 'Muitas ações. Aguarde um minuto.';end if;
 if a='profile' then
  path:=coalesce(payload->>'avatar_path','');if path<>'' and (path not like cid::text||'/%' or path like '%..%' or length(path)>200) then raise exception 'Imagem inválida.';end if;
  code:=coalesce(payload->>'cover_path','');if code<>'' and (code not like cid::text||'/%' or code like '%..%' or length(code)>200) then raise exception 'Capa inválida.';end if;
  insert into public.namora_social_profiles(couple_id,handle,display_name,bio,avatar_path,cover_path,theme,listed) values(cid,lower(btrim(payload->>'handle')),btrim(payload->>'display_name'),coalesce(payload->>'bio',''),path,code,coalesce(payload->>'theme','lilac'),coalesce((payload->>'listed')::boolean,false)) on conflict(couple_id) do update set handle=excluded.handle,display_name=excluded.display_name,bio=excluded.bio,avatar_path=excluded.avatar_path,cover_path=excluded.cover_path,theme=excluded.theme,listed=excluded.listed,updated_at=now();
 elsif a='friend-request' then
  select couple_id into target from public.namora_social_profiles where friend_code=upper(regexp_replace(payload->>'code','[\s-]','','g')) and listed;
  if target is null or target=cid or namora_private.social_blocked(cid,target) then raise exception 'Código de amizade indisponível.';end if;
  if not exists(select 1 from public.namora_social_profiles where couple_id=cid) then raise exception 'Salve o perfil do casal antes de adicionar amigos.';end if;
  insert into public.namora_social_friends(a,b,requested_by) values(least(cid,target),greatest(cid,target),cid) on conflict do nothing;
 elsif a in ('accept-friend','remove-friend','block') then
  target:=(payload->>'couple_id')::uuid;
  if a='accept-friend' then update public.namora_social_friends f set status='accepted' where f.a=least(cid,target) and f.b=greatest(cid,target) and f.requested_by<>cid and not namora_private.social_blocked(cid,target);
  else delete from public.namora_social_friends f where f.a=least(cid,target) and f.b=greatest(cid,target);if a='block' then insert into public.namora_social_blocks values(cid,target) on conflict do nothing;end if;end if;
 elsif a='message' then
  target:=(payload->>'couple_id')::uuid;if not namora_private.social_friend(cid,target) then raise exception 'Só amigos podem enviar mensagens.';end if;
  insert into public.namora_social_messages(from_couple,to_couple,sender_id,body) values(cid,target,uid,btrim(payload->>'body'));
 elsif a='post' then
  select * into pr from public.namora_social_profiles where couple_id=cid;if not found or not pr.listed then raise exception 'Ative o perfil na comunidade antes de publicar.';end if;
  path:=coalesce(payload->>'image_path','');if path<>'' and (path not like cid::text||'/%' or path like '%..%' or length(path)>200) then raise exception 'Imagem inválida.';end if;
  insert into public.namora_social_posts(couple_id,author_id,body,image_path) values(cid,uid,btrim(coalesce(payload->>'body','')),path);
 elsif a='delete-post' then delete from public.namora_social_posts where id=(payload->>'post_id')::uuid and couple_id=cid;
 elsif a in ('like','comment','report') then
  pid:=(payload->>'post_id')::uuid;select couple_id into target from public.namora_social_posts where id=pid and not hidden and namora_private.social_visible(couple_id);if target is null then raise exception 'Publicação indisponível.';end if;
  if a='like' then delete from public.namora_social_likes where post_id=pid and couple_id=cid;if not found then insert into public.namora_social_likes values(pid,cid);end if;
  elsif a='comment' then if not exists(select 1 from public.namora_social_profiles where couple_id=cid) then raise exception 'Salve o perfil do casal primeiro.';end if;insert into public.namora_social_comments(post_id,couple_id,body) values(pid,cid,btrim(payload->>'body'));
  else insert into public.namora_social_reports(post_id,reporter_couple,reason) values(pid,cid,btrim(payload->>'reason')) on conflict(post_id,reporter_couple) do update set reason=excluded.reason;end if;
 elsif a='now-playing' then
  if coalesce((payload->>'enabled')::boolean,false)=false then delete from public.namora_now_playing where user_id=uid;else
   path:=payload->>'url';if (payload->>'provider'='spotify' and path !~ '^https://open\.spotify\.com/track/[a-zA-Z0-9]+$') or (payload->>'provider'='youtube' and path !~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$') then raise exception 'Link de música inválido.';end if;
   insert into public.namora_now_playing(user_id,couple_id,provider,title,url,playing) values(uid,cid,payload->>'provider',left(coalesce(payload->>'title',''),200),path,coalesce((payload->>'playing')::boolean,true)) on conflict(user_id) do update set couple_id=cid,provider=excluded.provider,title=excluded.title,url=excluded.url,playing=excluded.playing,updated_at=now();end if;
 else raise exception 'Ação indisponível.';end if;
 return jsonb_build_object('ok',true);
end$$;
revoke all on function namora_private.social_action(jsonb) from public,anon;
grant execute on function namora_private.social_action(jsonb) to authenticated;
create or replace function public.namora_social(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select namora_private.social_action(payload)$$;
revoke all on function public.namora_social(jsonb) from public,anon;
grant execute on function public.namora_social(jsonb) to authenticated;
-- Public exposure of private album objects is never widened by the community bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('namora-community','namora-community',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists namora_community_media_read on storage.objects;
create policy namora_community_media_read on storage.objects for select to authenticated using(bucket_id='namora-community' and (split_part(name,'/',1)=(select namora_private.couple_id())::text or exists(select 1 from public.namora_social_profiles p where (p.avatar_path=name or p.cover_path=name) and namora_private.social_visible(p.couple_id)) or exists(select 1 from public.namora_social_posts p where p.image_path=name and not p.hidden and namora_private.social_visible(p.couple_id))));
drop policy if exists namora_community_media_insert on storage.objects;
create policy namora_community_media_insert on storage.objects for insert to authenticated with check(bucket_id='namora-community' and split_part(name,'/',1)=(select namora_private.couple_id())::text and name not like '%..%');
drop policy if exists namora_community_media_delete on storage.objects;
create policy namora_community_media_delete on storage.objects for delete to authenticated using(bucket_id='namora-community' and split_part(name,'/',1)=(select namora_private.couple_id())::text);
-- Restrictive guards also apply when another application has permissive storage policies.
drop policy if exists namora_community_anon_guard on storage.objects;
create policy namora_community_anon_guard on storage.objects as restrictive for all to anon using(bucket_id<>'namora-community') with check(bucket_id<>'namora-community');
drop policy if exists namora_community_read_guard on storage.objects;
create policy namora_community_read_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>'namora-community' or (split_part(name,'/',1)=(select namora_private.couple_id())::text or exists(select 1 from public.namora_social_profiles p where (p.avatar_path=name or p.cover_path=name) and namora_private.social_visible(p.couple_id)) or exists(select 1 from public.namora_social_posts p where p.image_path=name and not p.hidden and namora_private.social_visible(p.couple_id))));
drop policy if exists namora_community_insert_guard on storage.objects;
create policy namora_community_insert_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'namora-community' or (split_part(name,'/',1)=(select namora_private.couple_id())::text and name not like '%..%'));
drop policy if exists namora_community_update_guard on storage.objects;
create policy namora_community_update_guard on storage.objects as restrictive for update to authenticated using(bucket_id<>'namora-community') with check(bucket_id<>'namora-community');
drop policy if exists namora_community_delete_guard on storage.objects;
create policy namora_community_delete_guard on storage.objects as restrictive for delete to authenticated using(bucket_id<>'namora-community' or split_part(name,'/',1)=(select namora_private.couple_id())::text);
