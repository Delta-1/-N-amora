import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const db=new PGlite();let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS',m);};
const ids=Array.from({length:6},(_,i)=>'10000000-0000-4000-8000-00000000000'+(i+1)),[a,b,c,d,e,f]=ids;
try{
await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon,service_role;grant all on storage.objects,storage.buckets to authenticated,anon,service_role;");
for(const id of ids)await db.query('insert into auth.users values($1,$2,now())',[id,id+'@example.test']);
for(const path of ['supabase/namora-install.sql','supabase/amora-mobile-upgrade.sql','supabase/amora-community-upgrade.sql','supabase/amora-cinema-library-upgrade.sql'])await db.exec(await fs.readFile(path,'utf8'));
await db.exec(await fs.readFile('supabase/amora-cinema-library-upgrade.sql','utf8'));ok(true,'cinema and library upgrade is repeatable');
const as=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
const action=async p=>(await db.query('select namora_action($1::jsonb) v',[JSON.stringify(p)])).rows[0].v;
const rpc=async p=>(await db.query('select namora_cinema($1::jsonb) v',[JSON.stringify(p)])).rows[0].v;
const couples=[];
for(const [first,second]of [[a,b],[c,d],[e,f]]){await as(first);const inv=await action({action:'create',name:'Person',title:'Couple'});couples.push((await db.query('select couple_id from namora_members where user_id=$1',[first])).rows[0].couple_id);await as(second);await action({action:'join',name:'Partner',code:inv.code});}
const [ab,cd,ef]=couples,ca='20000000-0000-4000-8000-000000000001',cb='20000000-0000-4000-8000-000000000002',cc='20000000-0000-4000-8000-000000000003',cdclient='20000000-0000-4000-8000-000000000004';
await db.exec('reset role');await db.query("insert into namora_social_friends(a,b,requested_by,status) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid),$1,'accepted')",[ab,cd]);
await as(a);const room=await rpc({action:'create',title:'Our Cinema',client:ca}),rid=room.id;
const call=(p,client=ca)=>rpc({...p,id:rid,client});
await as(e);ok((await rpc({})).length===0,'uninvited couples cannot discover private rooms');await assert.rejects(()=>call({action:'join'},cc));ok(true,'a room id never bypasses invitations');
await as(a);await assert.rejects(()=>call({action:'invite',couple:ef}));await call({action:'invite',couple:cd});
await as(c);ok((await rpc({})).length===1,'accepted friends see their invitation');await assert.rejects(()=>call({action:'message',body:'Not joined'},cc));await call({action:'join'},cc);ok(true,'an invitation requires explicit joining before chat or signaling');
await as(b);await call({action:'join'},cb);await assert.rejects(()=>call({action:'media',mode:'screen'},cb));ok(true,'the partner cannot silently start the host screen');
await as(a);const screen=await call({action:'media',mode:'screen'});await call({action:'signal',target:c,epoch:screen.epoch,signal:{type:'offer',sdp:{type:'offer',sdp:'test'}}});
await as(c);let data=await call({action:'poll'},cc);ok(data.signals.length===1&&data.signals[0].sender===a,'screen signaling only reaches the invited recipient');await assert.rejects(()=>call({action:'signal',target:b,epoch:screen.epoch,signal:{type:'offer',sdp:'no'}},cc));await assert.rejects(()=>call({action:'signal',target:a,epoch:screen.epoch,signal:{}},cc));await assert.rejects(()=>db.query('select * from namora_cinema_signals'));await assert.rejects(()=>db.query('select * from namora_drive_app'));ok(true,'guests cannot signal each other or read raw signaling tables');
await call({action:'message',body:'Hello cinema'},cc);await as(a);ok((await call({action:'poll'})).messages[0].body==='Hello cinema','room chat reaches its participants');
await assert.rejects(()=>call({action:'media',mode:'video',url:'javascript:alert(1)'}));const movie=await call({action:'media',mode:'video',url:'https://example.com/film.mp4'});await call({action:'playback',epoch:movie.epoch,playing:true,position:21});
await as(c);await assert.rejects(()=>call({action:'playback',epoch:movie.epoch,playing:false,position:0},cc));ok((await call({action:'poll'},cc)).room.position===21,'only host playback changes the shared timeline');
await call({action:'join'},cdclient);await assert.rejects(()=>call({action:'poll'},cc));ok(true,'a second tab replaces the first signaling session');
await as(a);await call({action:'revoke',couple:cd});await as(c);await assert.rejects(()=>call({action:'poll'},cdclient));ok((await rpc({})).length===0,'revoking an invitation immediately removes server access');
await as(a);await call({action:'invite',couple:cd});await as(c);await call({action:'join'},cc);await db.exec('reset role');await db.query('insert into namora_social_blocks values($1,$2)',[cd,ab]);await as(c);await assert.rejects(()=>call({action:'poll'},cc));ok(true,'blocking either couple revokes room access even with an old invitation');
await as(a);await call({action:'leave'});await as(b);await assert.rejects(()=>call({action:'poll'},cb));ok((await rpc({})).length===0,'host leaving closes the room for everyone');
const file='30000000-0000-4000-8000-000000000001';await as(a);
await db.query("insert into namora_files(id,couple_id,creator,name,path,mime,bytes,kind,folder,taken_at) values($1,$2,$3,'=not a formula.pdf',$4,'application/pdf',123,'file','Livros','2024-01-01')",[file,ab,a,ab+'/'+file+'/book.pdf']);
await db.exec('reset role');await db.query("update namora_files set drive_id='google-file',drive_owner=$1,catalogued_at=now() where id=$2",[a,file]);await as(b);await db.query("update namora_files set caption='Author' where id=$1",[file]);ok((await db.query('select catalogued_at from namora_files where id=$1',[file])).rows[0].catalogued_at===null,'metadata changes mark the spreadsheet as pending');
await assert.rejects(()=>db.query("update namora_files set drive_owner=$1 where id=$2",[b,file]));ok(true,'clients cannot forge Drive destinations or catalog success');
await as(e);ok((await db.query('select * from namora_files where id=$1',[file])).rows.length===0,'books and photos remain private to the couple');
await db.exec('reset role;set role anon');await assert.rejects(()=>rpc({}));ok(true,'anonymous access is denied');
console.log(n+' cinema/library database checks passed');
}finally{await db.close();}
