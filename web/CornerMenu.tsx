import {useState,useRef,useEffect,useMemo,useCallback,type CSSProperties,type PointerEvent} from 'react';
import {Grid2X2,UserRound} from 'lucide-react';
import {apps} from './MobileShell';
import type {AppId,AppPreferences} from './mobile-model';
import {ROTARY_STEP,wrapIndex,angleDifference,snapRotary,rotaryOrder,rotaryPoint} from './rotary-model';

function AmoraSpark(){return <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true"><path d="m24 1 4 15 10-7-7 11 16 4-16 4 7 11-10-7-4 15-4-15-10 7 7-11-16-4 16-4-7-11 10 7Z"/></svg>;}
function AppSquares(){return <svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true">{[[3,3],[22,3],[3,22],[22,22]].map(([x,y])=><rect key={x+'-'+y} x={x} y={y} width="15" height="15" rx="3"/>)}</svg>;}

type Props={prefs:AppPreferences;admin:boolean;tab:string;name:string;onOpen:(id:AppId)=>void;onApps:()=>void;};
type Drag={id:number;x:number;y:number;last:number;turn:number;moved:boolean;};
export default function CornerMenu({prefs,admin,tab,name,onOpen,onApps}:Props){
 const order=useMemo(()=>rotaryOrder(prefs,admin),[prefs,admin]);
 const [expanded,setExpanded]=useState(false),[index,setIndex]=useState(0),[turn,setTurn]=useState(0),[phase,setPhase]=useState<'idle'|'dragging'|'settling'>('idle');
 const hold=useRef<ReturnType<typeof setTimeout>|null>(null),held=useRef(false),holdStart=useRef({x:0,y:0});
 function cancelHold(){if(hold.current)clearTimeout(hold.current);hold.current=null;}
 useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setExpanded(false);};window.addEventListener('keydown',close);return()=>{cancelHold();window.removeEventListener('keydown',close);};},[]);
 const nav=useRef<HTMLElement>(null),drag=useRef<Drag|null>(null),busy=useRef(false),suppress=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null),wheel=useRef(0),lastWheel=useRef(0);
 const finish=useCallback((steps:number,angle:number)=>{
  if(timer.current)clearTimeout(timer.current);busy.current=true;setPhase('settling');setTurn(angle);
  timer.current=setTimeout(()=>{setIndex(i=>i+steps);setTurn(0);setPhase('idle');busy.current=false;timer.current=null;},260);
 },[]);
 const step=useCallback((direction:number)=>{if(busy.current||drag.current||order.length<2)return;finish(direction,-direction*ROTARY_STEP);},[finish,order.length]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const signature=order.join(',');
 useEffect(()=>{if(timer.current)clearTimeout(timer.current);drag.current=null;busy.current=false;const frame=requestAnimationFrame(()=>{setIndex(0);setTurn(0);setPhase('idle');});return()=>cancelAnimationFrame(frame);},[signature]);
 useEffect(()=>{
  const node=nav.current;if(!node)return;
  const rotate=(e:WheelEvent)=>{if(e.ctrlKey)return;e.preventDefault();e.stopPropagation();if(busy.current||drag.current)return;const now=performance.now();if(now-lastWheel.current>160)wheel.current=0;lastWheel.current=now;const delta=(Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX)*(e.deltaMode===1?16:e.deltaMode===2?100:1);wheel.current+=delta;if(Math.abs(wheel.current)>=28){step(Math.sign(wheel.current));wheel.current=0;}};
  node.addEventListener('wheel',rotate,{passive:false});return()=>node.removeEventListener('wheel',rotate);
 },[step]);
 function pointerAngle(e:PointerEvent<HTMLElement>){const rect=e.currentTarget.getBoundingClientRect();return Math.atan2(rect.bottom-e.clientY,rect.right-e.clientX)*180/Math.PI;}
 function start(e:PointerEvent<HTMLElement>){if(busy.current||e.button!==0||(e.target as Element).closest('.corner-apps'))return;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,last:pointerAngle(e),turn:0,moved:false};}
 function move(e:PointerEvent<HTMLElement>){const d=drag.current;if(!d||d.id!==e.pointerId)return;if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<7)return;if(!d.moved){d.moved=true;e.currentTarget.setPointerCapture(e.pointerId);setPhase('dragging');}const angle=pointerAngle(e);d.turn=Math.max(-90,Math.min(90,d.turn+angleDifference(angle,d.last)));d.last=angle;setTurn(d.turn);e.preventDefault();}
 function release(e:PointerEvent<HTMLElement>,cancel=false){const d=drag.current;if(!d||d.id!==e.pointerId)return;drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(!d.moved)return;suppress.current=Date.now()+180;const steps=cancel?0:snapRotary(d.turn);finish(steps,-steps*ROTARY_STEP);}
 const visible=Array.from({length:9},(_,i)=>i-3);
 const names=[0,1,2].map(offset=>apps.find(a=>a.id===order[wrapIndex(index+offset,order.length)])?.label).join(', ');
 return <>
  {expanded&&<button className={'corner-profile '+(tab==='profile'?'active':'')} aria-label="Nosso perfil" aria-current={tab==='profile'?'page':undefined} title="Nosso perfil" onClick={()=>onOpen('profile')}><UserRound aria-hidden="true"/><span className="corner-profile-name">{name}</span></button>}
  <nav ref={nav} className={"corner-menu "+(expanded?"is-expanded":"is-collapsed")} aria-label="Menu giratório do Amora" aria-describedby="amora-menu-instructions" tabIndex={0} data-index={wrapIndex(index,order.length)} data-phase={phase}
   onPointerDown={start} onPointerMove={move} onPointerUp={e=>release(e)} onPointerCancel={e=>release(e,true)} onLostPointerCapture={e=>{if(e.target===e.currentTarget&&drag.current?.id===e.pointerId)release(e,true);}}
   onClickCapture={e=>{if(Date.now()<suppress.current){e.preventDefault();e.stopPropagation();}}}
   onKeyDown={e=>{if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key)){e.preventDefault();step(['ArrowDown','ArrowRight'].includes(e.key)?1:-1);}if(e.key==='Home'&&!busy.current){e.preventDefault();setIndex(0);}}}>
   <svg className="corner-menu-shape" viewBox="0 0 280 280" aria-hidden="true"><path className="corner-menu-interior" d="M0 280A280 280 0 0 1 280 0V280Z"/><path className="corner-menu-arc" d="M0 280A280 280 0 0 1 280 0V67A213 213 0 0 0 67 280Z"/></svg>
   <div className="corner-orbit-window"><div className="corner-orbit" style={{'--turn':turn+'deg'} as CSSProperties}>{visible.map(offset=>{const app=apps.find(a=>a.id===order[wrapIndex(index+offset,order.length)]),Icon=app?.icon||Grid2X2,angle=15+offset*ROTARY_STEP,isVisible=angle+turn>0&&angle+turn<90;return <div className="corner-orbit-item" key={index+offset} style={rotaryPoint(angle)} aria-hidden={!isVisible}><button className={'corner-shortcut'+(tab===app?.id?' active':'')} data-app={app?.id} data-visible={isVisible} tabIndex={isVisible?0:-1} onClick={()=>{if(!busy.current&&phase==='idle'&&app)onOpen(app.id);}} aria-label={app?.label} aria-current={tab===app?.id?'page':undefined} title={app?.label}>{app?.id==='lilith'?<AmoraSpark/>:<Icon aria-hidden="true"/>}<span className="corner-menu-label">{app?.label}</span></button></div>;})}</div></div>
   <span className="corner-rotate-hint" aria-hidden="true">Gire para<br/>explorar</span>
   <button className="apps-launcher corner-apps" aria-expanded={expanded} aria-label="Apps" title="Toque: atalhos · segure: todos os aplicativos" onPointerDown={e=>{if(e.button!==0)return;held.current=false;holdStart.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);cancelHold();hold.current=setTimeout(()=>{hold.current=null;held.current=true;setExpanded(false);onApps();navigator.vibrate?.(25);},550);}} onPointerMove={e=>{if(Math.hypot(e.clientX-holdStart.current.x,e.clientY-holdStart.current.y)>12){cancelHold();held.current=true;}}} onPointerUp={cancelHold} onPointerCancel={()=>{cancelHold();held.current=true;}} onContextMenu={e=>e.preventDefault()} onClick={()=>{if(held.current){held.current=false;return;}setExpanded(v=>!v);}} onKeyDown={e=>{if(e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();setExpanded(false);onApps();}}}><AppSquares/><span className="corner-menu-label">Apps</span></button>
   <span id="amora-menu-instructions" className="sr-only">Toque em Apps para abrir ou ocultar atalhos. Segure para ver todos. Deslize ou gire o arco para explorar.</span><span className="sr-only" role="status" aria-live="polite">{phase==='idle'?names:''}</span>
  </nav>
 </>;
}
