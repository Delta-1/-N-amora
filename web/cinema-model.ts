export type CinemaRoom={id:string;title:string;host_id:string;host_couple:string;host_name?:string;mode:'idle'|'screen'|'video';media_url:string;playing:boolean;position:number;updated_at:string;epoch:string};
export type CinemaPerson={user_id:string;couple_id:string;client_id:string;name:string};
export function movieUrl(value:string){try{const u=new URL(value.trim());if(u.protocol!=='https:'||u.username||u.password||u.href.length>2000||!/\.(mp4|webm)$/i.test(u.pathname))return '';return u.href;}catch{return '';}}
export function playbackPosition(room:Pick<CinemaRoom,'playing'|'position'|'updated_at'>,serverNow:number,duration=Infinity){const extra=room.playing?Math.max(0,(serverNow-Date.parse(room.updated_at))/1000):0;return Math.max(0,Math.min(Number.isFinite(duration)?duration:864000,room.position+extra));}
export class CinemaPeers{
 peers=new Map<string,{pc:RTCPeerConnection;client:string;ice:RTCIceCandidateInit[]}>();stream:MediaStream|null=null;epoch='';closed=false;
 constructor(public self:string,public host:string,public config:RTCConfiguration,public send:(target:string,signal:unknown,epoch:string)=>Promise<unknown>,public onRemote:(stream:MediaStream|null)=>void,public onState:(value:string)=>void){}
 context(epoch:string){if(epoch!==this.epoch){this.clear();this.epoch=epoch;}}
 clear(){for(const entry of this.peers.values()){entry.pc.onicecandidate=null;entry.pc.ontrack=null;entry.pc.onconnectionstatechange=null;entry.pc.close();}this.peers.clear();this.onRemote(null);}
 stop(){this.closed=true;this.clear();this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;}
 async peer(person:CinemaPerson){const old=this.peers.get(person.user_id);if(old?.client===person.client_id)return old;
 if(old)old.pc.close();const pc=new RTCPeerConnection(this.config),entry={pc,client:person.client_id,ice:[] as RTCIceCandidateInit[]},epoch=this.epoch;this.peers.set(person.user_id,entry);
 pc.onicecandidate=e=>{if(e.candidate&&!this.closed&&this.epoch===epoch)void this.send(person.user_id,{type:'ice',candidate:e.candidate.toJSON()},epoch).catch(()=>this.onState('Não foi possível enviar um sinal da transmissão.'));};
 pc.ontrack=e=>{if(!this.closed&&this.epoch===epoch)this.onRemote(e.streams[0]||new MediaStream([e.track]));};
 pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected')this.onState('Ao vivo');if(pc.connectionState==='failed')this.onState('A rede não conectou o vídeo. Tente reconectar; algumas redes precisam de TURN.');};
 if(this.self===this.host&&this.stream){for(const track of this.stream.getTracks())pc.addTrack(track,this.stream);await pc.setLocalDescription(await pc.createOffer());if(!this.closed&&this.epoch===epoch)await this.send(person.user_id,{type:'offer',sdp:pc.localDescription},epoch);}
 return entry;}
 async sync(people:CinemaPerson[]){const active=people.filter(p=>p.user_id!==this.self&&(this.self===this.host||p.user_id===this.host));for(const [id,e]of this.peers){if(!active.some(p=>p.user_id===id&&p.client_id===e.client)){e.pc.close();this.peers.delete(id);}}
 if(this.self===this.host&&this.stream)for(const p of active)await this.peer(p);}
 async receive(signal:any,people:CinemaPerson[]){if(this.closed||signal.epoch!==this.epoch)return;const person=people.find(p=>p.user_id===signal.sender&&p.client_id===signal.sender_client);if(!person||person.user_id===this.self||(this.self!==this.host&&person.user_id!==this.host))return;
 const e=await this.peer(person),s=signal.payload;
 if(s.type==='ice'){if(e.pc.remoteDescription)await e.pc.addIceCandidate(s.candidate);else e.ice.push(s.candidate);return;}
 if((s.type==='offer'&&this.self===this.host)||(s.type==='answer'&&this.self!==this.host))return;
 await e.pc.setRemoteDescription(s.sdp);for(const ice of e.ice)await e.pc.addIceCandidate(ice);e.ice=[];
 if(s.type==='offer'){await e.pc.setLocalDescription(await e.pc.createAnswer());await this.send(person.user_id,{type:'answer',sdp:e.pc.localDescription},this.epoch);}
 }
}
