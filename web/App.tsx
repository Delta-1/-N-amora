'use client';
import { useState, useEffect, useRef, useCallback, type FormEvent, type ReactNode } from 'react';
import { Heart, Home, CalendarDays, CalendarHeart, Lightbulb, Volume2, VolumeX, CheckCheck, Wallet, MapPin, Sparkles, Plus, ArrowUpRight, ChevronRight, ChevronLeft, Bell, Settings, Check, X, Send, Copy, Link2, LogOut, Palette, Download, Trash2, Pencil, Navigation, ShieldCheck, RefreshCw, ArrowRight, Leaf, Smile, Search, ArrowDownLeft, Ellipsis, Cloud, Clock, ExternalLink } from 'lucide-react';
import Mascot from '../app/components/Mascot';
import AuthPanel from './AuthPanel';
import HistoryPanel from './HistoryPanel';
import IdeasPanel from './IdeasPanel';
import CoupleMap from './CoupleMap';
import { initializeBackend, getClient, getState, backendAction, subscribeCouple, asset } from './supabase';
import { playSound, soundEnabled } from './sounds';
import { upcomingMilestones } from './history';
import { demoState } from './demo';
import { localLilith } from './lilith';
import { money, amountToCents, expenseBalance, recordSchema, type State, type Item, type ItemData, type Member } from './model';
type Tab = 'home' | 'agenda' | 'lists' | 'expenses' | 'map' | 'lilith' | 'history' | 'ideas';
type Modal = 'task' | 'event' | 'expense' | 'settings' | 'link' | 'mood' | 'notifications' | 'auth' | null;
const nav = [{ id: 'home', label: 'Nosso canto', icon: Home }, { id: 'agenda', label: 'Agenda', icon: CalendarDays }, { id: 'history', label: 'História', icon: CalendarHeart }, { id: 'lists', label: 'Listas', icon: CheckCheck }, { id: 'lilith', label: 'Lilith', icon: Sparkles }, { id: 'ideas', label: 'Ideias', icon: Lightbulb }, { id: 'expenses', label: 'Despesas', icon: Wallet }, { id: 'map', label: 'Mapa', icon: MapPin }] as const;
const moods = [['feliz', '😊'], ['apaixonado', '🥰'], ['tranquilo', '😌'], ['cansado', '😴'], ['precisando de carinho', '🥺']];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dateText = (s: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) => new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('pt-BR', options);
const timeText = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const categories: Record<string, string[]> = { task: ['Casa', 'Compras', 'Pessoal', 'Nós dois'], event: ['Encontro', 'Faculdade', 'Aniversário', 'Outro'], expense: ['Casa', 'Alimentação', 'Faculdade', 'Lazer', 'Transporte', 'Outros'] };
function download(name: string, value: string, type = 'application/json') { const url = URL.createObjectURL(new Blob([value], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
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
    const [state, setState] = useState<State | null>(null);
    const [demo, setDemo] = useState(true);
    const [auth, setAuth] = useState(false);
    const [tab, setTab] = useState<Tab>('home');
    const [modal, setModal] = useState<Modal>(null);
    const [editing, setEditing] = useState<Item | null>(null);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState('');
    const [connection, setConnection] = useState('Conectando…');
    const [code, setCode] = useState('');
    const [theme, setTheme] = useState('amora');
    const [linkMode, setLinkMode] = useState<'create' | 'join'>('create');
    const [linkError, setLinkError] = useState('');
    const [notificationOn, setNotificationOn] = useState(false);
    const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [selectedDay, setSelectedDay] = useState('');
    const [filter, setFilter] = useState('Todas');
    const [search, setSearch] = useState('');
    const [expenseMonth, setExpenseMonth] = useState(() => dayKey(new Date()).slice(0, 7));
    const [sharing, setSharing] = useState(false);
    const [selectedPin, setSelectedPin] = useState('');
    const [messages, setMessages] = useState<{
        role: 'user' | 'assistant';
        content: string;
    }[]>([{ role: 'assistant', content: 'Oi, que bom ter vocês aqui! Eu sou a Lilith. Vamos deixar a vida a dois um pouquinho mais leve? 💜' }]);
    const [message, setMessage] = useState('');
    const [chatBusy, setChatBusy] = useState(false);
    const [shareContext, setShareContext] = useState(false);
    const [installEvent, setInstallEvent] = useState<Event | null>(null);
    const [sounds, setSounds] = useState(soundEnabled);
    const [direction, setDirection] = useState('right');
    const [celebrating, setCelebrating] = useState(false);
    const [backendReady, setBackendReady] = useState(false);
    const [recovering, setRecovering] = useState(false);
    const prevTab = useRef<Tab>('home');
    function switchTab(next: Tab) { setDirection(nav.findIndex(n => n.id === next) >= nav.findIndex(n => n.id === prevTab.current) ? 'right' : 'left'); prevTab.current = next; setTab(next); playSound('tab'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    const watch = useRef<number | null>(null);
    const locationTime = useRef(0);
    const chatEnd = useRef<HTMLDivElement>(null);
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
            const stored = localStorage.getItem('namora.theme.v1');
            if (stored)
                setTheme(stored);
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
        } void refresh(true); }).catch(e => notify(e instanceof Error ? e.message : 'Confira a configuração do banco.'));
        const interval = setInterval(() => { if (!document.hidden && !demoRef.current)
            void refresh(); }, 30000);
        const onInstall = (e: Event) => { e.preventDefault(); setInstallEvent(e); };
        window.addEventListener('beforeinstallprompt', onInstall);
        if ('serviceWorker' in navigator)
            void navigator.serviceWorker.register(asset('sw.js'), { scope: import.meta.env.BASE_URL }).catch(() => { });
        return () => { alive = false; unsubscribe?.(); clearInterval(interval); window.removeEventListener('beforeinstallprompt', onInstall); if (watch.current !== null)
            navigator.geolocation.clearWatch(watch.current); if (toastTimer.current)
            clearTimeout(toastTimer.current); };
    }, [refresh, notify]);
    useEffect(() => { if (demo || !state?.couple)
        return; const stop = subscribeCouple(state.couple.id, () => void refresh()); const heartbeat = () => { if (!document.hidden)
        void backendAction({ action: 'presence' }).catch(() => { }); }; heartbeat(); const timer = setInterval(heartbeat, 60000); return () => { stop(); clearInterval(timer); }; }, [demo, state?.couple?.id, refresh]);
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        try {
            localStorage.setItem('namora.theme.v1', theme);
        }
        catch { }
    }, [theme]);
    useEffect(() => {
        if (tab === 'lilith')
            chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [messages, tab]);
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
    async function signOut() { if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current); if (sharing)
        await backendAction({ action: 'location', enabled: false }).catch(() => { }); setSharing(false); await getClient()?.auth.signOut(); setCode(''); setMessages([{ role: 'assistant', content: 'Oi! Sou a Lilith. Sobre o que vamos conversar? 💜' }]); setModal(null); await refresh(true); }
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
    async function link(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (busy)
            return;
        if (!auth) {
            setModal('auth');
            return;
        }
        setLinkError('');
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
            const result = await action({ action: linkMode, name: f.get('name'), title: f.get('title'), since: f.get('since') || null, code: String(f.get('code') || '').replace(/[\s-]/g, '').toUpperCase() });
            if (result.code)
                setCode(result.code);
            else
                setModal(null);
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
    async function locate() {
        if (demo) {
            notify('A localização real fica disponível depois de entrar e criar um vínculo.');
            return;
        }
        if (!navigator.geolocation) {
            notify('Este navegador não oferece localização.');
            return;
        }
        if (sharing) {
            if (watch.current !== null)
                navigator.geolocation.clearWatch(watch.current);
            watch.current = null;
            setSharing(false);
            await run({ action: 'location', enabled: false }, 'Compartilhamento pausado e posição removida');
            return;
        }
        locationTime.current = 0;
        watch.current = navigator.geolocation.watchPosition(async (pos) => {
            if (Date.now() - locationTime.current < 10000)
                return;
            locationTime.current = Date.now();
            try {
                await action({ action: 'location', enabled: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: Math.min(pos.coords.accuracy, 100000) });
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
    async function chat(text: string) {
        if (!text.trim() || chatBusy || !state)
            return;
        const history = messages.slice(-10);
        setMessages(prev => [...prev, { role: 'user', content: text.trim() }]);
        setMessage('');
        setChatBusy(true);
        try {
            const reply = localLilith(text, state.items);
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        }
        catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: e instanceof Error ? e.message : 'Não consegui responder agora.' }]);
        }
        finally {
            setChatBusy(false);
        }
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
    const activeLocation = state.locations.find(l => l.userId === selectedPin) || state.locations[0];
    const titleMap: Record<Tab, string> = { history: 'Os dias que viraram nós.', ideas: 'Boas ideias, lindas memórias.', home: 'A vida fica mais bonita a dois.', agenda: 'Tempo para o que importa.', lists: 'Pequenos planos, juntos.', expenses: 'Dividir também é cuidar.', map: 'Pertinho, mesmo de longe.', lilith: 'Um carinho na sua rotina.' };
    return <div className="app-shell">{celebrating && <div className="love-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} style={{ '--i': i } as React.CSSProperties}>♡</span>)}</div>}
 <header className="topbar"><a className="wordmark" href="#" onClick={e => { e.preventDefault(); switchTab('home'); }}><span className="brand-icon"><Heart size={18} fill="currentColor"/></span><span><i>(N)</i>amora<span className="brand-dot">.</span></span></a><div className="top-caption">Um cantinho só de vocês <Heart size={11}/></div><div className="header-actions">{demo && <span className="demo-pill">Demonstração</span>}<button className="icon-button notification-button" onClick={() => open('notifications')} aria-label="Notificações"><Bell size={20}/>{pending.length > 0 && <span className="notification-dot"/>}</button><button className="icon-button" onClick={() => open('settings')} aria-label="Configurações"><Settings size={20}/></button><button className="profile-button" onClick={() => open('settings')} aria-label="Meu perfil"><Avatar name={me?.name || state.user.displayName}/></button></div></header>
 <main className="main-content"><div className="page-intro"><div><div className="date-label"><span className="tiny-sun">☀</span>{today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1>{titleMap[tab]}</h1><p>{tab === 'home' ? 'Planos, carinho e um pouquinho de organização. Tudo no mesmo lugar.' : tab === 'lilith' ? 'Conheça a Lilith, sua companheirinha de planos e ideias.' : 'Um espaço para cuidar dos pequenos detalhes da vida de vocês.'}</p></div><div className={`sync-pill ${connection === 'Reconectando…' ? 'warning' : ''}`}><span />{demo ? 'Explore com dados de exemplo' : connection}</div></div>
 {demo && <div className="demo-banner"><span><Leaf size={15}/><strong>Este cantinho é uma prévia.</strong> Edite à vontade; os exemplos não são dados reais.</span><a href="#entrar" onClick={e => { e.preventDefault(); open('auth'); }}>Entrar ou criar conta <ArrowRight size={14}/></a></div>}
 {!demo && !state.couple && <div className="welcome-banner"><div><Heart size={24}/><span><strong>Vamos criar o mundo de vocês?</strong><small>Crie um vínculo ou entre com o convite do seu amor.</small></span></div><button className="button" onClick={() => open('link')}>Começar <ArrowRight size={16}/></button></div>}
 <div key={tab} className={`tab-stage enter-${direction}`}>
 {tab === 'history' && <HistoryPanel items={state.items} busy={busy} onToast={notify} onSave={saveShared} onDelete={deleteShared}/>}
 {tab === 'ideas' && <IdeasPanel items={state.items} onSave={saveShared} onToast={notify}/>}
 {tab === 'home' && <div className="page-animation"><section className="home-grid"><div className="hero-card"><div className="hero-copy"><span className="eyebrow"><span className="live-dot"/> NOSSO PEQUENO MUNDO</span><h2>Entre a rotina e os planos,<br />tem sempre <em>nós.</em></h2><p>Eu sou a Lilith! Que tal organizar o dia<br className="desktop-break"/> e abrir espaço para bons momentos?</p><button className="button" onClick={() => switchTab('lilith')}>Conversar com a Lilith <Sparkles size={16}/></button><span className="hero-footnote">Um cuidado de cada vez. <Heart size={11}/></span></div><div className="hero-art"><span className="art-orbit orbit-one"/><span className="art-orbit orbit-two"/><span className="floating-heart fh1">♡</span><span className="floating-heart fh2">✧</span><span className="floating-heart fh3">♡</span><div className="mascot-stage"><Mascot /></div><span className="lilith-name">Lilith <Sparkles size={11}/></span><span className="art-flower f1">✿</span><span className="art-flower f2">✿</span><span className="art-ground"/></div></div>
 <aside className="us-card"><div className="card-heading"><h3>Nós dois</h3><button className="icon-button" onClick={() => open(state.couple ? 'settings' : 'link')} aria-label="Gerenciar vínculo"><Ellipsis size={20}/></button></div><div className="couple-avatars"><Avatar name={me?.name || 'Você'} large/><span className="couple-heart"><Heart size={17} fill="currentColor"/></span>{partner ? <Avatar name={partner.name} index={1} large/> : <button className="avatar large add-partner" onClick={() => open('link')} aria-label="Adicionar parceiro"><Plus size={25}/></button>}</div><div className="couple-names">{me?.name || 'Você'} <span>&</span> {partner?.name || 'seu amor'}</div><span className="couple-since">{state.couple?.since ? `Escrevendo nossa história desde ${dateText(state.couple.since, { month: 'short', year: 'numeric' })}` : 'Duas pessoas, um novo começo.'}</span><div className="us-divider"/><div className="mood-line"><div><span className="mood-emoji">{moods.find(x => x[0] === me?.mood)?.[1] || '🤍'}</span><span>Como você está?<strong>{me?.mood || 'Conta para o seu amor'}</strong></span></div><button className="text-button" onClick={() => open('mood')}>Contar <ArrowUpRight size={13}/></button></div>{partner?.mood && <p className="partner-mood">{partner.name} está {partner.mood} {moods.find(x => x[0] === partner.mood)?.[1]}</p>}</aside></section>
 <section className="couple-focus"><button className="story-shortcut" onClick={() => switchTab('history')}><span className="quick-icon lilac"><CalendarHeart size={24}/></span><div><span className="eyebrow">NOSSA HISTÓRIA</span><h3>Os dias que a gente não esquece.</h3><p>{nextMilestone ? `${nextMilestone.days === 0 ? 'Hoje' : 'Em ' + nextMilestone.days + ' dias'} · ${nextMilestone.item.data.title}` : 'Primeiro encontro, pedido de namoro, noivado…'}</p></div><ArrowUpRight size={18}/></button><button className="ideas-shortcut" onClick={() => switchTab('ideas')}><Lightbulb size={26}/><span>Um encontro para chamar de nosso.<small>Abra o potinho de ideias</small></span><ArrowRight size={17}/></button></section><section className="quick-actions"><button onClick={() => open('task')}><span className="quick-icon green"><CheckCheck size={20}/></span><span>Nova tarefa<small>Um passo de cada vez</small></span><Plus size={16}/></button><button onClick={() => open('event')}><span className="quick-icon peach"><CalendarDays size={20}/></span><span>Marcar um momento<small>Tempo para vocês</small></span><Plus size={16}/></button><button onClick={() => open('expense')}><span className="quick-icon lilac"><Wallet size={20}/></span><span>Adicionar despesa<small>Contas em sintonia</small></span><Plus size={16}/></button></section>
 <section className="overview-grid"><div className="card tasks-card"><div className="card-heading"><h3><CheckCheck size={18}/> Nossos combinados</h3><button className="text-button" onClick={() => switchTab('lists')}>Ver todos <ArrowUpRight size={14}/></button></div><p className="card-description">Pequenas coisas que fazem a diferença.</p><div className="progress-line"><span><strong>{completed}</strong> de {tasks.length} feitos</span><span className="progress-track"><i style={{ width: `${tasks.length ? completed / tasks.length * 100 : 0}%` }}/></span></div>{tasks.length ? tasks.slice(0, 3).map(i => <TaskRow key={i.id} item={i} members={state.members} busy={busy} onToggle={i => void toggle(i)} onEdit={i => open('task', i)}/>) : <Empty icon={Leaf} title="Um dia de cada vez">Adicione o primeiro combinado de vocês.</Empty>}<button className="subtle-add" onClick={() => open('task')}><Plus size={15}/> Adicionar um combinado</button></div>
 <div className="card agenda-card"><div className="card-heading"><h3><CalendarDays size={18}/> Vem aí</h3><button className="icon-button" onClick={() => switchTab('agenda')} aria-label="Abrir agenda"><ArrowUpRight size={17}/></button></div><p className="card-description">Os próximos capítulos da nossa rotina.</p>{upcoming.length ? upcoming.slice(0, 2).map(i => <EventRow key={i.id} item={i} onEdit={i => open('event', i)}/>) : <Empty icon={CalendarDays} title="Espaço para bons planos">Que tal marcar um encontro?</Empty>}<button className="agenda-link" onClick={() => switchTab('agenda')}>Abrir nossa agenda <ArrowRight size={14}/></button></div>
 <div className="card finance-card"><div className="card-heading"><h3><Wallet size={18}/> Nosso bolso</h3><button className="icon-button" onClick={() => switchTab('expenses')} aria-label="Abrir despesas"><ArrowUpRight size={17}/></button></div><p className="card-description">{dateText(expenseMonth + '-01', { month: 'long', year: 'numeric' })}</p><div className="money-total">{money(total)}</div><span className="muted-small">em despesas registradas</span><div className="spend-bars">{['Faculdade', 'Alimentação', 'Lazer'].map((c, i) => { const value = expenses.reduce((s, x) => s + (x.data.kind === 'expense' && x.data.category === c ? x.data.cents : 0), 0); return <div key={c}><span><i className={`legend-dot dot${i}`}/>{c}</span><strong>{money(value)}</strong></div>; })}</div><button className="finance-link" onClick={() => switchTab('expenses')}>Cuidar das nossas contas <ArrowRight size={14}/></button></div></section>
 <section className="home-bottom"><div><span className="tiny-heart">♡</span><p>{daysTogether ? <>Há <strong>{daysTogether.toLocaleString('pt-BR')} dias</strong> escolhendo estar juntos.</> : 'A melhor parte dos planos é fazer juntos.'}</p></div><span>Feito para a vida real. E para vocês. <Leaf size={12}/></span></section></div>}
 {tab === 'lists' && <div className="page-animation"><div className="section-toolbar"><div className="segmented">{['Todas', 'Pendentes', 'Feitas'].map(f => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div><button className="button" onClick={() => open('task')}><Plus size={17}/> Nova tarefa</button></div><div className="list-layout"><div className="card big-list"><label className="search-field"><Search size={18}/><input aria-label="Buscar tarefas" placeholder="Encontre um combinado…" value={search} onChange={e => setSearch(e.target.value)}/></label>{tasks.filter(i => i.data.kind === 'task' && (filter === 'Todas' || (filter === 'Feitas' ? i.data.done : !i.data.done)) && i.data.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(i => <TaskRow key={i.id} item={i} members={state.members} busy={busy} onToggle={i => void toggle(i)} onEdit={i => open('task', i)}/>)}{!tasks.length && <Empty icon={CheckCheck} title="O primeiro passo pode ser pequeno">Crie listas de compras, tarefas da casa ou planos para vocês.</Empty>}</div><aside className="note-card"><Leaf size={25}/><h3>Uma dupla, sem sobrecarga.</h3><p>Dividam os combinados e celebrem as pequenas conquistas. Nem tudo precisa ser feito hoje.</p><div className="note-stat"><strong>{pending.length}</strong><span>passinhos esperando<br />por vocês</span></div><button className="text-button" onClick={() => switchTab('lilith')}>Pedir uma ajudinha à Lilith <ArrowUpRight size={15}/></button></aside></div></div>}
 {tab === 'agenda' && <div className="page-animation"><div className="section-toolbar"><span className="section-kicker">Nossa agenda compartilhada</span><div className="button-group"><button className="button secondary small-button" aria-label="Exportar agenda" onClick={exportCalendar}><Download size={16}/><span>Exportar agenda</span></button><button className="button" onClick={() => open('event')}><Plus size={17}/> Novo evento</button></div></div><div className="calendar-layout"><div className="card calendar"><div className="calendar-head"><button className="icon-button" aria-label="Mês anterior" onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); setSelectedDay(''); }}><ChevronLeft size={20}/></button><h2>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2><button className="icon-button" aria-label="Próximo mês" onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); setSelectedDay(''); }}><ChevronRight size={20}/></button></div><div className="calendar-grid">{['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => <span key={d} className="weekday">{d}</span>)}{Array.from({ length: month.getDay() }, (_, i) => <span key={'empty' + i}/>)}{Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => { const key = dayKey(new Date(month.getFullYear(), month.getMonth(), i + 1)); const has = events.some(e => e.data.kind === 'event' && dayKey(new Date(e.data.date)) === key); return <button key={key} aria-label={`${i + 1} ${month.toLocaleDateString('pt-BR', { month: 'long' })}${has ? ', tem evento' : ''}`} className={`calendar-day ${key === dayKey(today) ? 'today' : ''} ${selectedDay === key ? 'selected' : ''}`} onClick={() => setSelectedDay(selectedDay === key ? '' : key)}><span>{i + 1}</span>{has && <i />}</button>; })}</div><div className="calendar-caption"><span className="live-dot"/> Um pontinho, um plano para viver.</div></div><div className="card"><div className="card-heading"><h3>{selectedDay ? dateText(selectedDay, { day: 'numeric', month: 'long' }) : 'Planos deste mês'}</h3>{selectedDay && <button className="icon-button" aria-label="Limpar seleção" onClick={() => setSelectedDay('')}><X size={16}/></button>}</div>{events.filter(i => i.data.kind === 'event' && (selectedDay ? dayKey(new Date(i.data.date)) === selectedDay : new Date(i.data.date).getMonth() === month.getMonth() && new Date(i.data.date).getFullYear() === month.getFullYear())).map(i => <EventRow key={i.id} item={i} onEdit={i => open('event', i)}/>)}{!events.some(i => i.data.kind === 'event' && (selectedDay ? dayKey(new Date(i.data.date)) === selectedDay : new Date(i.data.date).getMonth() === month.getMonth() && new Date(i.data.date).getFullYear() === month.getFullYear())) && <Empty icon={CalendarDays} title="Um espaço em branco">Um bom momento para planejar algo especial.</Empty>}<button className="subtle-add" onClick={() => open('event')}><Plus size={16}/> Guardar um novo plano</button></div></div></div>}
 {tab === 'expenses' && <div className="page-animation"><div className="section-toolbar"><label className="month-filter"><CalendarDays size={17}/><input type="month" aria-label="Mês das despesas" value={expenseMonth} onChange={e => setExpenseMonth(e.target.value)}/></label><button className="button" onClick={() => open('expense')}><Plus size={17}/> Nova despesa</button></div><div className="expense-stats"><div className="stat-card"><span>Total do mês</span><strong>{money(total)}</strong><small>{expenses.length} despesas · individuais e compartilhadas</small></div><div className="stat-card sage"><span>Contas compartilhadas</span><strong>{money(expenses.reduce((s, x) => s + (x.data.kind === 'expense' && x.data.shared ? x.data.cents : 0), 0))}</strong><small>Divisão igual entre os participantes</small></div><div className="stat-card peach"><span>Faculdade dos dois</span><strong>{money(expenses.reduce((s, x) => s + (x.data.kind === 'expense' && x.data.category === 'Faculdade' ? x.data.cents : 0), 0))}</strong><small>Edite os valores de cada pessoa livremente</small></div></div><div className="list-layout"><div className="card expense-list"><div className="card-heading"><h3>Nossos lançamentos</h3><Wallet size={19}/></div>{expenses.length ? expenses.map(i => {
                const d = i.data;
                if (d.kind !== 'expense')
                    return null;
                return <button className="expense-row" key={i.id} onClick={() => open('expense', i)}><span className={`expense-icon ${d.category === 'Faculdade' ? 'lilac' : 'green'}`}><Wallet size={19}/></span><span className="expense-desc"><strong>{d.title}</strong><small>{dateText(d.date)} · {state.members.find(m => m.userId === d.payer)?.name || 'Participante anterior'} · {d.shared ? 'Dos dois' : 'Individual'}</small></span><strong>{money(d.cents)}</strong><Pencil size={14}/></button>;
            }) : <Empty icon={Wallet} title="Tudo começa com o primeiro registro">Adicione uma despesa e acompanhem os gastos juntos.</Empty>}</div><aside className="note-card balance-card"><Heart size={24}/><h3>Contas em sintonia</h3><p>Saldo da divisão das despesas compartilhadas deste mês. Despesas individuais ficam de fora.</p>{expenseBalance(expenses, state.members).map(m => <div className="balance-person" key={m.userId}><Avatar name={m.name} index={m.slot - 1}/><span><strong>{m.name}</strong><small>Pagou {money(m.paid)}</small></span><b className={m.balance >= 0 ? 'positive' : ''}>{Math.abs(m.balance) < 1 ? 'Em dia' : `${m.balance > 0 ? '+' : '−'}${money(Math.abs(m.balance))}`}</b></div>)}<span className="muted-small">Positivo: pagou a mais. Negativo: falta contribuir. Valores podem diferir em R$ 0,01 por arredondamento.</span></aside></div></div>}
 {tab === 'map' && <div className="page-animation map-layout"><section className="map-panel">{activeLocation ? <CoupleMap state={state} selectedPin={selectedPin} demo={demo}/> : <div className="map-empty"><div className="map-art" aria-hidden="true"><div className="map-road road1"/><div className="map-road road2"/><div className="map-road road3"/><span className="map-park park1"/><span className="map-park park2"/><span className="map-water"/><div className="map-heart"><Heart size={25} fill="currentColor"/></div></div><div className="map-empty-copy"><span className="eyebrow">CONEXÃO COM CARINHO</span><h2>Seu mapa começa<br />com um sim.</h2><p>Compartilhe sua posição quando quiser.<br />Cada pessoa escolhe quando estar no mapa.</p><span className="muted-small">Ilustração · nenhuma localização ativa</span></div></div>}<span className="map-label"><ShieldCheck size={14}/> Visível só no vínculo de vocês</span></section><aside><div className="card"><div className="card-heading"><h3><MapPin size={19}/> Nosso mapa</h3><span className="tag">Ao vivo no app</span></div><p className="card-description">Os dois no mesmo mapa, com a distância entre vocês.</p>{demo && <button className="button secondary full" onClick={() => { setState(prev => prev ? { ...prev, locations: [{ userId: prev.user.userId, latitude: '-10.996', longitude: '-68.749', accuracy: 20, updatedAt: Date.now() }, { userId: prev.members[1].userId, latitude: '-10.999', longitude: '-68.742', accuracy: 25, updatedAt: Date.now() }] } : prev); playSound('heart'); }}>Experimentar mapa com posições fictícias</button>}{state.members.map(m => { const l = state.locations.find(x => x.userId === m.userId); return <button className={`map-person ${selectedPin === m.userId ? 'selected' : ''}`} key={m.userId} onClick={() => setSelectedPin(m.userId)}><Avatar name={m.name} index={m.slot - 1}/><span><strong>{m.name}</strong><span className="activity-badge">{m.activity || 'Sem status informado'}</span><small>{l ? `Atualizado às ${timeText(new Date(l.updatedAt).toISOString())} · ±${l.accuracy} m` : 'Compartilhamento pausado'}</small></span><i className={l ? 'live-dot' : 'offline-dot'}/></button>; })}<button className={`button full ${sharing ? 'secondary' : ''}`} onClick={() => void locate()} disabled={!state.couple}>{sharing ? <X size={16}/> : <Navigation size={16}/>} {sharing ? 'Pausar e remover posição' : 'Compartilhar minha posição'}</button>{activeLocation && <a className="text-button map-external" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${activeLocation.latitude}&mlon=${activeLocation.longitude}#map=16/${activeLocation.latitude}/${activeLocation.longitude}`}>Abrir mapa completo <ExternalLink size={14}/></a>}</div><div className="card activity-card"><h3>O que você está fazendo?</h3><p className="muted-small">Você escolhe o que compartilhar. Não detectamos sua atividade automaticamente.</p><div className="activity-options">{['Em casa', 'Trabalhando', 'Estudando', 'Na faculdade', 'A caminho', 'Livre'].map(a => <button key={a} className={me?.activity === a ? 'active' : ''} disabled={busy} onClick={() => void run({ action: 'activity', activity: a }, 'Status atualizado')}>{a}</button>)}<button disabled={busy} onClick={() => void run({ action: 'activity', activity: '' }, 'Status removido')}>Limpar status</button></div></div><div className="location-note"><ShieldCheck size={21}/><p>Você está no controle.<small>A posição atualiza com o aplicativo aberto e a permissão ativa. Após 15 minutos sem atualização, ela sai do mapa. Não há rastreamento em segundo plano. O mapa usa OpenStreetMap.</small></p></div></aside></div>}
 {tab === 'lilith' && <div className="page-animation chat-layout"><aside className="lilith-about"><div className="lilith-portrait"><Mascot /><span>✧</span></div><span className="eyebrow">SUA COMPANHEIRINHA</span><h2>Pode me chamar<br />de <em>Lilith.</em></h2><p>Um pouquinho de carinho para os planos, as contas e os dias de vocês.</p><span className="tag"><span className="live-dot"/>{state.aiReady && !demo ? 'IA conectada' : 'Ajuda local · sem IA externa'}</span><p className="privacy-copy">{state.aiReady && !demo ? 'As mensagens são enviadas à OpenAI. Os registros só são incluídos se você autorizar abaixo.' : 'Sugestões e resumos automáticos. A conversa com IA generativa depende da configuração da API.'}</p>{state.aiReady && !demo && <label className="check-label"><input type="checkbox" checked={shareContext} onChange={e => setShareContext(e.target.checked)}/><span>Permitir resumo de agenda, tarefas e despesas na conversa</span></label>}</aside><section className="chat-card"><div className="chat-head"><div className="chat-avatar"><Mascot small/></div><div><strong>Lilith</strong><small>Organizar também pode ser leve.</small></div><button className="icon-button" aria-label="Limpar conversa" onClick={() => {
                if (window.confirm('Limpar esta conversa do aparelho?'))
                    setMessages([{ role: 'assistant', content: 'Um novo começo! Sobre o que vamos conversar? 💜' }]);
            }}><RefreshCw size={17}/></button></div><div className="chat-messages" aria-live="polite">{messages.map((m, i) => <div key={i} className={`chat-message ${m.role}`}><p>{m.content}</p><span>{m.role === 'assistant' ? 'Lilith' : 'Você'}</span></div>)}{chatBusy && <div className="typing" aria-label="Lilith está pensando"><i /><i /><i /></div>}<div ref={chatEnd}/></div><div className="chat-suggestions">{['Organizar a semana', 'Cuidar dos gastos', 'Ideia de encontro'].map(s => <button disabled={chatBusy} onClick={() => void chat(s)} key={s}>{s} <Sparkles size={11}/></button>)}</div><form className="chat-input" onSubmit={e => { e.preventDefault(); void chat(message); }}><input aria-label="Mensagem para Lilith" placeholder="Conta para a Lilith…" maxLength={2000} value={message} onChange={e => setMessage(e.target.value)}/><button className="button" aria-label="Enviar mensagem" disabled={chatBusy || !message.trim()}><Send size={18}/></button></form><p className="chat-disclaimer">Só vocês veem esta conversa neste aparelho. A Lilith orienta; as mudanças são feitas nas abas.</p></section></div>}
 </div>
 </main>
 <nav className="bottom-nav" aria-label="Navegação principal">{nav.map(n => <button key={n.id} className={`${tab === n.id ? 'active' : ''} ${n.id === 'lilith' ? 'lilith-nav' : ''}`} aria-current={tab === n.id ? 'page' : undefined} onClick={() => { switchTab(n.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><span className="nav-icon">{n.id === 'lilith' ? <span className="nav-lilith">✦</span> : <n.icon size={21} strokeWidth={tab === n.id ? 2 : 1.6}/>}</span><span>{n.label}</span>{tab === n.id && <i />}</button>)}</nav>
 {toast && <div className="toast" role="status"><Heart size={16}/>{toast}<button onClick={() => setToast('')} aria-label="Dispensar"><X size={15}/></button></div>}
 {modal && <Dialog title={modal === 'auth' ? 'Bem-vindos ao nosso mundo' : modal === 'settings' ? 'Do nosso jeitinho' : modal === 'link' ? 'Um vínculo, dois corações' : modal === 'mood' ? 'Como está seu coração?' : modal === 'notifications' ? 'Um toque de carinho' : editing ? 'Editar nosso plano' : modal === 'task' ? 'Um novo combinado' : modal === 'event' ? 'Vamos marcar um momento?' : 'Uma despesa para organizar'} onClose={() => { setModal(null); setEditing(null); }}>
 {modal === 'auth' && <AuthPanel recovery={recovering} onDone={() => { setRecovering(false); setModal('link'); void refresh(true); }} onNotify={notify}/>}
 {(modal === 'task' || modal === 'event' || modal === 'expense') && <Editor kind={modal} item={editing} members={state.members} userId={state.user.userId} onSave={save} onDelete={() => void remove()} busy={busy}/>}
 {modal === 'mood' && <div className="mood-picker"><p>Sem cobrança. Só um jeitinho de se fazer presente.</p>{moods.map(([value, emoji]) => <button key={value} className={me?.mood === value ? 'active' : ''} disabled={busy || (!demo && !state.couple)} onClick={async () => {
                        if (await run({ action: 'mood', mood: value }, 'Seu amor já pode ver como você está'))
                            setModal(null);
                    }}><span>{emoji}</span>{value}<Heart size={16}/></button>)}</div>}
 {modal === 'link' && <div className="link-content">{!auth ? <><div className="link-illustration"><Heart size={42}/><Link2 size={25}/></div><h3>Um login para cada um.<br />Um cantinho para os dois.</h3><p>Entre com seu e-mail e senha. Depois, crie um vínculo e envie o código para o seu amor, ou entre com o convite que recebeu.</p><a className="button full" href="#entrar" onClick={e => { e.preventDefault(); open('auth'); }}>Entrar e começar <ArrowRight size={17}/></a><p className="muted-small">Cada pessoa usa uma conta própria. Os registros ficam visíveis apenas dentro do vínculo.</p></> : state.couple ? <><div className="link-illustration"><Link2 size={42}/></div><h3>{partner ? 'Vocês já estão conectados!' : 'Falta só o seu amor chegar.'}</h3><p>{partner ? 'Agenda, listas e despesas aparecem para os dois.' : 'Gere um código e compartilhe com seu parceiro. Ele entra na própria conta e escolhe “Entrar em um vínculo”.'}</p>{!partner && <><button className="button full" disabled={busy} onClick={async () => {
                            const r = await run({ action: 'invite' });
                            if (r?.code)
                                setCode(r.code);
                        }}>Gerar novo convite <Link2 size={16}/></button>{code && <div className="invite-code"><strong>{code}</strong><button className="icon-button" aria-label="Copiar código" onClick={() => { void navigator.clipboard.writeText(code).then(() => notify('Código copiado!')).catch(() => notify('Selecione e copie o código acima.')); }}><Copy size={18}/></button><small>Válido por 24 horas. Novo código invalida o anterior.</small></div>}<p className="muted-small">Compartilhe o endereço do app e o convite diretamente com seu amor.</p></>}</> : <><p className="card-description">Cada pessoa usa sua própria conta. O convite une os planos de vocês.</p><div className="segmented link-tabs"><button className={linkMode === 'create' ? 'active' : ''} onClick={() => { setLinkMode('create'); setLinkError(''); }}>Criar um vínculo</button><button className={linkMode === 'join' ? 'active' : ''} onClick={() => { setLinkMode('join'); setLinkError(''); }}>Entrar em um vínculo</button></div><form className="form" onSubmit={link}><label>Como quer ser chamado(a)?<input name="name" required maxLength={50} defaultValue={state.user.displayName}/></label>{linkMode === 'create' ? <><label>Nome do nosso cantinho<input name="title" required maxLength={70} defaultValue="Nosso pequeno mundo"/></label><label>Juntos desde (opcional)<input name="since" type="date" max={dayKey(today)}/></label></> : <label>Código do seu amor<input name="code" required maxLength={20} placeholder="16 letras e números" autoCapitalize="characters"/></label>}{linkError && <p className="form-error" role="alert">{linkError}</p>}<button className="button full" disabled={busy}>{busy ? 'Conectando…' : linkMode === 'create' ? 'Criar nosso mundo' : 'Entrar no nosso mundo'}<Heart size={16}/></button></form></>}</div>}
 {modal === 'settings' && <div className="settings-content"><div className="settings-section"><h3><Palette size={18}/> O tom do nosso mundo</h3><div className="theme-options">{[['amora', 'Amora'], ['sage', 'Jardim'], ['peach', 'Pêssego'], ['night', 'Luar']].map(([value, label]) => <button key={value} className={theme === value ? 'active' : ''} onClick={() => setTheme(value)}><span className={`theme-swatch swatch-${value}`}>{theme === value && <Check size={17}/>}</span>{label}</button>)}</div></div><div className="settings-section"><h3><Heart size={18}/> Nosso vínculo</h3><button className="settings-row" onClick={() => open('link')}><span>{partner ? 'Gerenciar vínculo' : 'Adicionar meu amor'}<small>{state.couple?.name || 'Criar ou entrar em um vínculo'}</small></span><ChevronRight size={18}/></button>{state.couple && <form className="form compact" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await run({ action: 'couple', name: f.get('name'), since: f.get('since') || null }, 'Cantinho atualizado'); }}><label>Nome do cantinho<input name="name" defaultValue={state.couple.name} required maxLength={70}/></label><label>Juntos desde<input name="since" type="date" defaultValue={state.couple.since || ''} max={dayKey(today)}/></label><button className="button secondary" disabled={busy}>Salvar nosso cantinho</button></form>}{me && <form className="form compact" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await run({ action: 'profile', name: f.get('name') }, 'Seu nome foi atualizado'); }}><label>Meu nome<input name="name" required maxLength={50} defaultValue={me.name}/></label><button className="button secondary" disabled={busy}>Atualizar meu nome</button></form>}</div><div className="settings-section"><h3><Bell size={18}/> Lembretes e aplicativo</h3><button className="settings-row" onClick={() => { const next = !sounds; setSounds(next); localStorage.setItem('namora.sounds.v1', next ? 'on' : 'off'); if (next)
                playSound('success'); }}><span>Sons suaves do aplicativo<small>Toques nas abas, confirmações e lembretes</small></span>{sounds ? <Volume2 size={19}/> : <VolumeX size={19}/>}</button><button className="settings-row" onClick={() => {
                    if (notificationOn) {
                        setNotificationOn(false);
                        localStorage.removeItem('namora.notifications.v1');
                        notify('Lembretes pausados neste aparelho.');
                    }
                    else
                        void enableNotifications();
                }}><span>Lembretes neste aparelho<small>{notificationOn ? 'Ativos · toque para pausar' : 'Ativar para eventos e tarefas próximos'}</small></span><span className={`toggle ${notificationOn ? 'on' : ''}`}/></button><p className="muted-small">Lembretes funcionam com o app aberto. Sem notificações agendadas em segundo plano nesta versão.</p><button className="settings-row" onClick={async () => {
                    if (installEvent) {
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
                                const r = await run({ action: 'leave' }, 'Você saiu do vínculo');
                                if (r) {
                                    setCode('');
                                    setModal(null);
                                }
                            }
                        }}>Desvincular minha conta</button>}</>}</div><button className="settings-row" onClick={() => open('auth')}><span>{auth ? 'Conta e acesso' : 'Entrar ou configurar Supabase'}<small>{backendReady ? 'Banco configurado' : 'Selecione o projeto para conectar os dois aparelhos'}</small></span><ShieldCheck size={18}/></button><p className="version-label">(N)amora · Feito de pequenos cuidados · v2.0 · GitHub Pages + Supabase</p></div>}
 {modal === 'notifications' && <div className="notification-content"><div className="notification-intro"><span className="quick-icon peach"><Bell size={23}/></span><div><h3>Para não passar em branco.</h3><p>Lembretes dos próximos planos e combinados.</p></div></div>{[...upcoming.slice(0, 3), ...pending.filter(i => i.data.kind === 'task' && i.data.due).slice(0, 3)].map(i => <div key={i.id} className="reminder-row"><Clock size={18}/><span><strong>{i.data.title}</strong><small>{i.data.kind === 'event' ? dateText(i.data.date) + ' às ' + timeText(i.data.date) : i.data.kind === 'task' && i.data.due ? dateText(i.data.due) + ' às ' + timeText(i.data.due) : ''}</small></span></div>)}{!upcoming.length && !pending.length && <Empty icon={Bell} title="Tudo tranquilo por aqui">Seus próximos lembretes aparecem neste espaço.</Empty>}<button className="button full" onClick={() => void enableNotifications()}>{notificationOn ? 'Lembretes já estão ativos' : 'Ativar lembretes neste aparelho'}<Bell size={16}/></button><p className="muted-small">Avisos até 15 minutos antes, com o aplicativo aberto e a permissão concedida.</p></div>}
 </Dialog>}
 </div>;
}
