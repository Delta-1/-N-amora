export const appIds=['home','chat','expenses','album','camera','files','games','paint','notes','agenda','history','lists','ideas','map','lilith','community','profile','social-chat','music','whatsapp','about','admin','studio'] as const;
export type AppId=typeof appIds[number];
export type AppPreferences={dock:AppId[];order:AppId[];hidden:AppId[];overlay:string[]};
export const defaults:AppPreferences={dock:['community','social-chat','map','profile'],order:[...appIds],hidden:[],overlay:['lilith','chat','apps']};
export function cleanPreferences(input:any):AppPreferences{const valid=(v:any):AppId[]=>Array.isArray(v)?[...new Set(v.filter((x:any)=>appIds.includes(x)))]:[];const dock=[...valid(input?.dock),...defaults.dock].filter((v,i,a)=>a.indexOf(v)===i).slice(0,4);return{dock,order:[...valid(input?.order),...appIds].filter((v,i,a)=>a.indexOf(v)===i),hidden:valid(input?.hidden).filter(v=>!dock.includes(v)),overlay:[...new Set<string>((Array.isArray(input?.overlay)?input.overlay:defaults.overlay).filter((x:string)=>['lilith','chat','apps','camera'].includes(x)))].slice(0,4)};}
export type Appearance='light'|'dark'|'system';
export function applyAppearance(value:Appearance){const dark=value==='dark'||value==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=dark?'kuromi-dark':'kuromi-light';document.documentElement.style.colorScheme=dark?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#17121f':'#f6f1fc');}
export const MAX_FILE_BYTES=20*1024*1024;
export const safeFilename=(s:string)=>s.replace(/[\x00-\x1f/\\]/g,'_').trim().slice(0,140)||'Arquivo';
export const storageFilename=(s:string)=>safeFilename(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]/g,'_');
export const displayBytes=(n:number)=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
