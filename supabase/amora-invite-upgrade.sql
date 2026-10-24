-- Short invitations retain compatibility with existing 16-character codes.
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
   code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
   insert into public.namora_couples(name,since,invite_hash,invite_expires) values(title,nullif(payload->>'since','')::date,encode(sha256(convert_to(code,'UTF8')),'hex'),now()+interval '24 hours') returning id into cid;
   insert into public.namora_members(user_id,couple_id,slot,name) values(uid,cid,1,pname);
   return jsonb_build_object('ok',true,'code',code);
  else
   code:=upper(regexp_replace(payload->>'code','[\s-]','','g'));
   if code is null or code !~ '^([A-F0-9]{10}|[A-F0-9]{16})$' then return jsonb_build_object('error','O convite tem 10 letras e números.'); end if;
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
  code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
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
