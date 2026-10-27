'use client';
import { lazy, Suspense, useState, useEffect, useRef, useCallback, type FormEvent, type ReactNode } from 'react';
import { MessageCircle, Gamepad2, NotebookPen, Grid2X2, Heart, Home, CalendarDays, CalendarHeart, Lightbulb, Volume2, VolumeX, CheckCheck, Wallet, MapPin, Sparkles, Plus, ArrowUpRight, ChevronRight, ChevronLeft, Bell, Settings, Check, X, Send, Copy, Link2, LogOut, Palette, Download, Trash2, Pencil, Navigation, ShieldCheck, RefreshCw, ArrowRight, Leaf, Smile, Search, ArrowDownLeft, Ellipsis, Cloud, Clock, ExternalLink } from 'lucide-react';
import Mascot from './Berry';
import FallingBerry from './FallingBerry';
import SafetyMap,{SOSButton,SOSSettings,SafetyMonitor} from './Safety';
import {trackingCall,startTracking,stopTracking} from './tracking';
import FeatureBoundary from './FeatureBoundary';
import Orb from './Orb';
import {MobileDock,AppsDrawer,MobileSettings,useAppPreferences,useAppearance} from './MobileShell';
import {DriveSettings} from './IntegrationSettings';
import type {AppId} from './mobile-model';
const CameraApp=lazy(()=>import('./Camera'));
const FilesApp=lazy(()=>import('./Files'));
import Lilith, { AISettings } from './Lilith';
import Finance from './Finance';
import { PartnerChat, Notes, Whiteboard, Games } from './CoupleFeatures';
import { native, saveText, amoraCall } from './native';
import AuthPanel from './AuthPanel';
import InviteCard from './InviteCard';
import {incomingInvite,cleanInvite} from './invitation';
import {useWallpaper,WallpaperPicker} from './Wallpaper';
import HistoryPanel from './HistoryPanel';
import IdeasPanel from './IdeasPanel';
import CoupleMap from './CoupleMap';
import { initializeBackend, getClient, getState, backendAction, subscribeCouple, asset } from './supabase';
import { playSound, soundEnabled } from './sounds';
import { upcomingMilestones } from './history';
import { demoState } from './demo';
import { money, amountToCents, expenseBalance, recordSchema, type State, type Item, type ItemData, type Member } from './model';
type Tab = AppId | 'more' | 'apps';
type Modal = 'task' | 'event' | 'expense' | 'settings' | 'link' | 'mood' | 'notifications' | 'auth' | null;
const nav = [{id:'home',label:'Nosso canto',icon:Home},{id:'chat',label:'Conversa',icon:MessageCircle},{id:'expenses',label:'Nosso bolso',icon:Wallet},{id:'games',label:'Jogar',icon:Gamepad2},{id:'apps',label:'Apps',icon:Grid2X2},{id:'camera',label:'Câmera',icon:Sparkles},{id:'album',label:'Álbum',icon:Heart},{id:'files',label:'Arquivos',icon:Cloud},{id:'agenda',label:'Agenda',icon:CalendarDays},{id:'history',label:'Nossa história',icon:CalendarHeart},{id:'lists',label:'Combinados',icon:CheckCheck},{id:'ideas',label:'Ideias',icon:Lightbulb},{id:'map',label:'Nosso mapa',icon:MapPin},{id:'paint',label:'Nosso quadro',icon:Palette},{id:'notes',label:'Notas',icon:NotebookPen},{id:'lilith',label:'Lilith',icon:Sparkles}] as const;
const moods = [['feliz', '😊'], ['apaixonado', '🥰'], ['tranquilo', '😌'], ['cansado', '😴'], ['precisando de carinho', '🥺']];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dateText = (s: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) => new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('pt-BR', options);
const timeText = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const categories: Record<string, string[]> = { task: ['Casa', 'Compras', 'Pessoal', 'Nós dois'], event: ['Encontro', 'Faculdade', 'Aniversário', 'Outro'], expense: ['Casa', 'Alimentação', 'Faculdade', 'Lazer', 'Transporte', 'Outros'] };
function reminderPayload(state:State|null){if(!state)return [];const now=Date.now();return [...state.items.flatMap(i=>{const d=i.data;const date=d.kind==='event'?d.date:d.kind==='task'&&!d.done?d.due:null;return date?[{id:i.id,title:d.title,time:new Date(date).getTime()-15*60000}]:[];}),...upcomingMilestones(state.items).map(m=>({id:m.item.id,title:m.item.data.title,time:new Date(m.date.getFullYear(),m.date.getMonth(),m.date.getDate(),9).getTime()}))].filter(r=>r.time>now).slice(0,60);}
function download(name:string,value:string,type='application/json'){saveText(name,value,type);}
function Avatar({ name, index = 0, large = false }: {
    name: string;
    index?: number;
    large?: boolean;
}) { return <span className={`avatar a${index} ${large ? 'large' : ''}`}>{name.slice(0, 1).toUpperCase()}</span>; }
function Empty({ icon: Icon = Heart, title, children }: {
    icon?: typeof Heart;
    title: string;
    children?: ReactNode;
}) { return <div className="empty"><Icon size={30} strokeWidth={1.4}/><h3>{title}</h3><p>{children}</p></div>; }
function Dialog({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { ref.current?.showModal(); ref.current?.querySelector<HTMLInputElement>('[autofocus]')?.focus(); return () => ref.current?.close(); }, []);
    return <dialog ref={ref} className="modal" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => {
            if (e.target === ref.current)
                onClose();
        }}><div className="modal-head"><div><span className="eyebrow">NOSSO PEQUENO MUNDO</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20}/></button></div>{children}</dialog>;
}
function Editor({ kind, item, members, userId, onSave, onDelete, busy }: {
    kind: 'task' | 'event' | 'expense';
    item: Item | null;
    members: Member[];
    userId: string;
    onSave: (data: ItemData) => Promise<void>;
    onDelete: () => void;
    busy: boolean;
}) {
    const d = item?.data;
    const [error, setError] = useState('');
    const toLocal = (s: string) => { const dt = new Date(s); return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        const f = new FormData(e.currentTarget);
        try {
            const title = String(f.get('title')).trim();
            if (!title)
                throw new Error('Dê um nome para este item.');
            let data: ItemData;
            if (kind === 'task')
                data = { kind, title, due: f.get('due') ? new Date(String(f.get('due'))).toISOString() : null, done: d?.kind === 'task' ? d.done : false, assignee: String(f.get('assignee')), category: String(f.get('category')) as Extract<ItemData, {
                        kind: 'task';
                    }>['category'] };
            else if (kind === 'event')
                data = { kind, title, date: new Date(String(f.get('date'))).toISOString(), category: String(f.get('category')) as Extract<ItemData, {
                        kind: 'event';
                    }>['category'], note: String(f.get('note') || '') };
            else
                data = { kind, title, cents: amountToCents(String(f.get('amount'))), date: String(f.get('date')), category: String(f.get('category')) as Extract<ItemData, {
                        kind: 'expense';
                    }>['category'], payer: String(f.get('payer')), shared: f.get('shared') === 'on' };
            await onSave(data);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Confira os campos.');
        }
    }
    return <form onSubmit={submit} className="form"><label>{kind === 'expense' ? 'O que vocês pagaram?' : kind === 'event' ? 'Qual é o plano?' : 'O que precisa ser feito?'}<input name="title" autoFocus required maxLength={140} defaultValue={d?.title || ''} placeholder={kind === 'expense' ? 'Ex.: Mercado da semana' : kind === 'event' ? 'Ex.: Nosso jantar de sexta' : 'Ex.: Comprar os ingredientes'}/></label>
 {kind === 'expense' ? <div className="form-row"><label>Valor em reais<input name="amount" inputMode="decimal" required placeholder="0,00" defaultValue={d?.kind === 'expense' ? (d.cents / 100).toFixed(2).replace('.', ',') : ''}/></label><label>Data<input name="date" type="date" required defaultValue={d?.kind === 'expense' ? d.date : dayKey(new Date())}/></label></div> : <label>{kind === 'task' ? 'Lembrar em (opcional)' : 'Dia e horário'}<input name={kind === 'task' ? 'due' : 'date'} type="datetime-local" required={kind === 'event'} defaultValue={d?.kind === 'event' ? toLocal(d.date) : d?.kind === 'task' && d.due ? toLocal(d.due) : ''}/></label>}
 <div className="form-row"><label>Categoria<select name="category" defaultValue={d?.category || categories[kind][0]}>{categories[kind].map(c => <option key={c}>{c}</option>)}</select></label>{kind !== 'event' && <label>{kind === 'expense' ? 'Quem pagou?' : 'Quem vai fazer?'}<select name={kind === 'expense' ? 'payer' : 'assignee'} defaultValue={d?.kind === 'expense' ? d.payer : d?.kind === 'task' ? d.assignee : kind === 'expense' ? userId : 'both'}>{kind === 'task' && <option value="both">Nós dois</option>}{members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select></label>}</div>
 {kind === 'event' && <label>Um detalhe especial<textarea name="note" maxLength={500} placeholder="Local, ideia ou alguma observação…" defaultValue={d?.kind === 'event' ? d.note : ''}/></label>}
 {kind === 'expense' && <label className="check-label"><input type="checkbox" name="shared" defaultChecked={d?.kind === 'expense' ? d.shared : true}/><span>Dividir igualmente entre nós dois<small>Desmarque para uma despesa individual.</small></span></label>}
 {error && <p className="form-error" role="alert">{error}</p>}<div className="form-footer">{item && <button type="button" className="danger-link" onClick={onDelete} disabled={busy}><Trash2 size={17}/> Excluir</button>}<button className="button" disabled={busy}>{busy ? 'Salvando…' : item ? 'Salvar alterações' : 'Guardar no nosso mundo'}<Heart size={16}/></button></div></form>;
}
function TaskRow({ item, members, busy, onToggle, onEdit }: {
    item: Item;
    members: Member[];
    busy: boolean;
    onToggle: (i: Item) => void;
    onEdit: (i: Item) => void;
}) {
    const d = item.data;
    if (d.kind !== 'task')
        return null;
    return <div className={`task-row ${d.done ? 'done' : ''}`}><button className="checkbox" aria-label={d.done ? `Reabrir ${d.title}` : `Concluir ${d.title}`} onClick={() => onToggle(item)} disabled={busy}>{d.done && <Check size={13}/>}</button><button className="task-text" onClick={() => onEdit(item)}><strong>{d.title}</strong><small>{d.category}{d.due ? ` · ${dateText(d.due)} às ${timeText(d.due)}` : ''}</small></button><span className="assignee" title={d.assignee === 'both' ? 'Nós dois' : members.find(m => m.userId === d.assignee)?.name}>{d.assignee === 'both' ? <Heart size={13}/> : members.find(m => m.userId === d.assignee)?.name.slice(0, 1)}</span></div>;
}
function EventRow({ item, onEdit }: {
    item: Item;
    onEdit: (i: Item) => void;
}) {
    const d = item.data;
    if (d.kind !== 'event')
        return null;
    return <button className="event-row" onClick={() => onEdit(item)}><span className={`event-date ${d.category === 'Encontro' ? 'pink' : 'green'}`}><strong>{new Date(d.date).getDate()}</strong><small>{dateText(d.date, { month: 'short' }).replace('.', '')}</small></span><span><strong>{d.title}</strong><small>{timeText(d.date)} · {d.category}</small></span><ChevronRight size={16}/></button>;
}
export default function Namora() {
    const [booted,setBooted]=useState(false);
    const [explore,setExplore]=useState(new URLSearchParams(location.search).get('demo')==='1');
    const [lilithOpen,setLilithOpen]=useState(new URLSearchParams(location.search).get('panel')==='lilith');
    const [state, setState] = useState<State | null>(null);
    const [demo, setDemo] = useState(true);
    const [auth, setAuth] = useState(false);
    const [tab, setTab] = useState<Tab>(new URLSearchParams(location.search).get('panel')==='chat'?'chat':'home');
    const [modal, setModal] = useState<Modal>(null);
    const [editing, setEditing] = useState<Item | null>(null);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState('');
    const logoutRef=useRef<()=>Promise<void>>(async()=>{});
    const [connection, setConnection] = useState('Conectando…');
    const [code, setCode] = useState('');
    const [invitation,setInvitation]=useState(incomingInvite);
    const [linkStarted,setLinkStarted]=useState(false);
    const [chatOpen,setChatOpen]=useState(false);
    const [wallpaper,setWallpaper]=useWallpaper(state?.user.userId);
    const [theme,setTheme]=useAppearance();
    const [prefs,setPrefs]=useAppPreferences(state?.user.userId);
    const [appsOpen,setAppsOpen]=useState(false),[settingsView,setSettingsView]=useState('personal'),[orbSpeaking,setOrbSpeaking]=useState(false);
    const ignoreConversationPop=useRef(false);
    const swipe=useRef<{x:number;y:number}|null>(null);
    const [linkMode, setLinkMode] = useState<'create' | 'join'>(invitation?'join':'create');
    const [linkError, setLinkError] = useState('');
    const [notificationOn, setNotificationOn] = useState(false);
    const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [selectedDay, setSelectedDay] = useState('');
    const [filter, setFilter] = useState('Todas');
    const [search, setSearch] = useState('');
    const [expenseMonth, setExpenseMonth] = useState(() => dayKey(new Date()).slice(0, 7));
    const [sharing, setSharing] = useState(false);
    const [sosEnabled,setSosEnabled]=useState(()=>localStorage.getItem('namora.sos.enabled')==='on');
    const [installEvent, setInstallEvent] = useState<Event | null>(null);
    const [sounds, setSounds] = useState(soundEnabled);
    const [direction, setDirection] = useState('right');
    const [celebrating, setCelebrating] = useState(false);
    const [backendReady, setBackendReady] = useState(false);
    const [recovering, setRecovering] = useState(false);
    const prevTab = useRef<Tab>('home');
    function switchTab(next: Tab) { if(next==='apps'||next==='more'){setAppsOpen(true);return;} setAppsOpen(false);setChatOpen(false); if(next==='lilith'){setLilithOpen(true);return;} setDirection(nav.findIndex(n => n.id === next) >= nav.findIndex(n => n.id === prevTab.current) ? 'right' : 'left'); prevTab.current = next; setTab(next); playSound('tab'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    const watch = useRef<number | null>(null);
    const locationTime = useRef(0);
    const demoRef = useRef(true);
    const refreshing = useRef(false);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const notify = useCallback((s: string) => {
        setToast(s);
        if (toastTimer.current)
            clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(''), 4500);
    }, []);
    const refresh = useCallback(async (_initial = false) => {
        if (refreshing.current)
            return;
        refreshing.current = true;
        try {
            const data = await getState();
            if (data) {
                setState(data);
                setDemo(false);
                demoRef.current = false;
                setAuth(true);
                setConnection('Em sintonia');
            }
            else {
                if (!demoRef.current) {
                    setState(demoState());
                    setDemo(true);
                    demoRef.current = true;
                }
                setAuth(false);
                setConnection('Demonstração');
            }
        }
        catch (e) {
            setConnection('Conexão pendente');
            notify(e instanceof Error ? e.message : 'Não foi possível sincronizar.');
        }
        finally {
            refreshing.current = false;
        }
    }, [notify]);
    useEffect(() => {
        let alive = true;
        let unsubscribe: (() => void) | undefined;
        setState(demoState());
        try {
            setNotificationOn(localStorage.getItem('namora.notifications.v1') === 'on' && 'Notification' in window && Notification.permission === 'granted');
        }
        catch { }
        void initializeBackend().then(client => { if (!alive)
            return; setBackendReady(!!client); if (client) {
            const sub = client.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') {
                setRecovering(true);
                setModal('auth');
            } setTimeout(() => void refresh(true), 0); });
            unsubscribe = () => sub.data.subscription.unsubscribe();
        } void refresh(true); }).catch(e => notify(e instanceof Error ? e.message : 'Confira a configuração do banco.')).finally(()=>setBooted(true));
        const interval = setInterval(() => { if (!document.hidden && !demoRef.current)
            void refresh(); }, 30000);
        const onInstall = (e: Event) => { e.preventDefault(); setInstallEvent(e); };
        window.addEventListener('beforeinstallprompt', onInstall);
        if (!native() && 'serviceWorker' in navigator)
            void navigator.serviceWorker.register(asset('sw.js'), { scope: import.meta.env.BASE_URL }).catch(() => { });
        return () => { alive = false; unsubscribe?.(); clearInterval(interval); window.removeEventListener('beforeinstallprompt', onInstall); if (watch.current !== null)
            navigator.geolocation.clearWatch(watch.current); if (toastTimer.current)
            clearTimeout(toastTimer.current); };
    }, [refresh, notify]);
    useEffect(() => { if (demo || !state?.couple)
        return; const stop = subscribeCouple(state.couple.id, () => void refresh()); const heartbeat = () => { if (!document.hidden)
        void backendAction({ action: 'presence' }).catch(() => { }); }; heartbeat(); const timer = setInterval(heartbeat, 60000); return () => { stop(); clearInterval(timer); }; }, [demo, state?.couple?.id, refresh]);
    useEffect(() => {
        if (!notificationOn || !state)
            return;
        const check = () => {
            const now = Date.now();
            for (const entry of upcomingMilestones(state.items)) {
                if (entry.days > 1)
                    continue;
                const key = 'namora.milestone.' + entry.item.id + '.' + entry.date.getFullYear() + '.' + entry.days;
                if (!sessionStorage.getItem(key)) {
                    sessionStorage.setItem(key, 'sent');
                    notify((entry.days === 0 ? 'Hoje é dia de celebrar: ' : 'Amanhã: ') + entry.item.data.title);
                    playSound('reminder');
                    void navigator.serviceWorker?.ready.then(r => r.showNotification('(N)amora · Nossa história', { body: (entry.days === 0 ? 'É hoje! ' : 'É amanhã! ') + entry.item.data.title, icon: asset('icon-192.png'), tag: entry.item.id })).catch(() => { });
                }
            }
            for (const item of state.items) {
                const d = item.data;
                const due = d.kind === 'event' ? d.date : d.kind === 'task' && !d.done ? d.due : null;
                if (!due)
                    continue;
                const delta = new Date(due).getTime() - now;
                const key = `namora.reminder.${item.id}.${due}`;
                if (delta <= 15 * 60000 && delta >= -60000 && !sessionStorage.getItem(key)) {
                    sessionStorage.setItem(key, 'sent');
                    playSound('reminder');
                    void navigator.serviceWorker.ready.then(r => r.showNotification('(N)amora · Um lembrete com carinho', { body: d.title, icon: asset('icon-192.png'), tag: item.id })).catch(() => notify(d.title));
                }
            }
        };
        check();
        const id = setInterval(check, 30000);
        return () => clearInterval(id);
    }, [notificationOn, state, notify]);
    async function action(payload: Record<string, unknown>): Promise<{
        ok?: boolean;
        code?: string;
        error?: string;
    }> {
        if (demo) {
            if (payload.action === 'save')
                recordSchema.parse(payload.data);
            const a = payload.action;
            const newId = globalThis.crypto?.randomUUID?.() || ('demo-' + Date.now() + '-' + Math.random().toString(36).slice(2));
            const createdAt = Date.now();
            setState(prev => {
                if (!prev)
                    return prev;
                let items = prev.items;
                if (a === 'save') {
                    const data = payload.data as ItemData;
                    if (payload.id)
                        items = items.map(i => i.id === payload.id ? { ...i, data, version: i.version + 1 } : i);
                    else
                        items = [{ id: newId, data, version: 1, creator: prev.user.userId, createdAt }, ...items];
                }
                if (a === 'delete')
                    items = items.filter(i => i.id !== payload.id);
                if (a === 'mood')
                    return { ...prev, members: prev.members.map(m => m.userId === prev.user.userId ? { ...m, mood: String(payload.mood) } : m) };
                if (a === 'activity')
                    return { ...prev, members: prev.members.map(m => m.userId === prev.user.userId ? { ...m, activity: String(payload.activity), lastSeen: Date.now() } : m) };
                if (a === 'profile')
                    return { ...prev, members: prev.members.map(m => m.userId === prev.user.userId ? { ...m, name: String(payload.name) } : m) };
                if (a === 'couple')
                    return { ...prev, couple: prev.couple ? { ...prev.couple, name: String(payload.name), since: payload.since as string | null } : null };
                return { ...prev, items };
            });
            return { ok: true };
        }
        const result = await backendAction(payload);
        await refresh();
        return result;
    }
    async function run(payload: Record<string, unknown>, success?: string) {
        if (busy)
            return;
        setBusy(true);
        try {
            const result = await action(payload);
            if (success)
                playSound('success');
            if (success)
                notify(demo ? `${success} · só nesta demonstração` : success);
            return result;
        }
        catch (e) {
            notify(e instanceof Error ? e.message : 'Algo deu errado.');
            return null;
        }
        finally {
            setBusy(false);
        }
    }
    const open = (type: Modal, item: Item | null = null) => {
        if ((type === 'task' || type === 'event' || type === 'expense') && !state?.couple) {
            setModal('link');
            return;
        }
        if(type==='link')setLinkMode('create');
        setEditing(item);
        setModal(type);
        setLinkError('');
    };
    async function save(data: ItemData) {
        setBusy(true);
        try {
            await action({ action: 'save', data, ...(editing ? { id: editing.id, version: editing.version } : {}) });
            setModal(null);
            setEditing(null);
            playSound('success');
            notify(demo ? 'Guardado nesta demonstração 💜' : 'Guardado para vocês dois 💜');
        }
        finally {
            setBusy(false);
        }
    }
    async function saveShared(data: ItemData, item?: Item) { const result = await run({ action: 'save', data, ...(item ? { id: item.id, version: item.version } : {}) }, 'Guardado para vocês'); if (result) {
        setCelebrating(true);
        setTimeout(() => setCelebrating(false), 1300);
    } return !!result; }
    async function deleteShared(item: Item) { if (window.confirm(`Excluir “${item.data.title}” do vínculo?`))
        await run({ action: 'delete', id: item.id, version: item.version }, 'Memória removida'); }
    async function signOut() { setExplore(false); if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current); if (!demo&&state?.couple)
        await stopTracking().catch(() => { }); setSharing(false); await getClient()?.auth.signOut({scope:'local'}); native()?.clearSession();setCode('');  setModal(null); await refresh(true); }
    logoutRef.current=signOut;
    async function remove() {
        if (!editing)
            return;
        if (!window.confirm(`Excluir “${editing.data.title}” para os dois?`))
            return;
        const result = await run({ action: 'delete', id: editing.id, version: editing.version }, 'Item excluído');
        if (result)
            setModal(null);
    }
    async function toggle(item: Item) {
        if (item.data.kind === 'task')
            await run({ action: 'save', id: item.id, version: item.version, data: { ...item.data, done: !item.data.done } }, item.data.done ? 'Tarefa reaberta' : 'Mais um passinho concluído!');
    }
    function openJoin(){setLinkMode('join');setLinkError('');setLinkStarted(true);setAppsOpen(false);setModal('link');}
    async function link(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (busy)
            return;
        if (!auth) {
            setModal('auth');
            return;
        }
        setLinkError('');
        const f = new FormData(e.currentTarget);
        if(linkMode==='join'&&!cleanInvite(String(f.get('code')||''))){setLinkError('Informe o código completo de 10 caracteres (ou 16 nos convites antigos).');return;}
        if(linkMode==='join'&&state?.couple){setLinkError('Desvincule sua conta antes de entrar em outro cantinho.');return;}
        setBusy(true);
        try {
            const result = await action({ action: linkMode, name: f.get('name'), title: f.get('title'), since: f.get('since') || null, code: String(f.get('code') || '').replace(/[\s-]/g, '').toUpperCase() });
            if (result.code){setCode(result.code);setModal('link');}
            else{setModal(null);setInvitation('');sessionStorage.removeItem('amora.invite');setLinkStarted(false);}
            notify('O mundo de vocês começa aqui 💜');
        }
        catch (e) {
            setLinkError(e instanceof Error ? e.message : 'Confira os dados.');
        }
        finally {
            setBusy(false);
        }
    }
    async function enableNotifications() {
        if(native()){localStorage.setItem('namora.native.reminders','on');setNotificationOn(true);native()!.reminders(JSON.stringify(reminderPayload(state)));notify('Lembretes ativados no Android.');return;}
        if (!('Notification' in window)) {
            notify('Este navegador não oferece notificações. No iPhone, instale o app na tela inicial.');
            return;
        }
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            setNotificationOn(true);
            try {
                localStorage.setItem('namora.notifications.v1', 'on');
            }
            catch { }
            notify('Lembretes ativados com o aplicativo aberto.');
        }
        else
            notify('Notificações não foram permitidas. Você pode liberar nas configurações do navegador.');
    }
    async function locate(steps=false) {
        if (demo) {
            notify('A localização real fica disponível depois de entrar e criar um vínculo.');
            return;
        }
        if(native()?.tracking){try{const active=JSON.parse(native()?.deviceStatus?.()||'{}').trackingActive;if(active||sharing){await stopTracking();setSharing(false);await refresh();notify('Acompanhamento pausado.');}else{await startTracking(steps);notify('Confirme as permissões no Android para compartilhar sua posição.');}}catch(e){notify((e as Error).message);}return;}
        if (!navigator.geolocation) {
            notify('Este navegador não oferece localização.');
            return;
        }
        if (sharing) {
            if (watch.current !== null)
                navigator.geolocation.clearWatch(watch.current);
            watch.current = null;
            setSharing(false);
            await trackingCall({action:'consent',enabled:false,steps_enabled:false});await refresh();notify('Compartilhamento pausado e posição removida');
            return;
        }
        try{await trackingCall({action:'consent',enabled:true,steps_enabled:false});}catch(e){notify((e as Error).message);return;}
        locationTime.current = 0;
        watch.current = navigator.geolocation.watchPosition(async (pos) => {
            if (Date.now() - locationTime.current < 10000)
                return;
            locationTime.current = Date.now();
            try {
                await trackingCall({action:'location',latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:Math.min(Math.ceil(pos.coords.accuracy),100000)});void refresh();
                setSharing(true);
            }
            catch (e) {
                if (watch.current !== null)
                    navigator.geolocation.clearWatch(watch.current);
                watch.current = null;
                setSharing(false);
                notify(e instanceof Error ? e.message : 'Falha ao compartilhar localização.');
            }
        }, error => {
            setSharing(false);
            if (watch.current !== null)
                navigator.geolocation.clearWatch(watch.current);
            watch.current = null;
            notify(error.code === 1 ? 'Permita a localização nas configurações do navegador para compartilhar.' : 'Não conseguimos obter sua posição. Tente novamente em um lugar aberto.');
        }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
        notify('Buscando sua posição…');
    }
    function exportCalendar() {
    if (!state)
            return;
        const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
        const dt = (s: string) => new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        const events = state.items.filter(i => i.data.kind === 'event').map(i => {
            const d = i.data as Extract<ItemData, {
                kind: 'event';
            }>;
            return `BEGIN:VEVENT\r\nUID:${i.id}@namora\r\nDTSTAMP:${dt(new Date().toISOString())}\r\nDTSTART:${dt(d.date)}\r\nSUMMARY:${esc(d.title)}\r\nDESCRIPTION:${esc(d.note)}\r\nEND:VEVENT`;
        });
        download('nossa-agenda.ics', `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Namora//Agenda//PT-BR\r\n${events.join('\r\n')}\r\nEND:VCALENDAR`, 'text/calendar');
    }
        useEffect(()=>{if(native()&&state&&!demo&&localStorage.getItem('namora.native.reminders')==='on')native()!.reminders(JSON.stringify(reminderPayload(state)));},[state,demo]);
    useEffect(()=>{const onNative=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.signOut){void logoutRef.current();return;}if(d?.tracking!==undefined){setSharing(!!d.tracking);if(!d.tracking)void refresh();}if(d?.trackingDenied){setSharing(false);void stopTracking().catch(()=>{});}if(d?.info)notify(d.info);if(d?.error)notify(d.error);if(d?.speaking!==undefined)setOrbSpeaking(!!d.speaking);if(d?.image)setLilithOpen(true);if(d?.invite){setInvitation(d.invite);sessionStorage.setItem('amora.invite',d.invite);setLinkMode('join');setLinkStarted(true);setModal('link');}if(d?.route){setAppsOpen(false);setModal(null);if(d.route==='apps'||d.route==='more'){setAppsOpen(true);setLilithOpen(false);}else if(d.route==='lilith')setLilithOpen(true);else if(nav.some(n=>n.id===d.route)){setAppsOpen(false);setLilithOpen(false);setTab(d.route);setChatOpen(d.route==='chat');}}};window.addEventListener('amora-native',onNative);const pending=(window as any).__amoraPending;if(pending)onNative(new CustomEvent('amora-native',{detail:pending}));return()=>window.removeEventListener('amora-native',onNative);},[notify]);
    useEffect(()=>{const back=(e:Event)=>{if(!(e as CustomEvent).detail?.back)return;if(appsOpen)setAppsOpen(false);else if(modal)setModal(null);else if(lilithOpen)setLilithOpen(false);else if(chatOpen){setChatOpen(false);setTab('home');}else if(tab!=='home')setTab('home');else native()?.background?.();};window.addEventListener('amora-native',back);return()=>window.removeEventListener('amora-native',back);},[appsOpen,modal,lilithOpen,chatOpen,tab]);
    useEffect(()=>{if(demo||!backendReady||!state?.couple)return;let busy=false;const complete=async(d:any)=>{if(!d?.code||!d.state||busy)return;busy=true;try{await amoraCall({action:'drive-complete',code:d.code,state:d.state});notify('Google Drive conectado ao cantinho de vocês.');window.dispatchEvent(new Event('amora-drive-connected'));}catch(e){notify((e as Error).message);}finally{busy=false;}};const cb=(e:Event)=>{const d=(e as CustomEvent).detail;if(d?.driveCallback)void complete(d.driveCallback);};window.addEventListener('amora-native',cb);const pending=(window as any).__amoraPending;if(pending?.driveCallback){void complete(pending.driveCallback);delete pending.driveCallback;}const q=new URLSearchParams(location.search);if(q.has('drive_code')){const data={code:q.get('drive_code'),state:q.get('drive_state')};q.delete('drive_code');q.delete('drive_state');history.replaceState(null,'',location.pathname+(q.size?'?'+q:'')+location.hash);void complete(data);}return()=>window.removeEventListener('amora-native',cb);},[demo,backendReady,state?.couple?.id,notify]);
    useEffect(()=>{const active=chatOpen||lilithOpen;if(active&&!history.state?.amoraConversation)history.pushState({...history.state,amoraConversation:true},'');else if(!active&&history.state?.amoraConversation){ignoreConversationPop.current=true;history.back();}},[chatOpen,lilithOpen]);
    useEffect(()=>{const back=()=>{if(ignoreConversationPop.current){ignoreConversationPop.current=false;return;}if(!history.state?.amoraConversation){setChatOpen(false);setLilithOpen(false);setTab('home');}};window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);},[]);
    useEffect(()=>{if(auth&&invitation){setLinkMode('join');setLinkStarted(true);if(state?.couple)setModal('link');}},[auth,invitation,state?.couple?.id]);
    if(!booted) return <div className="loading"><Mascot/><h2>Abrindo nosso cantinho…</h2></div>;
    if(state&&((demo&&!explore)||(!demo&&!state.couple&&!explore)))return <div className="onboarding"><div className="onboard-brand"><FallingBerry/><h1>(N)AMORA</h1><p>Um espaço só de vocês dois.</p></div><div className="onboard-card">{demo&&invitation&&<div className="pending-invite"><p>Seu convite está pronto. Entre ou crie sua conta para confirmar.</p>{!native()&&<a className="button secondary full" href={'amora://invite?code='+invitation}>Abrir convite no aplicativo Android</a>}</div>}{demo?<AuthPanel recovery={recovering} onDone={()=>{setRecovering(false);void refresh(true);}} onNotify={notify}/>:<><span className="eyebrow">O COMEÇO DE NÓS</span><h2>{invitation?'Seu amor mandou um convite ♡':'Vamos criar nosso cantinho?'}</h2><p>Uma conta para cada pessoa. Um espaço para vocês dois.</p>{!linkStarted&&!invitation?<div className="cantinho-choices"><button className="button full" onClick={()=>{setLinkMode('create');setLinkStarted(true);}}>Criar nosso cantinho <Heart size={18}/></button><button className="button secondary full" onClick={()=>{setLinkMode('join');setLinkStarted(true);}}>Tenho um convite <Link2 size={18}/></button></div>:<><div className="segmented"><button className={linkMode==='create'?'active':''} onClick={()=>{setLinkMode('create');setLinkError('');}}>Criar cantinho</button><button className={linkMode==='join'?'active':''} onClick={()=>{setLinkMode('join');setLinkError('');}}>Tenho um convite</button></div><form className="form" onSubmit={link}><label>Seu nome<input name="name" required maxLength={50} defaultValue={state.user.displayName}/></label>{linkMode==='create'?<><label>Nome do nosso cantinho<input name="title" required maxLength={70} placeholder="Nosso cantinho"/></label><label>Juntos desde (opcional)<input type="date" name="since"/></label><WallpaperPicker value={wallpaper} onChange={setWallpaper}/></>:<label>Código do seu amor<input key={invitation} name="code" required minLength={10} maxLength={20} defaultValue={invitation} placeholder="10 letras e números" autoCapitalize="characters" autoComplete="off"/></label>}{linkError&&<p className="form-error" role="alert">{linkError}</p>}<button className="button full" disabled={busy}>{busy?'Conectando…':linkMode==='create'?'Criar nosso cantinho':'Confirmar e entrar no cantinho'}</button></form><button className="text-button" onClick={()=>{setLinkStarted(false);setInvitation('');sessionStorage.removeItem('amora.invite');}}>Voltar</button></>}<button className="text-button" onClick={()=>setExplore(true)}>Fazer isso depois</button><button className="text-button" onClick={()=>void signOut()}>Trocar de conta</button></>}</div>{demo&&<button className="text-button explore-button" onClick={()=>setExplore(true)}>Conhecer com dados de exemplo</button>}{toast&&<div className="toast" role="status">{toast}</div>}</div>;
    if (!state)
        return <div className="loading"><Mascot /><h2>Preparando nosso cantinho…</h2></div>;
    const me = state.members.find(m => m.userId === state.user.userId);
    const partner = state.members.find(m => m.userId !== state.user.userId);
    const today = new Date();
    const tasks = state.items.filter(x => x.data.kind === 'task');
    const pending = tasks.filter(x => x.data.kind === 'task' && !x.data.done);
    const events = state.items.filter(x => x.data.kind === 'event').sort((a, b) => (a.data.kind === 'event' ? a.data.date : '').localeCompare(b.data.kind === 'event' ? b.data.date : ''));
    const upcoming = events.filter(x => x.data.kind === 'event' && new Date(x.data.date).getTime() >= Date.now() - 3600000);
    const expenses = state.items.filter(x => x.data.kind === 'expense' && x.data.date.slice(0, 7) === expenseMonth);
    const total = expenses.reduce((s, x) => s + (x.data.kind === 'expense' ? x.data.cents : 0), 0);
    const daysTogether = state.couple?.since ? Math.max(0, Math.floor((new Date(dayKey(today) + 'T12:00:00').getTime() - new Date(state.couple.since + 'T12:00:00').getTime()) / 86400000)) : 0;
    const nextMilestone = upcomingMilestones(state.items)[0];
    const completed = tasks.length - pending.length;
    const titleMap: Record<Tab, string> = {camera:'Nossa câmera',album:'Nossas lembranças',files:'Nossos arquivos',apps:'Aplicativos',chat:'Seu amor, logo aqui.',games:'Um tempinho para brincar.',paint:'Memórias em cada traço.',notes:'O que a gente imagina junto.',more:'Tudo o que é nosso.', history: 'Os dias que viraram nós.', ideas: 'Boas ideias, lindas memórias.', home: 'A vida fica mais bonita a dois.', agenda: 'Tempo para o que importa.', lists: 'Pequenos planos, juntos.', expenses: 'Dividir também é cuidar.', map: 'Pertinho, mesmo de longe.', lilith: 'Um carinho na sua rotina.' };
    return <div className={'app-shell mobile-shell'+(tab==='map'?' map-mode':'')+(tab==='camera'?' camera-mode':'')+(tab==='chat'&&chatOpen?' conversation-mode':'')+(new URLSearchParams(location.search).has('overlay')?' overlay-shell':'')}>{celebrating && <div className="love-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} style={{ '--i': i } as React.CSSProperties}>♡</span>)}</div>}
 <SafetyMonitor state={state} demo={demo} notify={notify}/><header className="topbar"><a className="wordmark" href="#" onClick={e => { e.preventDefault(); switchTab('home'); }}><span className="brand-icon"><Mascot small/></span><span>(N)AMORA</span></a><div className="top-caption">Um cantinho só de vocês <Heart size={11}/></div><div className="header-actions"><SOSButton state={state} enabled={sosEnabled} notify={notify}/>{demo && <span className="demo-pill">Demonstração</span>}<button className="icon-button notification-button" onClick={() => open('notifications')} aria-label="Notificações"><Bell size={20}/>{pending.length > 0 && <span className="notification-dot"/>}</button><button className="icon-button" onClick={() => open('settings')} aria-label="Configurações"><Settings size={20}/></button><button className="profile-button" onClick={() => open('settings')} aria-label="Meu perfil"><Avatar name={me?.name || state.user.displayName}/></button></div></header>
 <main className="main-content" onPointerDown={e=>{if((e.target as HTMLElement).closest('input,button,textarea,select,a,canvas,.partner-chat,.camera-app,.lilith-sheet,.safety-map'))return;swipe.current={x:e.clientX,y:e.clientY};}} onPointerUp={e=>{const p=swipe.current;swipe.current=null;if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.abs(dx)>85&&Math.abs(dy)<65){const i=prefs.dock.indexOf(tab as AppId);if(i>=0){const next=prefs.dock[i+(dx<0?1:-1)];if(next)switchTab(next);}}}}><div className="page-intro"><div><div className="date-label"><span className="tiny-sun">☀</span>{today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1>{titleMap[tab]}</h1><p>{tab === 'home' ? 'Planos, carinho e um pouquinho de organização. Tudo no mesmo lugar.' : tab === 'lilith' ? 'Conheça a Lilith, sua companheirinha de planos e ideias.' : 'Um espaço para cuidar dos pequenos detalhes da vida de vocês.'}</p></div><div className={`sync-pill ${connection === 'Reconectando…' ? 'warning' : ''}`}><span />{demo ? 'Explore com dados de exemplo' : connection}</div></div>
 {demo && <div className="demo-banner"><span><Leaf size={15}/><strong>Este cantinho é uma prévia.</strong> Edite à vontade; os exemplos não são dados reais.</span><a href="#entrar" onClick={e => { e.preventDefault(); open('auth'); }}>Entrar ou criar conta <ArrowRight size={14}/></a></div>}
 {!demo && !state.couple && <div className="welcome-banner"><div><Heart size={24}/><span><strong>Vamos criar o mundo de vocês?</strong><small>Crie um vínculo ou entre com o convite do seu amor.</small></span></div><button className="button" onClick={() => open('link')}>Começar <ArrowRight size={16}/></button></div>}
 {!demo&&state.couple&&!partner&&<div className="invite-strip"><span>{code?<>Convite para seu amor: <b>{code}</b></>:'Seu vínculo está pronto. Falta seu amor entrar.'}</span><button className="button secondary small-button" onClick={()=>open('link')}>{code?'Copiar convite':'Convidar meu amor'}</button></div>}
 <FeatureBoundary key={tab} onRecover={()=>{switchTab('home');setAppsOpen(true);}}><div className={`tab-stage enter-${direction}`}>
 <Suspense fallback={<div className="empty">Abrindo aplicativo…</div>}>
 {tab==='camera'&&<CameraApp cid={state.couple?.id||''} uid={state.user.userId} demo={demo} notify={notify} onAlbum={()=>switchTab('album')}/>}
 {(tab==='album'||tab==='files')&&<FilesApp cid={state.couple?.id||''} uid={state.user.userId} demo={demo} view={tab} notify={notify} onCamera={()=>switchTab('camera')}/>}
 </Suspense>
 {tab === 'history' && <HistoryPanel items={state.items} busy={busy} onToast={notify} onSave={saveShared} onDelete={deleteShared}/>}
 {tab === 'ideas' && <IdeasPanel items={state.items} onSave={saveShared} onToast={notify}/>}
 {tab === 'home' && <div className="page-animation"><section className="home-grid"><div className="daily-card"><div><span className="eyebrow">NOSSO CANTO</span><h2>Oi, {me?.name||state.user.displayName}.</h2><p>{daysTogether?`${daysTogether.toLocaleString('pt-BR')} dias escrevendo a nossa história.`:'Nosso próximo capítulo começa aqui.'}</p><div className="daily-actions"><button className="button" onClick={()=>switchTab('chat')}><MessageCircle size={17}/> Falar com {partner?.name||'meu amor'}</button><button className="button secondary" onClick={()=>setLilithOpen(true)}>Chamar Lilith</button></div>{nextMilestone&&<button className="next-memory" onClick={()=>switchTab('history')}>{nextMilestone.days===0?'É hoje!':`Faltam ${nextMilestone.days} dias`} · {nextMilestone.item.data.title} ↗</button>}</div><FallingBerry/></div>
 <aside className="us-card"><div className="card-heading"><h3>Nós dois</h3><button className="icon-button" onClick={() => {setSettingsView('couple');open(state.couple?'settings':'link');}} aria-label="Gerenciar vínculo"><Ellipsis size={20}/></button></div><div className="couple-avatars"><Avatar name={me?.name || 'Você'} large/><span className="couple-heart"><Heart size={17} fill="currentColor"/></span>{partner ? <Avatar name={partner.name} index={1} large/> : <button className="avatar large add-partner" onClick={() => open('link')} aria-label="Adicionar parceiro"><Plus size={25}/></button>}</div><div className="couple-names">{me?.name || 'Você'} <span>&</span> {partner?.name || 'seu amor'}</div><span className="couple-since">{state.couple?.since ? `Escrevendo nossa história desde ${dateText(state.couple.since, { month: 'short', year: 'numeric' })}` : 'Duas pessoas, um novo começo.'}</span><div className="us-divider"/><div className="mood-line"><div><span className="mood-emoji">{moods.find(x => x[0] === me?.mood)?.[1] || '🤍'}</span><span>Como você está?<strong>{me?.mood || 'Conta para o seu amor'}</strong></span></div><button className="text-button" onClick={() => open('mood')}>Contar <ArrowUpRight size={13}/></button></div>{partner?.mood && <p className="partner-mood">{partner.name} está {partner.mood} {moods.find(x => x[0] === partner.mood)?.[1]}</p>}</aside></section>
 <section className="home-apps">{nav.filter(n=>['camera','album','files','games'].includes(n.id)).map(n=><button key={n.id} onClick={()=>switchTab(n.id)}><n.icon size={24}/><span>{n.label}</span></button>)}</section><section className="couple-focus"><button className="story-shortcut" onClick={() => switchTab('history')}><span className="quick-icon lilac"><CalendarHeart size={24}/></span><div><span className="eyebrow">NOSSA HISTÓRIA</span><h3>Os dias que a gente não esquece.</h3><p>{nextMilestone ? `${nextMilestone.days === 0 ? 'Hoje' : 'Em ' + nextMilestone.days + ' dias'} · ${nextMilestone.item.data.title}` : 'Primeiro encontro, pedido de namoro, noivado…'}</p></div><ArrowUpRight size={18}/></button><button className="ideas-shortcut" onClick={() => switchTab('ideas')}><Lightbulb size={26}/><span>Um encontro para chamar de nosso.<small>Abra o potinho de ideias</small></span><ArrowRight size={17}/></button></section><section className="quick-actions"><button onClick={() => open('task')}><span className="quick-icon green"><CheckCheck size={20}/></span><span>Nova tarefa<small>Um passo de cada vez</small></span><Plus size={16}/></button><button onClick={() => open('event')}><span className="quick-icon peach"><CalendarDays size={20}/></span><span>Marcar um momento<small>Tempo para vocês</small></span><Plus size={16}/></button><button onClick={() => open('expense')}><span className="quick-icon lilac"><Wallet size={20}/></span><span>Adicionar despesa<small>Contas em sintonia</small></span><Plus size={16}/></button></section>
 <section className="overview-grid"><div className="card tasks-card"><div className="card-heading"><h3><CheckCheck size={18}/> Nossos combinados</h3><button className="text-button" onClick={() => switchTab('lists')}>Ver todos <ArrowUpRight size={14}/></button></div><p className="card-description">Pequenas coisas que fazem a diferença.</p><div className="progress-line"><span><strong>{completed}</strong> de {tasks.length} feitos</span><span className="progress-track"><i style={{ width: `${tasks.length ? completed / tasks.length * 100 : 0}%` }}/></span></div>{tasks.length ? tasks.slice(0, 3).map(i => <TaskRow key={i.id} item={i} members={state.members} busy={busy} onToggle={i => void toggle(i)} onEdit={i => open('task', i)}/>) : <Empty icon={Leaf} title="Um dia de cada vez">Adicione o primeiro combinado de vocês.</Empty>}<button className="subtle-add" onClick={() => open('task')}><Plus size={15}/> Adicionar um combinado</button></div>
 <div className="card agenda-card"><div className="card-heading"><h3><CalendarDays size={18}/> Vem aí</h3><button className="icon-button" onClick={() => switchTab('agenda')} aria-label="Abrir agenda"><ArrowUpRight size={17}/></button></div><p className="card-description">Os próximos capítulos da nossa rotina.</p>{upcoming.length ? upcoming.slice(0, 2).map(i => <EventRow key={i.id} item={i} onEdit={i => open('event', i)}/>) : <Empty icon={CalendarDays} title="Espaço para bons planos">Que tal marcar um encontro?</Empty>}<button className="agenda-link" onClick={() => switchTab('agenda')}>Abrir nossa agenda <ArrowRight size={14}/></button></div>
 <div className="card finance-card"><div className="card-heading"><h3><Wallet size={18}/> Nosso bolso</h3><button className="icon-button" onClick={() => switchTab('expenses')} aria-label="Abrir despesas"><ArrowUpRight size={17}/></button></div><p className="card-description">{dateText(expenseMonth + '-01', { month: 'long', year: 'numeric' })}</p><div className="money-total">{money(total)}</div><span className="muted-small">em despesas registradas</span><div className="spend-bars">{['Faculdade', 'Alimentação', 'Lazer'].map((c, i) => { const value = expenses.reduce((s, x) => s + (x.data.kind === 'expense' && x.data.category === c ? x.data.cents : 0), 0); return <div key={c}><span><i className={`legend-dot dot${i}`}/>{c}</span><strong>{money(value)}</strong></div>; })}</div><button className="finance-link" onClick={() => switchTab('expenses')}>Cuidar das nossas contas <ArrowRight size={14}/></button></div></section>
 <section className="home-bottom"><div><span className="tiny-heart">♡</span><p>{daysTogether ? <>Há <strong>{daysTogether.toLocaleString('pt-BR')} dias</strong> escolhendo estar juntos.</> : 'A melhor parte dos planos é fazer juntos.'}</p></div><span>Feito para a vida real. E para vocês. <Leaf size={12}/></span></section></div>}
 {tab === 'lists' && <div className="page-animation"><div className="section-toolbar"><div className="segmented">{['Todas', 'Pendentes', 'Feitas'].map(f => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div><button className="button" onClick={() => open('task')}><Plus size={17}/> Nova tarefa</button></div><div className="list-layout"><div className="card big-list"><label className="search-field"><Search size={18}/><input aria-label="Buscar tarefas" placeholder="Encontre um combinado…" value={search} onChange={e => setSearch(e.target.value)}/></label>{tasks.filter(i => i.data.kind === 'task' && (filter === 'Todas' || (filter === 'Feitas' ? i.data.done : !i.data.done)) && i.data.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(i => <TaskRow key={i.id} item={i} members={state.members} busy={busy} onToggle={i => void toggle(i)} onEdit={i => open('task', i)}/>)}{!tasks.length && <Empty icon={CheckCheck} title="O primeiro passo pode ser pequeno">Crie listas de compras, tarefas da casa ou planos para vocês.</Empty>}</div><aside className="note-card"><Leaf size={25}/><h3>Uma dupla, sem sobrecarga.</h3><p>Dividam os combinados e celebrem as pequenas conquistas. Nem tudo precisa ser feito hoje.</p><div className="note-stat"><strong>{pending.length}</strong><span>passinhos esperando<br />por vocês</span></div><button className="text-button" onClick={() => switchTab('lilith')}>Pedir uma ajudinha à Lilith <ArrowUpRight size={15}/></button></aside></div></div>}
 {tab === 'agenda' && <div className="page-animation"><div className="section-toolbar"><span className="section-kicker">Nossa agenda compartilhada</span><div className="button-group"><button className="button secondary small-button" aria-label="Exportar agenda" onClick={exportCalendar}><Download size={16}/><span>Exportar agenda</span></button><button className="button" onClick={() => open('event')}><Plus size={17}/> Novo evento</button></div></div><div className="calendar-layout"><div className="card calendar"><div className="calendar-head"><button className="icon-button" aria-label="Mês anterior" onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); setSelectedDay(''); }}><ChevronLeft size={20}/></button><h2>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2><button className="icon-button" aria-label="Próximo mês" onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); setSelectedDay(''); }}><ChevronRight size={20}/></button></div><div className="calendar-grid">{['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => <span key={d} className="weekday">{d}</span>)}{Array.from({ length: month.getDay() }, (_, i) => <span key={'empty' + i}/>)}{Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => { const key = dayKey(new Date(month.getFullYear(), month.getMonth(), i + 1)); const has = events.some(e => e.data.kind === 'event' && dayKey(new Date(e.data.date)) === key); return <button key={key} aria-label={`${i + 1} ${month.toLocaleDateString('pt-BR', { month: 'long' })}${has ? ', tem evento' : ''}`} className={`calendar-day ${key === dayKey(today) ? 'today' : ''} ${selectedDay === key ? 'selected' : ''}`} onClick={() => setSelectedDay(selectedDay === key ? '' : key)}><span>{i + 1}</span>{has && <i />}</button>; })}</div><div className="calendar-caption"><span className="live-dot"/> Um pontinho, um plano para viver.</div></div><div className="card"><div className="card-heading"><h3>{selectedDay ? dateText(selectedDay, { day: 'numeric', month: 'long' }) : 'Planos deste mês'}</h3>{selectedDay && <button className="icon-button" aria-label="Limpar seleção" onClick={() => setSelectedDay('')}><X size={16}/></button>}</div>{events.filter(i => i.data.kind === 'event' && (selectedDay ? dayKey(new Date(i.data.date)) === selectedDay : new Date(i.data.date).getMonth() === month.getMonth() && new Date(i.data.date).getFullYear() === month.getFullYear())).map(i => <EventRow key={i.id} item={i} onEdit={i => open('event', i)}/>)}{!events.some(i => i.data.kind === 'event' && (selectedDay ? dayKey(new Date(i.data.date)) === selectedDay : new Date(i.data.date).getMonth() === month.getMonth() && new Date(i.data.date).getFullYear() === month.getFullYear())) && <Empty icon={CalendarDays} title="Um espaço em branco">Um bom momento para planejar algo especial.</Empty>}<button className="subtle-add" onClick={() => open('event')}><Plus size={16}/> Guardar um novo plano</button></div></div></div>}
 {tab==='expenses'&&<Finance state={state} demo={demo} notify={notify} onEditExpense={i=>open('expense',i)} onAddExpense={()=>open('expense')} onSaveExpense={saveShared} onDeleteExpense={deleteShared} onLilith={()=>setLilithOpen(true)}/>}
 {tab==='chat'&&(chatOpen?<PartnerChat state={state} demo={demo} notify={notify} onBack={()=>{setChatOpen(false);setTab('home');}}/>:<section className="chat-contacts"><h2>Conversas</h2><p>Com quem vamos conversar?</p><button className="contact-row" onClick={()=>setChatOpen(true)}><Avatar name={partner?.name||'Seu amor'} large/><span><strong>{partner?.name||'Seu amor'}</strong><small>Nosso espaço, só nós dois.</small></span><ChevronRight/></button><button className="contact-row" onClick={()=>setLilithOpen(true)}><Orb small/><span><strong>Lilith</strong><small>Ideias, planos e uma ajudinha.</small></span><ChevronRight/></button></section>)}
 {tab==='games'&&<Games state={state} demo={demo} notify={notify}/>}
 {tab==='paint'&&<Whiteboard state={state} demo={demo} notify={notify}/>}
 {tab==='notes'&&<Notes state={state} demo={demo} notify={notify}/>}
 {tab==='more'&&<section className="together-grid">{nav.filter(n=>!['more','lilith'].includes(n.id)).map(n=><button className="together-tile" key={n.id} onClick={()=>switchTab(n.id)}><n.icon size={27}/><strong>{n.label}</strong><span>Abrir ↗</span></button>)}</section>}
 {tab==='map'&&<SafetyMap state={state} demo={demo} sharing={sharing} notify={notify} onLocate={steps=>void locate(steps)} onBack={()=>switchTab('home')} onJoin={openJoin} onApps={()=>setAppsOpen(true)} sos={<SOSButton state={state} enabled={sosEnabled} notify={notify}/>}/>}

 </div></FeatureBoundary>
 </main>
 <MobileDock prefs={prefs} tab={tab} onOpen={switchTab} onApps={()=>setAppsOpen(true)}/><AppsDrawer open={appsOpen} onClose={()=>setAppsOpen(false)} onOpen={switchTab} prefs={prefs} onChange={setPrefs} onSettings={()=>{setAppsOpen(false);setSettingsView('personal');open('settings');}} onJoin={openJoin}/>
 <button className="lilith-fab" onClick={()=>setLilithOpen(true)} aria-label="Abrir Lilith"><Orb small speaking={orbSpeaking}/></button>
 {lilithOpen&&<Lilith state={state} demo={demo} notify={notify} onClose={()=>{setLilithOpen(false);if(new URLSearchParams(location.search).has('overlay'))native()?.closeOverlay();}} onRefresh={refresh} onSettings={()=>{setLilithOpen(false);setSettingsView('ai');open('settings');}} onNavigate={next=>{if(nav.some(n=>n.id===next)){if(new URLSearchParams(location.search).has('overlay')&&native())native()!.openApp(next);else{setLilithOpen(false);switchTab(next as Tab);}}}}/>}
 {toast && <div className="toast" role="status"><Heart size={16}/>{toast}<button onClick={() => setToast('')} aria-label="Dispensar"><X size={15}/></button></div>}
 {modal && <Dialog title={modal === 'auth' ? 'Bem-vindos ao nosso mundo' : modal === 'settings' ? 'Do nosso jeitinho' : modal === 'link' ? 'Um vínculo, dois corações' : modal === 'mood' ? 'Como está seu coração?' : modal === 'notifications' ? 'Um toque de carinho' : editing ? 'Editar nosso plano' : modal === 'task' ? 'Um novo combinado' : modal === 'event' ? 'Vamos marcar um momento?' : 'Uma despesa para organizar'} onClose={() => { setModal(null); setEditing(null); }}>
 {modal === 'auth' && <AuthPanel recovery={recovering} onDone={() => { setRecovering(false); setModal(null); void refresh(true); }} onNotify={notify}/>}
 {(modal === 'task' || modal === 'event' || modal === 'expense') && <Editor kind={modal} item={editing} members={state.members} userId={state.user.userId} onSave={save} onDelete={() => void remove()} busy={busy}/>}
 {modal === 'mood' && <div className="mood-picker"><p>Sem cobrança. Só um jeitinho de se fazer presente.</p>{moods.map(([value, emoji]) => <button key={value} className={me?.mood === value ? 'active' : ''} disabled={busy || (!demo && !state.couple)} onClick={async () => {
                        if (await run({ action: 'mood', mood: value }, 'Seu amor já pode ver como você está'))
                            setModal(null);
                    }}><span>{emoji}</span>{value}<Heart size={16}/></button>)}</div>}
 {modal === 'link' && <div className="link-content">{!auth ? <><div className="link-illustration"><Heart size={42}/><Link2 size={25}/></div><h3>Um login para cada um.<br />Um cantinho para os dois.</h3><p>Entre com seu e-mail e senha. Depois, crie um vínculo e envie o código para o seu amor, ou entre com o convite que recebeu.</p><a className="button full" href="#entrar" onClick={e => { e.preventDefault(); open('auth'); }}>Entrar e começar <ArrowRight size={17}/></a><p className="muted-small">Cada pessoa usa uma conta própria. Os registros ficam visíveis apenas dentro do vínculo.</p></> : state.couple&&linkMode!=='join' ? <><div className="link-illustration"><Link2 size={42}/></div><h3>{partner ? 'Vocês já estão conectados!' : 'Falta só o seu amor chegar.'}</h3><p>{partner ? 'Agenda, listas e despesas aparecem para os dois.' : 'Gere um código e compartilhe com seu parceiro. Ele entra na própria conta e escolhe “Entrar em um vínculo”.'}</p>{!partner && <><button className="button full" disabled={busy} onClick={async () => {
                            const r = await run({ action: 'invite' });
                            if (r?.code)
                                setCode(r.code);
                        }}>Gerar novo convite <Link2 size={16}/></button>{code && <InviteCard code={code} notify={notify}/>}<p className="muted-small">Compartilhe o endereço do app e o convite diretamente com seu amor.</p></>}<button className="button secondary full" onClick={openJoin}>Tenho um código de convite <Link2 size={16}/></button></> : <><p className="card-description">Cada pessoa usa sua própria conta. O convite une os planos de vocês.</p><div className="segmented link-tabs"><button disabled={!!state.couple} className={linkMode === 'create' ? 'active' : ''} onClick={() => { setLinkMode('create'); setLinkError(''); }}>Criar nosso cantinho</button><button className={linkMode === 'join' ? 'active' : ''} onClick={() => { setLinkMode('join'); setLinkError(''); }}>Entrar em um vínculo</button></div><form className="form" onSubmit={link}><label>Como quer ser chamado(a)?<input name="name" required maxLength={50} defaultValue={state.user.displayName}/></label>{linkMode === 'create' ? <><label>Nome do nosso cantinho<input name="title" required maxLength={70} defaultValue="Nosso pequeno mundo"/></label><label>Juntos desde (opcional)<input name="since" type="date" max={dayKey(today)}/></label></> : <label>Código do seu amor<input name="code" required maxLength={20} placeholder="10 letras e números" key={invitation} defaultValue={invitation} minLength={10} autoCapitalize="characters" autoComplete="off"/></label>}{state.couple&&linkMode==='join'&&<div className="join-existing-note"><p>Você está em <strong>{state.couple.name}</strong>. Para usar outro convite, primeiro desvincule sua conta. Os registros ficam no cantinho atual; eles não são transferidos.</p><button type="button" className="button secondary full" disabled={busy} onClick={async e=>{const form=e.currentTarget.closest('form');const code=cleanInvite(String(new FormData(form!).get('code')||''));if(!code){setLinkError('Digite o código completo antes de continuar.');return;}if(!confirm('Desvincular sua conta de '+state.couple!.name+'? Você perderá acesso aos registros deste cantinho. Depois poderá confirmar o novo convite.'))return;setBusy(true);try{if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);await stopTracking().catch(()=>{});setSharing(false);await action({action:'leave'});setCode('');setInvitation(code);sessionStorage.setItem('amora.invite',code);setLinkStarted(true);}catch(err){setLinkError((err as Error).message);}finally{setBusy(false);}}}>Desvincular para usar este código</button></div>}{linkError && <p className="form-error" role="alert">{linkError}</p>}<button className="button full" disabled={busy||!!state.couple}>{busy ? 'Conectando…' : linkMode === 'create' ? 'Criar nosso cantinho' : 'Entrar no nosso mundo'}<Heart size={16}/></button></form></>}</div>}
 {modal === 'settings' && <div className="settings-content"><nav className="settings-tabs">{[['personal','Meu app'],['ai','Lilith'],['files','Drive'],['couple','Nós dois']].map(([id,label])=><button key={id} className={settingsView===id?'active':''} onClick={()=>setSettingsView(id)}>{label}</button>)}</nav>{settingsView==='personal'&&<><section className="settings-section"><h3><Link2 size={18}/> Nosso vínculo</h3><button className="settings-row" onClick={openJoin}><span>Entrar com código<small>Usar o convite do meu amor</small></span><ChevronRight size={18}/></button><button className="settings-row" onClick={()=>{setLinkMode('create');open('link');}}><span>Convidar ou gerenciar vínculo<small>{state.couple?.name||'Criar nosso cantinho'}</small></span><ChevronRight size={18}/></button></section><MobileSettings prefs={prefs} onChange={setPrefs} theme={theme} setTheme={setTheme} wallpaper={wallpaper} setWallpaper={setWallpaper}/><SOSSettings enabled={sosEnabled} onChange={v=>{setSosEnabled(v);localStorage.setItem('namora.sos.enabled',v?'on':'off');}}/></>} {settingsView==='ai'&&<AISettings linked={!demo&&state.members.length===2} notify={notify}/>} {settingsView==='files'&&<DriveSettings linked={!demo&&!!state.couple} notify={notify}/>}<div hidden={settingsView!=='couple'}><div className="settings-section"><h3><Heart size={18}/> Nosso vínculo</h3><button className="settings-row" onClick={() => {setLinkMode('create');open('link');}}><span>{partner ? 'Gerenciar vínculo' : 'Adicionar meu amor'}<small>{state.couple?.name || 'Criar ou entrar em um vínculo'}</small></span><ChevronRight size={18}/></button>{state.couple && <form className="form compact" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await run({ action: 'couple', name: f.get('name'), since: f.get('since') || null }, 'Cantinho atualizado'); }}><label>Nome do cantinho<input name="name" defaultValue={state.couple.name} required maxLength={70}/></label><label>Juntos desde<input name="since" type="date" defaultValue={state.couple.since || ''} max={dayKey(today)}/></label><button className="button secondary" disabled={busy}>Salvar nosso cantinho</button></form>}{me && <form className="form compact" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await run({ action: 'profile', name: f.get('name') }, 'Seu nome foi atualizado'); }}><label>Meu nome<input name="name" required maxLength={50} defaultValue={me.name}/></label><button className="button secondary" disabled={busy}>Atualizar meu nome</button></form>}</div><div className="settings-section"><h3><Bell size={18}/> Lembretes e aplicativo</h3><button className="settings-row" onClick={() => { const next = !sounds; setSounds(next); localStorage.setItem('namora.sounds.v1', next ? 'on' : 'off'); if (next)
                playSound('success'); }}><span>Sons suaves do aplicativo<small>Toques nas abas, confirmações e lembretes</small></span>{sounds ? <Volume2 size={19}/> : <VolumeX size={19}/>}</button><button className="settings-row" onClick={() => {
                    if (notificationOn) {
                        setNotificationOn(false);
                        native()?.reminders('[]');localStorage.removeItem('namora.native.reminders');
                        localStorage.removeItem('namora.notifications.v1');
                        notify('Lembretes pausados neste aparelho.');
                    }
                    else
                        void enableNotifications();
                }}><span>Lembretes neste aparelho<small>{notificationOn ? 'Ativos · toque para pausar' : 'Ativar para eventos e tarefas próximos'}</small></span><span className={`toggle ${notificationOn ? 'on' : ''}`}/></button><p className="muted-small">{native()?'No Android, lembretes sincronizados ficam agendados no aparelho. Abra o app para sincronizar alterações do parceiro.':'No navegador, lembretes funcionam com o aplicativo aberto.'}</p><button className="settings-row" onClick={async () => {
                    if(native()){notify('Você já está usando o aplicativo Android.');return;}if (installEvent) {
                        await (installEvent as Event & {
                            prompt: () => Promise<void>;
                        }).prompt();
                        setInstallEvent(null);
                    }
                    else
                        notify('No navegador: menu → Instalar aplicativo ou Adicionar à tela inicial.');
                }}><span>Levar o (N)amora para a tela inicial<small>Instale como aplicativo pelo navegador</small></span><Download size={18}/></button></div><div className="settings-section"><button className="settings-row" onClick={() => download('namora-dados.json', JSON.stringify({ exportedAt: new Date().toISOString(), demo, couple: state.couple, members: state.members, items: state.items }, null, 2))}><span>Exportar nossos dados<small>Uma cópia dos registros em JSON</small></span><Download size={18}/></button>{!demo && <><button className="settings-row" onClick={() => void signOut()}><span>Sair da minha conta</span><LogOut size={18}/></button>{state.couple && <button className="danger-link leave-link" disabled={busy} onClick={async () => {
                            if (window.confirm('Sair do vínculo? Você perderá acesso aos registros compartilhados. Eles continuam no vínculo do outro participante.')) {
                                if (watch.current !== null)
                                    navigator.geolocation.clearWatch(watch.current);
                                setSharing(false);
                                native()?.clearSession();
                                const r = await run({ action: 'leave' }, 'Você saiu do vínculo');
                                if (r) {
                                    setCode('');
                                    setModal(null);
                                }
                            }
                        }}>Desvincular minha conta</button>}</>}</div><button className="settings-row" onClick={() => open('auth')}><span>{auth ? 'Conta e acesso' : 'Entrar ou configurar Supabase'}<small>{backendReady ? 'Banco configurado' : 'Selecione o projeto para conectar os dois aparelhos'}</small></span><ShieldCheck size={18}/></button><p className="version-label">(N)AMORA · Feito de pequenos cuidados · v3.4 · Android e web</p></div></div>}
 {modal === 'notifications' && <div className="notification-content"><div className="notification-intro"><span className="quick-icon peach"><Bell size={23}/></span><div><h3>Para não passar em branco.</h3><p>Lembretes dos próximos planos e combinados.</p></div></div>{[...upcoming.slice(0, 3), ...pending.filter(i => i.data.kind === 'task' && i.data.due).slice(0, 3)].map(i => <div key={i.id} className="reminder-row"><Clock size={18}/><span><strong>{i.data.title}</strong><small>{i.data.kind === 'event' ? dateText(i.data.date) + ' às ' + timeText(i.data.date) : i.data.kind === 'task' && i.data.due ? dateText(i.data.due) + ' às ' + timeText(i.data.due) : ''}</small></span></div>)}{!upcoming.length && !pending.length && <Empty icon={Bell} title="Tudo tranquilo por aqui">Seus próximos lembretes aparecem neste espaço.</Empty>}<button className="button full" onClick={() => void enableNotifications()}>{notificationOn ? 'Lembretes já estão ativos' : 'Ativar lembretes neste aparelho'}<Bell size={16}/></button><p className="muted-small">Avisos até 15 minutos antes, com o aplicativo aberto e a permissão concedida.</p></div>}
 </Dialog>}
 </div>;
}
