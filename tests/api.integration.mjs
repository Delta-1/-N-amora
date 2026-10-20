import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
const root=path.resolve(import.meta.dirname,'..');
const serverDir=path.join(root,'dist/server');
const files=await readdir(serverDir,{recursive:true});
const modules=files.filter(f=>f.endsWith('.js')||f.endsWith('.mjs')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b)).map(f=>({type:'ESModule',path:path.join(serverDir,f)}));
const mf=new Miniflare({modules,modulesRoot:serverDir,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'namora-integration-test'},cf:false});
try{
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir(path.join(root,'drizzle'))).filter(f=>f.endsWith('.sql')).sort()){
  const sql=await readFile(path.join(root,'drizzle',file),'utf8');
  for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await db.prepare(statement.trim()).run();
 }
 let checks=0;const ok=(condition,message)=>{assert.ok(condition,message);checks++;console.log('PASS',message);};
 const call=async(user,route='/api/state',body)=>{const headers={};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=`${user}@example.test`;}
  if(body)headers['Content-Type']='application/json';const res=await mf.dispatchFetch('https://namora.test'+route,{headers,method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});let data;const text=await res.text();try{data=JSON.parse(text);}catch{throw new Error(`${res.status}: ${text.slice(0,1500)}`);}return{status:res.status,data};};
 const action=(u,body)=>call(u,'/api/action',body);
 ok((await call(null)).status===401,'anonymous requests are rejected');
 ok((await call('alice')).data.couple===null,'new accounts start without demo records');
 const created=await action('alice',{action:'create',name:'Alice',title:'Our world',since:'2026-01-01'});
 ok(created.status===200&&created.data.code.length===12,'create link returns a strong invitation');
 const code=created.data.code;
 ok((await action('bob',{action:'join',name:'Bob',code})).status===200,'second account joins by invitation');
 ok((await action('mallory',{action:'join',name:'Mallory',code})).status!==200,'a third account cannot join');
 ok((await action('alice',{action:'create',name:'Alice',title:'Another world'})).status===409,'one account cannot create multiple active links');
 const data={kind:'task',title:'Shared task',due:null,done:false,assignee:'both',category:'Casa'};
 ok((await action('alice',{action:'save',data})).status===200,'member can add a shared task');
 const bob=await call('bob');const task=bob.data.items[0];
 ok(task.data.title==='Shared task','partner receives shared data');
 ok((await call('mallory')).data.items.length===0,'unlinked accounts cannot read couple data');
 await action('mallory',{action:'create',name:'Mallory',title:'Other couple'});
 ok((await action('mallory',{action:'save',id:task.id,version:1,data:{...data,title:'Hijacked'}})).status===409,'other couples cannot edit a known record ID');
 ok((await action('bob',{action:'save',id:task.id,version:1,data:{...data,done:true}})).status===200,'partner can complete shared task');
 ok((await action('alice',{action:'save',id:task.id,version:1,data})).status===409,'stale updates are rejected instead of overwriting partner changes');
 ok((await action('alice',{action:'save',data:{kind:'expense',title:'Invalid',cents:-100,date:'2026-10-20',category:'Casa',payer:'alice',shared:true}})).status===400,'negative expenses are rejected');
 ok((await action('alice',{action:'save',data:{kind:'expense',title:'Invalid payer',cents:100,date:'2026-10-20',category:'Casa',payer:'mallory',shared:true}})).status===400,'expense payer must belong to the couple');
 ok((await action('bob',{action:'location',enabled:true,latitude:-10,longitude:-68,accuracy:12})).status===200,'users can share their own location');
 ok((await call('alice')).data.locations[0].userId==='bob','partner sees consented location');
 ok((await call('mallory')).data.locations.length===0,'other couples cannot read coordinates');
 await action('bob',{action:'location',enabled:false});
 ok((await call('alice')).data.locations.length===0,'pausing sharing removes the coordinates');
 const chat=await call('alice','/api/lilith',{message:'organizar tarefas'});
 ok(chat.status===200&&chat.data.mode==='local'&&chat.data.reply.length>20,'Lilith has an honest local fallback without an API key');
 await action('bob',{action:'leave'});
 ok((await call('bob')).data.items.length===0,'leaving a link revokes access');
 console.log(`\n${checks} integration checks passed.`);
}finally{await mf.dispose();}
