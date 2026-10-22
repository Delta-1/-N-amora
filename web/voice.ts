import {amoraCall,native} from './native';
let player:HTMLAudioElement|null=null,url='',generation=0;
const speaking=(v:boolean)=>window.dispatchEvent(new CustomEvent('amora-native',{detail:{speaking:v}}));
export function stopVoice(){generation++;native()?.stopAudio();player?.pause();player=null;if(url)URL.revokeObjectURL(url);url='';speaking(false);}
export async function playVoice(text:string){stopVoice();const ticket=generation,r=await amoraCall({action:'voice',text:text.slice(0,4000)});if(ticket!==generation)return;if(native()?.playVoice){native()!.playVoice!(r.audio);return;}const bytes=Uint8Array.from(atob(r.audio),(c:string)=>c.charCodeAt(0));url=URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}));player=new Audio(url);player.onplaying=()=>speaking(true);player.onended=()=>stopVoice();player.onerror=()=>stopVoice();try{await player.play();}catch{stopVoice();throw Error('Toque em Ouvir para reproduzir a resposta.');}}
