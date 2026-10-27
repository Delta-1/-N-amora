import {native} from './native';
export async function captureCinemaScreen():Promise<{stream:MediaStream;stop:()=>void}>{
 const bridge=native();
 if(!bridge){
 if(!navigator.mediaDevices?.getDisplayMedia)throw Error('Este navegador não oferece espelhamento. Abra o Amora em um navegador compatível no computador ou use um link direto de vídeo.');
 const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:24,max:30}},audio:true});
 return {stream,stop:()=>stream.getTracks().forEach(t=>t.stop())};
 }
 if(!bridge.cinemaShare||!bridge.stopCinemaShare)throw Error('Instale o APK mais recente para habilitar o espelhamento Android. Você já pode assistir às salas e usar vídeos por link.');
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx||!canvas.captureStream)throw Error('Este Android não oferece o recurso de vídeo necessário.');
 return await new Promise((resolve,reject)=>{
 let settled=false,closed=false,decoding=false,stream:MediaStream|null=null;
 const stop=()=>{if(closed)return;closed=true;clearTimeout(timer);window.removeEventListener('amora-native',receive);bridge.stopCinemaShare!();stream?.getTracks().forEach(t=>t.stop());};
 const fail=(message:string)=>{if(settled){stream?.getVideoTracks().forEach(t=>t.dispatchEvent(new Event('ended')));stop();return;}settled=true;stop();reject(Error(message));};
 const receive=(event:Event)=>{const d=(event as CustomEvent).detail;
 if(d?.cinemaStopped){fail('O compartilhamento de tela foi encerrado.');return;}
 if(d?.cinemaError){fail(d.cinemaError);return;}
 if(!d?.cinemaFrame||closed||decoding)return;decoding=true;
 const image=new Image();image.onload=()=>{if(!closed){if(canvas.width!==image.width||canvas.height!==image.height){canvas.width=image.width;canvas.height=image.height;}ctx.drawImage(image,0,0);if(!settled){stream=canvas.captureStream(12);settled=true;clearTimeout(timer);resolve({stream,stop});}}decoding=false;};image.onerror=()=>{decoding=false;};image.src='data:image/jpeg;base64,'+d.cinemaFrame;};
 const timer=setTimeout(()=>fail('A tela não iniciou. Autorize o compartilhamento e tente novamente.'),60000);
 window.addEventListener('amora-native',receive);bridge.cinemaShare!();
 });
}
