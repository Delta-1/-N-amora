type Context={db:any;cid:string;uid:string;encrypt:(s:string)=>Promise<string>;decrypt:(s:string)=>Promise<string>;reply:(b:unknown,s?:number)=>Response};
const redirectUri='https://delta-1.github.io/-N-amora/docs/drive-callback.html';
const check=(r:any)=>{if(r.error)throw Error('Não foi possível atualizar a biblioteca.');return r.data;};
const need=(v:any,m:string)=>{if(!v)throw Error(m);};
const request=(url:string,init:RequestInit={})=>fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(45000)});
const hex=(b:Uint8Array)=>Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const digest=async(v:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
const b64=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function driveLibrary(body:any,c:Context):Promise<Response|null>{
 if(!String(body.action).startsWith('drive-'))return null;
 const {db,cid,uid,encrypt,decrypt,reply}=c;
 const row=check(await db.from('namora_integrations').select('ciphertext,updated_at').eq('couple_id',cid).eq('provider','drive').maybeSingle());
 let d:any=row?JSON.parse(await decrypt(row.ciphertext)):{},revision=row?.updated_at;
 // Preserve the original shared connection until its owner reconnects explicitly.
 if(d.refreshToken){d.accounts={...d.accounts,legacy:{accessToken:d.accessToken,refreshToken:d.refreshToken,expiresAt:d.expiresAt,folderId:d.folderId,label:'Drive conectado anteriormente'}};d.active=d.active||'legacy';delete d.refreshToken;delete d.accessToken;delete d.expiresAt;delete d.folderId;}
 d.accounts||={};
 const save=async()=>{const value={ciphertext:await encrypt(JSON.stringify(d)),updated_at:new Date().toISOString()};const r=revision?check(await db.from('namora_integrations').update(value).eq('couple_id',cid).eq('provider','drive').eq('updated_at',revision).select('updated_at').maybeSingle()):check(await db.from('namora_integrations').insert({...value,couple_id:cid,provider:'drive'}).select('updated_at').single());need(r,'O Drive mudou em outra tela. Tente novamente.');revision=r.updated_at;};
 const members=check(await db.from('namora_members').select('user_id,name').eq('couple_id',cid));
 // Connections left by a former member are never used for new uploads.
 const allowed=(id:string)=>id==='legacy'||members.some((m:any)=>m.user_id===id);
 const status=()=>{const active=allowed(d.active)?d.accounts[d.active]:null;return{configured:!!d.clientId,connected:!!active?.refreshToken,owner:active?d.active:null,folderId:active?.folderId||null,sheetId:active?.sheetId||null,redirectUri,accounts:Object.entries(d.accounts).filter(([id])=>allowed(id)).map(([id,a]:[string,any])=>({id,label:a.label||members.find((m:any)=>m.user_id===id)?.name||'Google Drive',email:a.email||'',selected:id===d.active,canDisconnect:id===uid||id==='legacy'}))};};
 try{
 if(body.action==='drive-status')return reply(status());
 if(body.action==='drive-config'){
 const clientId=String(body.clientId||'').trim(),clientSecret=String(body.clientSecret||'').trim();
 need(/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId)&&clientId.length<300&&clientSecret.length>=8&&clientSecret.length<=500,'Confira as credenciais OAuth do Google.');
 d={clientId,clientSecret,accounts:{}};await save();return reply({ok:true});
 }
 if(body.action==='drive-select'){
 const owner=String(body.owner||'');need(allowed(owner)&&d.accounts[owner]?.refreshToken,'Este Drive não está conectado ao vínculo.');d.active=owner;await save();return reply({ok:true});
 }
 if(body.action==='drive-disconnect'){
 const owner=String(body.owner||uid);need(owner===uid||owner==='legacy','Cada pessoa pode desconectar somente sua própria conta.');
 delete d.accounts[owner];if(d.active===owner)d.active=Object.keys(d.accounts).find(allowed)||null;await save();return reply({ok:true});
 }
 if(body.action==='drive-connect'){
 need(d.clientId,'Configure o aplicativo Google uma vez nas opções avançadas.');
 const state=random(),verifier=random();
 check(await db.rpc('namora_oauth_state',{payload:{hash:hex(await digest(state)),couple:cid,user:uid,verifier:await encrypt(verifier)},consume:false}));
 return reply({url:'https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:d.clientId,redirect_uri:redirectUri,response_type:'code',scope:'https://www.googleapis.com/auth/drive.file',access_type:'offline',prompt:'consent select_account',state,code_challenge:b64(await digest(verifier)),code_challenge_method:'S256'})});
 }
 if(body.action==='drive-complete'){
 const state=String(body.state||''),code=String(body.code||'');need(/^[a-f0-9]{64}$/.test(state)&&code.length>=10&&code.length<=4000,'Autorização inválida. Conecte novamente.');
 const pending=check(await db.rpc('namora_oauth_state',{payload:{hash:hex(await digest(state)),couple:cid,user:uid},consume:true}));need(pending?.verifier&&d.clientId,'A autorização expirou. Conecte novamente.');
 const r=await request('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({code,client_id:d.clientId,client_secret:d.clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code',code_verifier:await decrypt(pending.verifier)})});
 need(r.ok,'O Google não concluiu a autorização. Confira as credenciais.');const token=await r.json();need(token.refresh_token,'Autorize o acesso offline ao Google Drive.');
 const about=await request('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)',{headers:{Authorization:'Bearer '+token.access_token}});
 need(about.ok,'Não foi possível identificar o Drive autorizado.');const info=(await about.json()).user;
 // Reauthorizing the same account preserves its folder and catalogue.
 const old=d.accounts[uid],same=old?.email&&old.email===info?.emailAddress;
 d.accounts[uid]={...(same?old:{}),accessToken:token.access_token,refreshToken:token.refresh_token,expiresAt:Date.now()+token.expires_in*1000,email:info?.emailAddress||'',label:(members.find((m:any)=>m.user_id===uid)?.name||info?.displayName||'Meu Drive')+' · Google Drive'};
 d.active=uid;await save();return reply({ok:true});
 }
 if(body.action!=='drive-backup')return reply({error:'Ação de Drive inválida.'},400);
 const owner=d.active,a=d.accounts[owner];need(allowed(owner)&&a?.refreshToken,'Conecte e escolha um Google Drive na Biblioteca.');
 let f=check(await db.from('namora_files').select('*').eq('couple_id',cid).eq('id',body.id).maybeSingle());need(f,'Arquivo não encontrado.');
 const lease=check(await db.rpc('namora_drive_lock',{file_id:f.id,target:cid}));need(lease,'Este arquivo já está sincronizando. Aguarde.');
 try{
 if(!a.accessToken||a.expiresAt<Date.now()+60000){
 const r=await request('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:d.clientId,client_secret:d.clientSecret,refresh_token:a.refreshToken,grant_type:'refresh_token'})});
 need(r.ok,'Reconecte o Drive selecionado.');const t=await r.json();Object.assign(a,{accessToken:t.access_token,expiresAt:Date.now()+t.expires_in*1000});await save();
 }
 const headers={Authorization:'Bearer '+a.accessToken};
 const google=async(url:string,init:RequestInit={})=>{const r=await request(url,{...init,headers:{...headers,...init.headers}});need(r.ok,url.includes('sheets.googleapis.com')?'O arquivo está no Drive, mas falta registrar na planilha. Ative a API Google Sheets e tente novamente.':'O Google não concluiu o pedido. Confira espaço e autorização.');return await r.json();};
 const drive=(p:string,i:RequestInit={})=>google('https://www.googleapis.com/drive/v3/'+p,i);
 const json=(v:any)=>({'Content-Type':'application/json'});
 async function findOrCreate(name:string,kind:string,mime:string,parent?:string){
 const q="trashed=false and appProperties has { key='amoraCouple' and value='"+cid+"' } and appProperties has { key='amoraKind' and value='"+kind+"' }";
 const list=await drive('files?'+new URLSearchParams({q,fields:'files(id)',pageSize:'1'}));if(list.files?.[0]?.id)return list.files[0].id;
 return(await drive('files?fields=id',{method:'POST',headers:json(null),body:JSON.stringify({name,mimeType:mime,...(parent?{parents:[parent]}:{}),appProperties:{amoraCouple:cid,amoraKind:kind}})})).id;
 }
 if(!a.folderId){a.folderId=await findOrCreate('Amora · Biblioteca do casal','library-root','application/vnd.google-apps.folder');await save();}
 const year=new Date(f.taken_at||f.created_at).getFullYear(),folderKind=f.kind==='photo'?'photos-'+year:f.folder==='Livros'?'books':'documents';
 const parent=await findOrCreate(f.kind==='photo'?'Álbum '+year:f.folder==='Livros'?'Livros':'Documentos',folderKind,'application/vnd.google-apps.folder',a.folderId);
 let fileId=f.drive_owner===owner?f.drive_id:null;
 if(!fileId){const old=await drive('files?'+new URLSearchParams({q:"trashed=false and appProperties has { key='amoraId' and value='"+f.id+"' }",fields:'files(id)',pageSize:'1'}));fileId=old.files?.[0]?.id;}
 if(!fileId){
 const blob=check(await db.storage.from('amora-private').download(f.path));
 const start=await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{method:'POST',headers:{...headers,'Content-Type':'application/json','X-Upload-Content-Type':f.mime,'X-Upload-Content-Length':String(f.bytes)},body:JSON.stringify({name:f.name,parents:[parent],description:'Amora · '+f.folder+' · '+f.caption,appProperties:{amoraId:f.id,amoraCouple:cid}})});
 need(start.ok,'Não foi possível iniciar o envio ao Drive.');const location=start.headers.get('location')||'';
 need(location.startsWith('https://www.googleapis.com/'),'O Drive retornou um endereço inválido.');
 const uploaded=await request(location,{method:'PUT',headers:{...headers,'Content-Type':f.mime},body:blob});need(uploaded.ok,'Não foi possível enviar o arquivo ao Drive.');fileId=(await uploaded.json()).id;
 }
 need(fileId,'O Drive não confirmou o arquivo.');
 const currentFile=await drive('files/'+encodeURIComponent(fileId)+'?fields=parents');
 const oldParents=(currentFile.parents||[]).filter((p:string)=>p!==parent);
 await drive('files/'+encodeURIComponent(fileId)+'?'+new URLSearchParams({addParents:parent,...(oldParents.length?{removeParents:oldParents.join(',')}:{})}),{method:'PATCH',headers:json(null),body:JSON.stringify({name:f.name,description:'Amora · '+f.folder+' · '+f.caption})});
 check(await db.from('namora_files').update({drive_id:fileId,drive_owner:owner,drive_at:new Date().toISOString(),catalogued_at:null}).eq('id',f.id).eq('couple_id',cid));
 if(!a.sheetId){
 // Creating through Drive places the spreadsheet in the selected private folder.
 a.sheetId=await findOrCreate('Amora · Catálogo da biblioteca','catalogue','application/vnd.google-apps.spreadsheet',a.folderId);await save();
 }
 const sheet='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(a.sheetId);
 if(!a.sheetTitle){const info=await google(sheet+'?fields=sheets.properties.title');a.sheetTitle=info.sheets[0].properties.title;await save();}
 const range="'"+String(a.sheetTitle).replace(/'/g,"''")+"'";
 const cat=await google(sheet+'/values/'+encodeURIComponent(range+'!A:K'));
 const rows=cat.values||[],at=rows.findIndex((r:any[])=>r[0]===f.id);
 if(!rows.length)await google(sheet+'/values/'+encodeURIComponent(range+'!A1:K1')+'?valueInputOption=RAW',{method:'PUT',headers:json(null),body:JSON.stringify({values:[['ID','Título','Tipo','Pasta','Data do momento','Enviado em','Enviado por','Descrição','Arquivo no Drive','Bytes','Formato']]})});
 const values=[[f.id,f.name,f.kind==='photo'?'Foto':f.folder==='Livros'?'Livro':'Arquivo',f.folder,f.taken_at||f.created_at,f.created_at,members.find((m:any)=>m.user_id===f.creator)?.name||'Integrante',f.caption,'https://drive.google.com/file/d/'+fileId+'/view',f.bytes,f.mime]];
 if(at>=0)await google(sheet+'/values/'+encodeURIComponent(range+'!A'+(at+1)+':K'+(at+1))+'?valueInputOption=RAW',{method:'PUT',headers:json(null),body:JSON.stringify({values})});
 else await google(sheet+'/values/'+encodeURIComponent(range+'!A:K')+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{method:'POST',headers:json(null),body:JSON.stringify({values})});
 check(await db.from('namora_files').update({catalogued_at:new Date().toISOString()}).eq('id',f.id).eq('couple_id',cid));
 return reply({ok:true,id:fileId,catalogued:true});
 }finally{await db.from('namora_files').update({drive_lock_until:null}).eq('id',f.id).eq('couple_id',cid);}
 }catch(e){return reply({error:(e as Error).message||'Não foi possível sincronizar o Drive.'},400);}
}
