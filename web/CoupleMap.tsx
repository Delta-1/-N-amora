import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import { MapPin } from 'lucide-react';
import type { State } from './model';
import type {Place} from './tracking';
import { distanceKm } from './history';
import 'leaflet/dist/leaflet.css';
export default function CoupleMap({ state, selectedPin, demo, places=[],onPick }: {
    state: State;
    selectedPin: string;
    demo: boolean;
    places?:Place[];onPick?:(p:{latitude:number;longitude:number})=>void;
}) {
    const el = useRef<HTMLDivElement>(null), map = useRef<LeafletMap | null>(null), layers = useRef<LayerGroup | null>(null), library = useRef<typeof import('leaflet') | null>(null);
    const [ready, setReady] = useState(false);
    const [tilesError, setTilesError] = useState(false);
    const extent = useRef(''),picker=useRef(onPick);picker.current=onPick;const [loadError,setLoadError]=useState(false);
    const valid = state.locations.filter(p => Date.now() - p.updatedAt < 15 * 60000 && Number.isFinite(+p.latitude) && Number.isFinite(+p.longitude));
    useEffect(() => { let disposed = false; void import('leaflet').then(L => { if (disposed || !el.current)
        return; library.current = L; map.current = L.map(el.current, { scrollWheelZoom: false, zoomControl: true }).setView([-10.995, -68.745], 14); const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }); tiles.on('tileerror', () => setTilesError(true)); tiles.on('tileload', () => setTilesError(false)); tiles.addTo(map.current); layers.current = L.layerGroup().addTo(map.current);map.current.on('click',e=>picker.current?.({latitude:e.latlng.lat,longitude:e.latlng.lng}));map.current.whenReady(()=>map.current?.invalidateSize());setReady(true); }).catch(()=>{if(!disposed)setLoadError(true);}); return () => { disposed = true; map.current?.remove(); map.current = null; layers.current = null; }; }, []);
    useEffect(()=>{const node=el.current;if(!node)return;const observer=new ResizeObserver(()=>map.current?.invalidateSize({pan:false}));observer.observe(node);return()=>observer.disconnect();},[]);
    useEffect(() => {
        const L = library.current, m = map.current, layer = layers.current;
        if (!ready || !L || !m || !layer)
            return;
        layer.clearLayers();
        const points: [
            number,
            number
        ][] = [];
        valid.forEach((p, i) => { const person = state.members.find(x => x.userId === p.userId); const coords: [
            number,
            number
        ] = [+p.latitude, +p.longitude]; points.push(coords); const markerElement = document.createElement('span'); markerElement.className = 'couple-map-pin pin-' + i; const initial = document.createElement('span'); initial.textContent = (person?.name || '?').slice(0, 1).toUpperCase(); markerElement.appendChild(initial); const icon = L.divIcon({ html: markerElement.outerHTML, className: 'map-avatar-marker', iconSize: [44, 44], iconAnchor: [22, 44] }); const popup = document.createElement('div'); const name = document.createElement('strong'); name.textContent = person?.name || 'Seu amor'; const status = document.createElement('p'); status.textContent = person?.activity || 'Sem atividade informada'; popup.appendChild(name); popup.appendChild(status); L.marker(coords, { icon, title: person?.name || 'Participante' }).bindPopup(popup.outerHTML).addTo(layer); L.circle(coords, { radius: p.accuracy, color: i ? '#70896c' : '#985c7e', fillOpacity: .08, weight: 1 }).addTo(layer); });
        places.forEach(p=>{const label=document.createElement('span');label.textContent=p.name;L.circle([p.latitude,p.longitude],{radius:p.radius,color:'#bda1f2',fillOpacity:.12}).bindTooltip(label).addTo(layer);});
        if (points.length === 2)
            L.polyline(points, { color: '#985c7e', weight: 2, dashArray: '5 9', opacity: .55 }).addTo(layer);
        const key = valid.map(p => p.userId).sort().join(',');
        const selected = valid.find(p => p.userId === selectedPin);
        if (selected)
            m.flyTo([+selected.latitude, +selected.longitude], 16, { duration: .8 });
        else if (points.length && extent.current !== key)
            m.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 16, animate: true });
        extent.current = key;
    }, [state, selectedPin, ready,places]);
    const distance = valid.length === 2 ? distanceKm(valid[0], valid[1]) : null;
    return <div className={"couple-map-wrap"+(onPick?" picking-place":"")}><div ref={el} className="leaflet-couple-map" role="region" aria-label="Mapa com a posição dos dois parceiros"/>{demo && <span className="map-demo-label">Demonstração · posições fictícias</span>}{distance !== null && <span className="map-distance"><MapPin size={13}/>{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`} entre vocês</span>}{loadError&&<span className="map-network-note">Não foi possível abrir o mapa. Confira a internet e abra esta aba novamente.</span>}{!valid.length&&<span className="map-distance">Aguardando a posição dos parceiros</span>}{tilesError && <span className="map-network-note">O mapa precisa de internet para carregar as ruas.</span>}</div>;
}
