import {getClient} from './supabase';
export type NativeBridge={ overlay:(on:boolean)=>void; capture:()=>void; speak:(text:string)=>void; listen:()=>void; stopAudio:()=>void; reminders:(json:string)=>void; clearSession:()=>void; openApp:(route:string)=>void; closeOverlay:()=>void; };
declare global { interface Window { AmoraAndroid?:NativeBridge } }
export const native=()=>window.AmoraAndroid;
export async function amoraCall(body:Record<string,unknown>){
 const c=getClient();if(!c)throw Error('Entre na sua conta.');
 const {data,error}=await c.functions.invoke('amora',{body});
 if(error){let message='Não foi possível conectar. Tente novamente.';try{const r=await error.context?.json();message=r?.error||message;}catch{}throw Error(message);}
 if(data?.error)throw Error(data.error);return data;
}
export function speak(text:string){if(native())native()!.speak(text);else if('speechSynthesis' in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';speechSynthesis.speak(u);}}
