import {useEffect,useRef,useState} from 'react';
import type {Map as LeafletMap,LayerGroup} from 'leaflet';
import type {State} from './model';
import type {Place} from './tracking';
import {activeLocations,memberColor} from './map-model';
import 'leaflet/dist/leaflet.css';
export default function CoupleMap({state,selectedPin,demo,places=[],onPick,onSelect,focusRequest=0,bottomInset=250}:{
 state:State;selectedPin:string;demo:boolean;places?:Place[];
 onPick?:(p:{latitude:number;longitude:number})=>void;onSelect?:(id:string)=>void;focusRequest?:number;bottomInset?:number;
}){
 const el=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null),layers=useRef<LayerGroup|null>(null),library=useRef<typeof import('leaflet')|null>(null);
 const [ready,setReady]=useState(false),[tilesError,setTilesError]=useState(false),[loadError,setLoadError]=useState(false);
 const extent=useRef(''),picker=useRef(onPick),selection=useRef(onSelect),inset=useRef(bottomInset);
 picker.current=onPick;selection.current=onSelect;inset.current=bottomInset;
 useEffect(()=>{let disposed=false;void import('leaflet').then(L=>{
  if(disposed||!el.current)return;library.current=L;
  map.current=L.map(el.current,{scrollWheelZoom:true,zoomControl:true}).setView([-10.995,-68.745],14);
  map.current.zoomControl.setPosition('topright');
  const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19});
  tiles.on('tileerror',()=>{if(!disposed)setTilesError(true);});tiles.on('tileload',()=>{if(!disposed)setTilesError(false);});tiles.addTo(map.current);
  layers.current=L.layerGroup().addTo(map.current);map.current.on('click',e=>picker.current?.({latitude:e.latlng.lat,longitude:e.latlng.lng}));setReady(true);
 }).catch(()=>{if(!disposed)setLoadError(true);});return()=>{disposed=true;map.current?.remove();map.current=null;layers.current=null;};},[]);
 useEffect(()=>{if(!el.current)return;const observer=new ResizeObserver(()=>map.current?.invalidateSize({pan:false}));observer.observe(el.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  const L=library.current,m=map.current,layer=layers.current;if(!ready||!L||!m||!layer)return;
  layer.clearLayers();const valid=activeLocations(state.locations),points:[number,number][]=[];
  valid.forEach(p=>{
   const person=state.members.find(x=>x.userId===p.userId),coords:[number,number]=[+p.latitude,+p.longitude];points.push(coords);
   const element=document.createElement('div');element.className='map-person-marker '+memberColor(person);
   const avatar=document.createElement('span');avatar.className='map-person-avatar';avatar.textContent=(person?.name||'?').slice(0,1).toUpperCase();
   const label=document.createElement('strong');label.className='map-person-name';label.textContent=(person?.name||'Participante')+(p.userId===state.user.userId?' · você':'');
   element.appendChild(avatar);element.appendChild(label);
   const icon=L.divIcon({html:element.outerHTML,className:'map-avatar-marker',iconSize:[54,74],iconAnchor:[27,54]});
   L.circle(coords,{radius:Math.max(0,Number.isFinite(p.accuracy)?p.accuracy:0),color:memberColor(person)==='sage'?'#70896c':'#985c7e',fillOpacity:.08,weight:1}).addTo(layer);
   L.marker(coords,{icon,title:label.textContent,keyboard:true}).on('click',()=>selection.current?.(p.userId)).addTo(layer);
  });
  places.forEach(p=>{const label=document.createElement('span');label.textContent=p.name;L.circle([p.latitude,p.longitude],{radius:p.radius,color:'#9c75b7',fillOpacity:.12,weight:2}).bindTooltip(label).addTo(layer);});
  if(points.length===2)L.polyline(points,{color:'#985c7e',weight:2,dashArray:'5 9',opacity:.55}).addTo(layer);
  const key=valid.map(p=>p.userId).sort().join(',');
  if(points.length&&extent.current!==key)m.fitBounds(L.latLngBounds(points),{paddingTopLeft:m.getSize().x>=800?[470,110]:[65,110],paddingBottomRight:[65,m.getSize().x>=800?45:Math.min(inset.current+35,m.getSize().y-185)],maxZoom:16});extent.current=key;
 },[state,places,ready]);
 useEffect(()=>{
  const L=library.current,m=map.current;if(!ready||!L||!m)return;
  const valid=activeLocations(state.locations),selected=valid.find(p=>p.userId===selectedPin);
  const points:[number,number][]=selected?[[+selected.latitude,+selected.longitude]]:valid.map(p=>[+p.latitude,+p.longitude]);
  if(points.length)m.fitBounds(L.latLngBounds(points),{paddingTopLeft:m.getSize().x>=800?[470,110]:[65,110],paddingBottomRight:[65,m.getSize().x>=800?45:Math.min(bottomInset+35,m.getSize().y-185)],maxZoom:selected?16:15,animate:!matchMedia('(prefers-reduced-motion: reduce)').matches});
 },[ready,selectedPin,focusRequest,bottomInset]);
 const valid=activeLocations(state.locations);
 return <div className={'couple-map-wrap'+(onPick?' picking-place':'')}><div ref={el} className="leaflet-couple-map" role="region" aria-label="Mapa com a posição dos dois parceiros"/>{demo&&<span className="map-demo-label">Demonstração · posições fictícias</span>}{loadError?<span className="map-network-note" role="alert">Não foi possível abrir o mapa. Confira a internet e abra esta aba novamente.</span>:tilesError?<span className="map-network-note" role="status">O mapa precisa de internet para carregar as ruas.</span>:!valid.length&&<span className="map-waiting" role="status">Ative o GPS para aparecer no mapa</span>}</div>;
}
