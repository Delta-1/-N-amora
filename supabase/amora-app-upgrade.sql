-- Additive Android/couple features. Existing records and other apps are untouched.
create table if not exists public.namora_messages (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.namora_couples(id) on delete cascade,
 sender uuid not null default auth.uid() references auth.users(id), body text not null check(length(btrim(body)) between 1 and 4000), created_at timestamptz not null default now()
);
create index if not exists namora_messages_timeline on public.namora_messages(couple_id,created_at desc);
create table if not exists public.namora_notes (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.namora_couples(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 140), body text not null default '' check(length(body)<=20000), version integer not null default 1, created_at timestamptz not null default now()
);
create index if not exists namora_notes_couple on public.namora_notes(couple_id);
create table if not exists public.namora_boards (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.namora_couples(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 140), created_at timestamptz not null default now(), unique(id,couple_id)
);
create index if not exists namora_boards_couple on public.namora_boards(couple_id);
create table if not exists public.namora_strokes (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.namora_couples(id) on delete cascade,
 board_id uuid not null, author uuid not null default auth.uid() references auth.users(id),
 points jsonb not null check(jsonb_typeof(points)='array' and jsonb_array_length(points) between 1 and 2000 and octet_length(points::text)<=150000),
 color text not null check(color ~ '^#[0-9a-fA-F]{6}$'), width integer not null check(width between 1 and 30), created_at timestamptz not null default now(),
 foreign key(board_id,couple_id) references public.namora_boards(id,couple_id) on delete cascade
);
create index if not exists namora_strokes_board on public.namora_strokes(board_id,created_at);
create table if not exists public.namora_games (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.namora_couples(id) on delete cascade,
 kind text not null check(kind in ('tic','chess','checkers')), state jsonb not null, version integer not null default 1, updated_at timestamptz not null default now(), unique(couple_id,kind)
);
create table if not exists public.namora_ai_credentials (
 couple_id uuid primary key references public.namora_couples(id) on delete cascade, ciphertext text not null,
 model text not null default 'gemini-3.5-flash', updated_at timestamptz not null default now()
);
alter table public.namora_ai_credentials enable row level security;
revoke all on public.namora_ai_credentials from public,anon,authenticated;
grant all on public.namora_ai_credentials to service_role;
-- Membership and sender checks are evaluated by the database, including after unlink.
do $$ declare t text; begin
 foreach t in array array['namora_messages','namora_notes','namora_boards','namora_strokes','namora_games'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('drop policy if exists couple_read on public.%I',t);
  execute format('create policy couple_read on public.%I for select to authenticated using(couple_id=(select namora_private.couple_id()))',t);
  if t<>'namora_games' then
   execute format('grant insert on public.%I to authenticated',t);
   execute format('drop policy if exists couple_insert on public.%I',t);
   execute format('create policy couple_insert on public.%I for insert to authenticated with check(couple_id=(select namora_private.couple_id()) %s)',t,case when t='namora_messages' then 'and sender=(select auth.uid())' when t='namora_strokes' then 'and author=(select auth.uid())' else '' end);
  end if;
  if t in ('namora_notes','namora_strokes') then
   execute format('grant delete on public.%I to authenticated',t);
   execute format('drop policy if exists couple_delete on public.%I',t);
   execute format('create policy couple_delete on public.%I for delete to authenticated using(couple_id=(select namora_private.couple_id()))',t);
  end if;
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
 end loop;
end $$;
grant update(title,body,version) on public.namora_notes to authenticated;
drop policy if exists couple_update on public.namora_notes;
create policy couple_update on public.namora_notes for update to authenticated using(couple_id=(select namora_private.couple_id())) with check(couple_id=(select namora_private.couple_id()));
-- One atomic per-minute budget before requests to the paid provider.
create or replace function public.namora_ai_budget(target uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer; begin
 insert into namora_private.limits as l(user_id,scope,count,reset_at) values(target,'gemini',1,now()+interval '1 minute')
 on conflict(user_id,scope) do update set count=case when l.reset_at<now() then 1 else l.count+1 end,reset_at=case when l.reset_at<now() then now()+interval '1 minute' else l.reset_at end returning count into n;
 return n<=12;
end $$;
revoke all on function public.namora_ai_budget(uuid) from public,anon,authenticated;
grant usage on schema namora_private to service_role;
grant select,insert,update on namora_private.limits to service_role;
grant execute on function public.namora_ai_budget(uuid) to service_role;
create table if not exists public.namora_finance (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.namora_couples(id) on delete cascade,
 kind text not null check(kind in ('income','budget','debt','goal')), period text not null check(period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
 data jsonb not null check(jsonb_typeof(data)='object' and length(btrim(data->>'title')) between 1 and 140 and octet_length(data::text)<20000), version integer not null default 1, created_at timestamptz not null default now()
);
create index if not exists namora_finance_couple_period on public.namora_finance(couple_id,period);
alter table public.namora_finance enable row level security;
revoke all on public.namora_finance from public,anon,authenticated;
grant select,insert,delete on public.namora_finance to authenticated;
grant update(data,version) on public.namora_finance to authenticated;
grant all on public.namora_finance to service_role;
drop policy if exists couple_read on public.namora_finance;
create policy couple_read on public.namora_finance for select to authenticated using(couple_id=(select namora_private.couple_id()));
drop policy if exists couple_insert on public.namora_finance;
create policy couple_insert on public.namora_finance for insert to authenticated with check(couple_id=(select namora_private.couple_id()));
drop policy if exists couple_update on public.namora_finance;
create policy couple_update on public.namora_finance for update to authenticated using(couple_id=(select namora_private.couple_id())) with check(couple_id=(select namora_private.couple_id()));
drop policy if exists couple_delete on public.namora_finance;
create policy couple_delete on public.namora_finance for delete to authenticated using(couple_id=(select namora_private.couple_id()));
create or replace function namora_private.validate_finance() returns trigger language plpgsql security invoker set search_path='' as $$
declare k text; v text; begin
 if new.data->>'title' is null then raise exception 'Dê um nome ao registro.';end if;
 foreach k in array array['planned','actual','original','balance','installment','remaining','rate','cost','saved','monthly','p1','p2'] loop
  if new.data?k then v:=new.data->>k;if v is null or v !~ '^\d+(\.\d+)?$' or v::numeric>100000000 then raise exception 'Valor financeiro inválido: %',k;end if;end if;
 end loop;
 if new.kind='income' and not(new.data?'planned' and new.data?'actual') or new.kind='budget' and not(new.data?'planned') or new.kind='debt' and not(new.data?'balance' and new.data?'installment') or new.kind='goal' and not(new.data?'cost' and new.data?'saved' and new.data?'monthly') then raise exception 'Preencha os valores do registro.';end if;
 if new.data?'owner' and new.data->>'owner'<>'both' and not exists(select 1 from public.namora_members where couple_id=new.couple_id and user_id::text=new.data->>'owner') then raise exception 'Responsável inválido.';end if;
 return new;
end $$;
drop trigger if exists namora_validate_finance on public.namora_finance;
create trigger namora_validate_finance before insert or update on public.namora_finance for each row execute function namora_private.validate_finance();
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='namora_finance') then alter publication supabase_realtime add table public.namora_finance;end if;end $$;
