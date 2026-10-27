import {getClient} from './supabase';
export type NativeBridge={configureCompanion?:(json:string)=>void;usageSettings?:()=>void;notificationSettings?:()=>void;testSOS?:()=>void;minimize?:()=>void;playMusic?:(json:string)=>void;stopMusic?:()=>void;youtube?:()=>void;cinemaShare?:()=>void;stopCinemaShare?:()=>void;checkWebUpdate?:()=>void;installWebUpdate?:()=>void;webReady?:()=>void;webVersion?:()=>string; biometric?:(enabled:boolean)=>void; savePhoto?:(name:string,base64:string,description:string)=>void;deviceStatus?:()=>string;locationSettings?:()=>void;batterySettings?:()=>void;dial?:(number:string)=>void;configureTracking?:(json:string)=>void;trackingSession?:()=>string;tracking?:(on:boolean,steps:boolean)=>void; configureOverlay?:(json:string)=>void; openExternal?:(url:string)=>void; saveBinary?:(name:string,mime:string,base64:string)=>void; playVoice?:(base64:string)=>void; background?:()=>void; overlay:(on:boolean)=>void; capture:()=>void; speak:(text:string)=>void; listen:()=>void; stopAudio:()=>void; reminders:(json:string)=>void; clearSession:()=>void; openApp:(route:string)=>void; closeOverlay:()=>void; saveFile:(name:string,mime:string,content:string)=>void; };
declare global { interface Window { AmoraAndroid?:NativeBridge } }
export const native=()=>window.AmoraAndroid;
export async function amoraCall(body:Record<string,unknown>){
 const c=getClient();if(!c)throw Error('Entre na sua conta.');
 const {data,error}=await c.functions.invoke('amora',{body});
 if(error){let message='Não foi possível conectar. Tente novamente.';try{const r=await error.context?.json();message=r?.error||message;}catch{}throw Error(message);}
 if(data?.error)throw Error(data.error);return data;
}
export function speak(text:string){if(native())native()!.speak(text);else if('speechSynthesis' in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';speechSynthesis.speak(u);}}

export function saveText(name:string,value:string,type='application/json'){if(native()){native()!.saveFile(name,type,value);return;}const url=URL.createObjectURL(new Blob([value],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
