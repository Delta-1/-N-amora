import {Home,Heart,MessageCircle,MapPin,Music,Settings,Info,Grid2X2,ShieldCheck,UserRound,PenLine,Sparkles} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import Berry from './Berry';

type Props={tab:string;name:string;onOpen:(s:string)=>void;onPublish:()=>void;onApps:()=>void;onSettings:()=>void;admin:boolean};
export function SocialSidebar({tab,name,onOpen,onPublish,onApps,onSettings,admin}:Props){
 const links:[string,string,LucideIcon][]=[['community','Página inicial',Home],['social-chat','Mensagens',MessageCircle],['profile','Perfil do casal',UserRound],['map','Nosso mapa',MapPin],['music','Ouvindo juntos',Music],['whatsapp','WhatsApp',MessageCircle],['home','Nosso cantinho',Heart],['about','Sobre',Info],...(admin?[['studio','Lilith Studio',Sparkles],['admin','Administração',ShieldCheck]] as [string,string,LucideIcon][]:[])];
 return <aside className="social-sidebar">
  <a href="#" onClick={e=>{e.preventDefault();onOpen('community');}} className="social-sidebar-brand" aria-label="Amora, página inicial"><Berry small/><strong>(N)AMORA</strong></a>
  <nav aria-label="Navegação da comunidade">{links.map(([id,label,Icon])=><button key={id} title={label} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>onOpen(id)}><Icon size={24}/><span>{label}</span></button>)}<button title="Aplicativos" onClick={onApps}><Grid2X2 size={24}/><span>Mais aplicativos</span></button></nav>
  <button className="button x-publish-button" onClick={onPublish} title="Criar publicação"><PenLine size={21}/><span>Publicar</span></button>
  <footer><button title="Configurações" onClick={onSettings}><span className="x-sidebar-avatar">{name.slice(0,1).toUpperCase()}</span><span className="x-sidebar-identity"><strong>{name}</strong><small>Configurações da conta</small></span><Settings size={19}/></button></footer>
 </aside>;
}
