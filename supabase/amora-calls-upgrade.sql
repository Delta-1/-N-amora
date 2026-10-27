create table if not exists public.namora_guardian_consent(user_id uuid primary key references auth.users(id) on delete cascade,couple_id uuid not null references public.namora_couples(id) on delete cascade,enabled boolean not null default false,updated_at timestamptz not null default now());
create table if not exists public.namora_calls(id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.namora_couples(id) on delete cascade,caller uuid not null references auth.users(id) on delete cascade,recipient uuid not null references auth.users(id) on delete cascade,kind text not null check(kind in ('voice','guardian','radio')),status text not null default 'ringing' check(status in ('ringing','accepted','ended')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(caller<>recipient));
create index if not exists namora_calls_current on public.namora_calls(couple_id,updated_at desc);
create table if not exists public.namora_call_signals(id bigint generated always as identity primary key,call_id uuid not null references public.namora_calls(id) on delete cascade,sender uuid not null references auth.users(id) on delete cascade,payload jsonb not null check(octet_length(payload::text)<=20000),created_at timestamptz not null default now());
create index if not exists namora_call_signal_order on public.namora_call_signals(call_id,id);
alter table public.namora_guardian_consent enable row level security;alter table public.namora_calls enable row level security;alter table public.namora_call_signals enable row level security;
revoke all on public.namora_guardian_consent,public.namora_calls,public.namora_call_signals from public,anon,authenticated;
grant select on public.namora_guardian_consent,public.namora_calls,public.namora_call_signals to authenticated;
grant all on public.namora_guardian_consent,public.namora_calls,public.namora_call_signals to service_role;
drop policy if exists namora_guardian_read on public.namora_guardian_consent;
create policy namora_guardian_read on public.namora_guardian_consent for select to authenticated using(couple_id=(select namora_private.couple_id()));
drop policy if exists namora_calls_read on public.namora_calls;
create policy namora_calls_read on public.namora_calls for select to authenticated using(couple_id=(select namora_private.couple_id()) and auth.uid() in(caller,recipient));
drop policy if exists namora_signals_read on public.namora_call_signals;
create policy namora_signals_read on public.namora_call_signals for select to authenticated using(exists(select 1 from public.namora_calls c where c.id=call_id and c.couple_id=namora_private.couple_id() and auth.uid() in(c.caller,c.recipient) and c.status='accepted'));
create or replace function namora_private.call_action(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();cid uuid:=namora_private.couple_id();act text:=coalesce(payload->>'action','state');c public.namora_calls;target uuid;total integer;kind text;
begin
 if uid is null or cid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Entre em um vínculo para chamar seu amor.';end if;
 if payload is null or octet_length(payload::text)>21000 then raise exception 'Sinal inválido.';end if;
 update public.namora_calls set status='ended' where couple_id=cid and (not exists(select 1 from public.namora_members m where m.couple_id=cid and m.user_id=caller) or not exists(select 1 from public.namora_members m where m.couple_id=cid and m.user_id=recipient) or (status='ringing' and created_at<now()-interval '90 seconds') or (status='accepted' and updated_at<now()-interval '60 seconds'));
 if act='state' then
  select * into c from public.namora_calls where couple_id=cid and uid in(caller,recipient) and status<>'ended' order by created_at desc limit 1;
  return jsonb_build_object('call',case when c.id is null then null else to_jsonb(c) end,'consents',coalesce((select jsonb_agg(to_jsonb(g)) from public.namora_guardian_consent g join public.namora_members m on m.user_id=g.user_id and m.couple_id=g.couple_id where g.couple_id=cid),'[]'::jsonb),'signals',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.namora_call_signals s where s.call_id=c.id and s.sender<>uid and s.id>coalesce(($1->>'after')::bigint,0)),'[]'::jsonb));
 end if;
 if act='consent' then
  insert into public.namora_guardian_consent(user_id,couple_id,enabled) values(uid,cid,coalesce((payload->>'enabled')::boolean,false)) on conflict(user_id) do update set couple_id=cid,enabled=excluded.enabled,updated_at=now();
  if not coalesce((payload->>'enabled')::boolean,false) then update public.namora_calls x set status='ended' where x.couple_id=cid and x.kind='guardian';end if;return jsonb_build_object('ok',true);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,96));
 if act='request' then
  select count(*) into total from public.namora_calls where caller=uid and created_at>now()-interval '1 minute';if total>=6 then raise exception 'Aguarde antes de chamar novamente.';end if;
  if exists(select 1 from public.namora_calls where couple_id=cid and status<>'ended') then raise exception 'Já existe uma chamada neste vínculo.';end if;
  target:=(payload->>'target')::uuid;kind:=payload->>'kind';if target=uid or not exists(select 1 from public.namora_members where user_id=target and couple_id=cid) then raise exception 'Só o integrante do seu vínculo pode receber esta chamada.';end if;
  if kind='guardian' and (select count(*) from public.namora_guardian_consent g join public.namora_members m on m.user_id=g.user_id and m.couple_id=cid where g.couple_id=cid and g.enabled)<>2 then raise exception 'Os dois precisam ativar Olho Guardião nas configurações.';end if;
  insert into public.namora_calls(couple_id,caller,recipient,kind) values(cid,uid,target,kind) returning * into c;return to_jsonb(c);
 end if;
 select * into c from public.namora_calls where id=(payload->>'id')::uuid and couple_id=cid and uid in(caller,recipient) for update;if not found then raise exception 'Chamada indisponível.';end if;
 if act='end' then update public.namora_calls set status='ended',updated_at=now() where id=c.id;return jsonb_build_object('ok',true);end if;
 if act='accept' then
  if c.recipient<>uid or c.status<>'ringing' then raise exception 'A chamada só pode ser aceita pelo destinatário.';end if;
  if c.kind='guardian' and (select count(*) from public.namora_guardian_consent g join public.namora_members m on m.user_id=g.user_id and m.couple_id=cid where g.couple_id=cid and g.enabled)<>2 then raise exception 'A autorização do Olho Guardião foi desativada.';end if;
  update public.namora_calls set status='accepted',updated_at=now() where id=c.id;return jsonb_build_object('ok',true);
 end if;
 if c.status<>'accepted' then raise exception 'A outra pessoa ainda não aceitou.';end if;
 if act='touch' then update public.namora_calls set updated_at=now() where id=c.id;return jsonb_build_object('ok',true);end if;
 if act='signal' then
  if payload->'signal'->>'type' not in ('offer','answer','ice') then raise exception 'Sinal inválido.';end if;
  if (payload->'signal'->>'type'='offer' and c.caller<>uid) or (payload->'signal'->>'type'='answer' and c.recipient<>uid) then raise exception 'Sinal fora de ordem.';end if;
  select count(*) into total from public.namora_call_signals where call_id=c.id and sender=uid and created_at>now()-interval '1 minute';if total>180 then raise exception 'Sinais demais. Reinicie a chamada.';end if;
  insert into public.namora_call_signals(call_id,sender,payload) values(c.id,uid,payload->'signal');delete from public.namora_call_signals where created_at<now()-interval '30 minutes';return jsonb_build_object('ok',true);
 end if;raise exception 'Ação inválida.';
end$$;
revoke all on function namora_private.call_action(jsonb) from public,anon;
grant execute on function namora_private.call_action(jsonb) to authenticated;
create or replace function public.namora_call(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select namora_private.call_action(payload)$$;
revoke all on function public.namora_call(jsonb) from public,anon;grant execute on function public.namora_call(jsonb) to authenticated;
