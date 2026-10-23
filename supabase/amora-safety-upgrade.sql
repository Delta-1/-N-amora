begin;
create table if not exists public.namora_tracking(user_id uuid primary key references public.namora_members(user_id) on delete cascade,couple_id uuid not null references public.namora_couples(id) on delete cascade,enabled boolean not null default false,steps_enabled boolean not null default false);
create table if not exists public.namora_places(id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.namora_couples(id) on delete cascade,name text not null check(length(name) between 1 and 60),latitude double precision not null check(latitude between -90 and 90),longitude double precision not null check(longitude between -180 and 180),radius integer not null check(radius between 100 and 1000));
create table if not exists public.namora_safety_events(id bigint generated always as identity primary key,couple_id uuid not null references public.namora_couples(id) on delete cascade,user_id uuid not null references public.namora_members(user_id) on delete cascade,kind text not null check(kind in ('arrival','sos')),body text not null check(length(body)<=300),created_at timestamptz not null default now());
create index if not exists namora_safety_events_couple on public.namora_safety_events(couple_id,id desc);
create table if not exists public.namora_steps(user_id uuid not null references public.namora_members(user_id) on delete cascade,couple_id uuid not null references public.namora_couples(id) on delete cascade,day date not null,steps integer not null check(steps between 0 and 200000),primary key(user_id,day));
create table if not exists namora_private.presence(user_id uuid not null references public.namora_members(user_id) on delete cascade,place_id uuid not null references public.namora_places(id) on delete cascade,inside boolean not null default false,last_arrival timestamptz,primary key(user_id,place_id));
alter table namora_private.presence enable row level security;
revoke all on namora_private.presence from public,anon,authenticated;
alter table public.namora_tracking enable row level security;
alter table public.namora_places enable row level security;
alter table public.namora_safety_events enable row level security;
alter table public.namora_steps enable row level security;
revoke all on public.namora_tracking,public.namora_places,public.namora_safety_events,public.namora_steps from public,anon,authenticated;
grant select on public.namora_tracking,public.namora_places,public.namora_safety_events,public.namora_steps to authenticated;
drop policy if exists couple_read on public.namora_tracking;
create policy couple_read on public.namora_tracking for select to authenticated using(couple_id=(select namora_private.couple_id()));
drop policy if exists couple_read on public.namora_places;
create policy couple_read on public.namora_places for select to authenticated using(couple_id=(select namora_private.couple_id()));
drop policy if exists couple_read on public.namora_safety_events;
create policy couple_read on public.namora_safety_events for select to authenticated using(couple_id=(select namora_private.couple_id()));
drop policy if exists couple_read on public.namora_steps;
create policy couple_read on public.namora_steps for select to authenticated using(couple_id=(select namora_private.couple_id()));
create or replace function namora_private.track(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();cid uuid;a text:=coalesce(p->>'action','snapshot');t public.namora_tracking;pl public.namora_places;pr namora_private.presence;lat double precision;lon double precision;acc integer;dist double precision;month_start date;d date;total integer;nm text;
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Entre na sua conta.';end if;
 if octet_length(p::text)>5000 then raise exception 'Conteúdo muito grande.';end if;
 select couple_id,name into cid,nm from public.namora_members where user_id=uid;if cid is null then raise exception 'Entre em um vínculo.';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,84));
 select * into t from public.namora_tracking where user_id=uid;
 if a='consent' then
  insert into public.namora_tracking(user_id,couple_id,enabled,steps_enabled) values(uid,cid,coalesce((p->>'enabled')::boolean,false),coalesce((p->>'steps_enabled')::boolean,false)) on conflict(user_id) do update set enabled=excluded.enabled,steps_enabled=excluded.steps_enabled returning * into t;
  if not t.enabled then delete from public.namora_locations where user_id=uid;delete from namora_private.presence where user_id=uid;end if;
 elsif a='place' then
  if (select count(*) from public.namora_places where couple_id=cid)>=30 then raise exception 'Limite de 30 locais por vínculo.';end if;
  insert into public.namora_places(couple_id,name,latitude,longitude,radius) values(cid,trim(p->>'name'),(p->>'latitude')::double precision,(p->>'longitude')::double precision,(p->>'radius')::integer);
 elsif a='delete-place' then delete from public.namora_places where id=(p->>'id')::uuid and couple_id=cid;
 elsif a='location' then
  if not coalesce(t.enabled,false) then raise exception 'Ative seu compartilhamento antes.';end if;
  lat:=(p->>'latitude')::double precision;lon:=(p->>'longitude')::double precision;acc:=ceil((p->>'accuracy')::numeric);
  if lat is null or lon is null or acc is null or lat not between -90 and 90 or lon not between -180 and 180 or acc not between 0 and 100000 then raise exception 'Posição inválida.';end if;
  insert into public.namora_locations(user_id,couple_id,latitude,longitude,accuracy) values(uid,cid,lat,lon,acc) on conflict(user_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,updated_at=now();
  for pl in select * from public.namora_places where couple_id=cid loop
   -- Conservative boundary: poor fixes cannot generate arrivals; exits have hysteresis.
   if acc>least(pl.radius,100) then continue;end if;
   dist:=6371000*2*asin(sqrt(least(1,power(sin(radians(pl.latitude-lat)/2),2)+cos(radians(lat))*cos(radians(pl.latitude))*power(sin(radians(pl.longitude-lon)/2),2))));
   select * into pr from namora_private.presence where user_id=uid and place_id=pl.id;
   if dist+acc<=pl.radius and not coalesce(pr.inside,false) then
    if pr.last_arrival is null or pr.last_arrival<now()-interval '5 minutes' then insert into public.namora_safety_events(couple_id,user_id,kind,body) values(cid,uid,'arrival',nm||' chegou em '||pl.name);end if;
    insert into namora_private.presence values(uid,pl.id,true,now()) on conflict(user_id,place_id) do update set inside=true,last_arrival=excluded.last_arrival;
   elsif dist-acc>pl.radius+50 then
    insert into namora_private.presence(user_id,place_id,inside) values(uid,pl.id,false) on conflict(user_id,place_id) do update set inside=false;
   end if;
  end loop;
 elsif a='steps' then
  if not coalesce(t.steps_enabled,false) then raise exception 'Ative sua contagem de passos.';end if;
  d:=(p->>'day')::date;total:=(p->>'steps')::integer;
  if d is null or total is null or d<current_date-interval '35 days' or d>current_date+1 then raise exception 'Dia inválido.';end if;
  insert into public.namora_steps values(uid,cid,d,total) on conflict(user_id,day) do update set steps=greatest(public.namora_steps.steps,excluded.steps);
 elsif a='sos' then
  if exists(select 1 from public.namora_safety_events where user_id=uid and kind='sos' and created_at>now()-interval '1 minute') then raise exception 'SOS já enviado. Aguarde um minuto para repetir.';end if;
  insert into public.namora_safety_events(couple_id,user_id,kind,body) values(cid,uid,'sos',nm||' pediu ajuda. Entre em contato agora.');
 elsif a<>'snapshot' then raise exception 'Ação inválida.';end if;
 month_start:=date_trunc('month',now())::date;
 if p?'month' then
  if p->>'month' !~ '^\d{4}-\d{2}$' then raise exception 'Mês inválido.';end if;
  month_start:=((p->>'month')||'-01')::date;
 end if;
 return jsonb_build_object('enabled',coalesce(t.enabled,false),'steps_enabled',coalesce(t.steps_enabled,false),'places',(select coalesce(jsonb_agg(x),'[]') from(select id,name,latitude,longitude,radius from public.namora_places where couple_id=cid order by name)x),'events',(select coalesce(jsonb_agg(x order by id),'[]') from(select id,user_id,kind,body,created_at from public.namora_safety_events where couple_id=cid order by id desc limit 50)x),'steps',(select coalesce(jsonb_agg(x),'[]') from(select user_id,sum(steps)::integer steps from public.namora_steps where couple_id=cid and day>=month_start and day<month_start+interval '1 month' group by user_id)x));
end;$$;
revoke all on function namora_private.track(jsonb) from public,anon;
grant execute on function namora_private.track(jsonb) to authenticated;
create or replace function public.namora_track(payload jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select namora_private.track(payload)$$;
revoke all on function public.namora_track(jsonb) from public,anon;
grant execute on function public.namora_track(jsonb) to authenticated;
commit;
