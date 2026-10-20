import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=new PGlite();let checks=0;
function ok(value,message){assert.ok(value,message);checks++;console.log('PASS',message);}
const alice='10000000-0000-4000-8000-000000000001',bob='10000000-0000-4000-8000-000000000002',mallory='10000000-0000-4000-8000-000000000003';
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;grant usage on schema auth to authenticated;`);
 const schema=await readFile(new URL('../supabase/namora-install.sql',import.meta.url),'utf8');await db.exec(schema);await db.exec(schema);ok(true,'installation is additive and repeatable');
 await db.query('insert into auth.users(id) values($1),($2),($3)',[alice,bob,mallory]);
 const as=async(uid)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[uid,JSON.stringify({sub:uid,is_anonymous:false})]);await db.exec('set role authenticated');};
 const action=async(payload)=>(await db.query('select public.namora_action($1::jsonb) as value',[JSON.stringify(payload)])).rows[0].value;
 await db.exec('set role anon');await assert.rejects(()=>action({action:'create',name:'No',title:'No'}));ok(true,'anonymous role cannot execute the app RPC');
 await as(alice);const created=await action({action:'create',name:'Alice',title:'Our world',since:'2025-01-01'});ok(created.ok&&created.code.length===16,'authenticated user creates link and invitation');
 await as(bob);ok((await action({action:'join',name:'Bob',code:created.code})).ok,'second user joins by code');
 await as(mallory);ok(!!(await action({action:'join',name:'Mallory',code:created.code})).error,'used invitation cannot be reused by a third user');
 await as(alice);await assert.rejects(()=>action({action:'create',name:'Alice',title:'Other'}));ok(true,'one account cannot belong to multiple active links');
 const task={kind:'task',title:'Shared task',due:null,done:false,assignee:'both',category:'Casa'};await action({action:'save',data:task});
 await as(bob);let rows=(await db.query('select * from public.namora_records')).rows;ok(rows.length===1&&rows[0].data.title==='Shared task','partner reads shared record through RLS');const id=rows[0].id;
 await action({action:'save',id,version:1,data:{...task,done:true}});ok((await db.query('select version from public.namora_records')).rows[0].version===2,'partner can edit records with matching version');
 await as(alice);await assert.rejects(()=>action({action:'save',id,version:1,data:task}));ok(true,'stale updates are rejected');
 await assert.rejects(()=>db.query("update public.namora_members set couple_id=gen_random_uuid()"));ok(true,'direct table writes cannot reassign membership');
 await as(mallory);ok((await db.query('select * from public.namora_records')).rows.length===0,'unlinked users see no records');await action({action:'create',name:'Mallory',title:'Different pair'});await assert.rejects(()=>action({action:'delete',id,version:2}));ok(true,'another couple cannot delete a known record ID');
 await as(alice);await assert.rejects(()=>action({action:'save',data:{kind:'expense',title:'Wrong payer',cents:100,date:'2026-10-20',category:'Casa',payer:mallory,shared:true}}));ok(true,'payer must belong to the couple');
 await assert.rejects(()=>action({action:'save',data:{kind:'expense',title:'Negative',cents:-100,date:'2026-10-20',category:'Casa',payer:alice,shared:true}}));ok(true,'negative expenses are rejected');
 await action({action:'save',data:{kind:'milestone',title:'First met',date:'2025-02-28',category:'Nos conhecemos',note:'Our memory',annual:true,remind:true}});ok((await db.query("select * from public.namora_records where kind='milestone'")).rows.length===1,'relationship milestones save with annual reminder fields');
 await action({action:'save',data:{kind:'idea',title:'Our idea',description:'A picnic',category:'Ao ar livre',saved:true,done:false}});ok((await db.query("select * from public.namora_records where kind='idea'")).rows.length===1,'ideas can be saved in shared records');
 await action({action:'activity',activity:'Estudando'});ok((await db.query('select activity from public.namora_members where user_id=$1',[alice])).rows[0].activity==='Estudando','activity status is voluntarily set by its owner');
 await assert.rejects(()=>action({action:'activity',activity:'Arbitrary'}));ok(true,'unsupported activity values are rejected');
 await as(bob);await action({action:'location',enabled:true,latitude:-10,longitude:-68,accuracy:20});await as(alice);ok((await db.query('select * from public.namora_locations')).rows[0].user_id===bob,'partner reads consented location');
 await as(mallory);ok((await db.query('select * from public.namora_locations')).rows.length===0,'location is hidden from other couples');
 await as(bob);await action({action:'location',enabled:false});await as(alice);ok((await db.query('select * from public.namora_locations')).rows.length===0,'pausing removes the saved position');
 await as(bob);await action({action:'leave'});ok((await db.query('select * from public.namora_records')).rows.length===0,'leaving revokes access to all shared records');
 for(let i=0;i<9;i++)await action({action:'join',name:'Bob',code:'0000000000000000'});ok((await action({action:'join',name:'Bob',code:'0000000000000000'})).error.includes('Muitas'),'invalid invitation attempts count towards rate limit');
 console.log(`\n${checks} PostgreSQL/RLS checks passed (local PGlite).`);
}finally{await db.close();}
