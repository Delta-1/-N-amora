type Context={db:any;cid:string;uid:string;admin:boolean;encrypt:(s:string)=>Promise<string>;decrypt:(s:string)=>Promise<string>;reply:(d:unknown,s?:number)=>Response};
const cache=new Map<string,{until:number;items:unknown[]}>();
export async function handleMusic(body:any,{db,cid,admin,encrypt,decrypt,reply}:Context){
 if(!['music-config-status','music-save-key','music-search'].includes(body.action))return null;
 if(body.action==='music-save-key'){
  if(!admin)return reply({error:'Somente o administrador configura a pesquisa.'},403);
  const key=String(body.key||'').trim();if(!key){const r=await db.from('namora_music_app').delete().eq('id',true);if(r.error)throw r.error;cache.clear();return reply({ready:false});}
  if(!/^AIza[A-Za-z0-9_-]{25,100}$/.test(key))return reply({error:'Confira a chave da YouTube Data API v3.'},400);
  const test=await fetch('https://www.googleapis.com/youtube/v3/videos?part=id&id=jfKfPfyJRdk',{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(15000)});if(!test.ok)return reply({error:'O Google recusou a chave. Ative a YouTube Data API v3 e confira as restrições.'},400);
  const r=await db.from('namora_music_app').upsert({id:true,ciphertext:await encrypt(key),updated_at:new Date().toISOString()});if(r.error)throw r.error;cache.clear();return reply({ready:true});
 }
 const r=await db.from('namora_music_app').select('ciphertext').eq('id',true).maybeSingle();if(r.error)throw r.error;
 if(body.action==='music-config-status')return reply({ready:!!r.data});
 if(!r.data)return reply({error:'A busca por nome precisa ser habilitada pelo administrador. Você já pode adicionar links do YouTube.',needsSetup:true},409);
 const q=String(body.query||'').trim();if(q.length<2||q.length>100)return reply({error:'Digite de 2 a 100 caracteres.'},400);
 const budget=await db.rpc('namora_ai_budget',{target:cid});if(budget.error||!budget.data)return reply({error:'Aguarde um minuto antes de pesquisar novamente.'},429);
 const ck=q.toLocaleLowerCase(),hit=cache.get(ck);if(hit&&hit.until>Date.now())return reply({items:hit.items});
 const params=new URLSearchParams({part:'snippet',q,type:'video',videoEmbeddable:'true',videoSyndicated:'true',maxResults:'6',safeSearch:'moderate'});
 const response=await fetch('https://www.googleapis.com/youtube/v3/search?'+params,{headers:{'x-goog-api-key':await decrypt(r.data.ciphertext)},signal:AbortSignal.timeout(15000)});
 if(!response.ok)return reply({error:'A pesquisa do YouTube não respondeu. A cota pode ter terminado; tente um link direto.'},502);
 const data=await response.json();const items=(data.items||[]).filter((x:any)=>/^[A-Za-z0-9_-]{11}$/.test(x.id?.videoId)).map((x:any)=>({id:x.id.videoId,title:String(x.snippet?.title||'Música').slice(0,200),channel:String(x.snippet?.channelTitle||'').slice(0,100)}));
 if(cache.size>100)cache.clear();cache.set(ck,{until:Date.now()+300000,items});return reply({items});
}
