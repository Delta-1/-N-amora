import {Grid2X2,UserRound} from 'lucide-react';
import {apps} from './MobileShell';
import type {AppId} from './mobile-model';

function AmoraSpark(){return <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true"><path d="m24 1 4 15 10-7-7 11 16 4-16 4 7 11-10-7-4 15-4-15-10 7 7-11-16-4 16-4-7-11 10 7Z"/></svg>;}
function AppSquares(){return <svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true">{[[3,3],[22,3],[3,22],[22,22]].map(([x,y])=><rect key={x+'-'+y} x={x} y={y} width="15" height="15" rx="3"/>)}</svg>;}

type Props={tab:string;name:string;onOpen:(id:AppId)=>void;onApps:()=>void;};
export default function CornerMenu({tab,name,onOpen,onApps}:Props){
 const profile=apps.find(a=>a.id==='profile');
 const shortcuts:AppId[]=['map','lilith','community'];
 const ProfileIcon=profile?.icon||UserRound;
 return <>
  <button className={'corner-profile '+(tab===profile?.id?'active':'')} aria-label={profile?.label||'Nosso perfil'} aria-current={tab===profile?.id?'page':undefined} title={profile?.label||'Nosso perfil'} onClick={()=>onOpen('profile')}>
   <ProfileIcon aria-hidden="true"/><span className="corner-profile-name">{profile?.id==='profile'?name:profile?.label}</span>
  </button>
  <nav className="corner-menu" aria-label="Menu do Amora">
   <svg className="corner-menu-shape" viewBox="0 0 280 280" aria-hidden="true"><path className="corner-menu-interior" d="M0 280A280 280 0 0 1 280 0V280Z"/><path className="corner-menu-arc" d="M0 280A280 280 0 0 1 280 0V67A213 213 0 0 0 67 280Z"/></svg>
   {shortcuts.map((id,i)=>{const app=apps.find(a=>a.id===id),Icon=app?.icon||Grid2X2;return <button key={id} className={'corner-shortcut corner-slot-'+i+(tab===id?' active':'')} onClick={()=>onOpen(id)} aria-label={app?.label} aria-current={tab===id?'page':undefined} title={app?.label}>{id==='lilith'?<AmoraSpark/>:<Icon aria-hidden="true"/>}<span className="corner-menu-label">{app?.label}</span></button>;})}
   <button className="apps-launcher corner-apps" onClick={onApps} aria-label="Apps" title="Abrir aplicativos"><AppSquares/><span className="corner-menu-label">Apps</span></button>
  </nav>
 </>;
}
