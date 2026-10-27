import type { SupabaseClient } from '@supabase/supabase-js';
import type { State, Item, Member } from './model';
export type BackendConfig = {
    supabaseUrl: string;
    supabasePublishableKey: string;
    aiFunctionName?: string;
};
export function rememberSession(){return localStorage.getItem('amora.remember')!=='off';}
export function setRememberSession(on:boolean){const from=rememberSession()?localStorage:sessionStorage,to=on?localStorage:sessionStorage;const saved=from.getItem('namora.auth.v1');localStorage.setItem('amora.remember',on?'on':'off');if(saved)to.setItem('namora.auth.v1',saved);if(from!==to)from.removeItem('namora.auth.v1');if(!on)window.AmoraAndroid?.clearSession();}
export const authStorage={getItem:(key:string)=>(rememberSession()?localStorage:sessionStorage).getItem(key),setItem:(key:string,value:string)=>{(rememberSession()?localStorage:sessionStorage).setItem(key,value);},removeItem:(key:string)=>{localStorage.removeItem(key);sessionStorage.removeItem(key);}};
let client: SupabaseClient | null = null;
let activeConfig:BackendConfig|null=null;
export const getBackendConfig=()=>activeConfig;
let initialization: Promise<SupabaseClient | null> | null = null;
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
export function getClient() { return client; }
export function validateConfig(value: BackendConfig) {
    const url = new URL(value.supabaseUrl);
    if (url.protocol !== 'https:')
        throw new Error('Use a URL HTTPS do projeto Supabase.');
    const key = value.supabasePublishableKey.trim();
    if (key.startsWith('sb_secret_'))
        throw new Error('Use somente a chave publishable ou anon. Nunca use uma chave secreta.');
    if (!key.startsWith('sb_publishable_')) {
        try {
            const part = key.split('.')[1];
            const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
            if (payload.role !== 'anon')
                throw new Error();
        }
        catch {
            throw new Error('A chave precisa ser publishable (sb_publishable_) ou a antiga anon.');
        }
    }
    return { ...value, supabaseUrl: url.origin, supabasePublishableKey: key };
}
export function initializeBackend() { initialization ||= loadBackend(); return initialization; }
async function loadBackend() {
    let config: BackendConfig | null = null;
    try {
        const saved = localStorage.getItem('namora.backend.v1');
        if (saved)
            config = JSON.parse(saved);
    }
    catch { }
    if (!config) {
        try {
            const res = await fetch(asset('namora-config.json'), { cache: 'no-store' });
            if (res.ok)
                config = await res.json() as BackendConfig;
        }
        catch { }
    }
    if (!config?.supabaseUrl || !config.supabasePublishableKey)
        return null;
    const clean = validateConfig(config);activeConfig=clean;
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(clean.supabaseUrl, clean.supabasePublishableKey, { auth: { persistSession: true, flowType:window.AmoraAndroid?'pkce':'implicit', storage:authStorage, autoRefreshToken: false, detectSessionInUrl: true, storageKey: 'namora.auth.v1' } });
    const restoreNative=async()=>{try{const n=JSON.parse(window.AmoraAndroid?.trackingSession?.()||'null'),saved=JSON.parse(authStorage.getItem('namora.auth.v1')||'null');if(n?.access&&n.user===saved?.user?.id&&n.expires>(saved?.expires_at||0))await client!.auth.setSession({access_token:n.access,refresh_token:n.refresh});}catch{}};await restoreNative();if(!document.hidden)client.auth.startAutoRefresh();document.addEventListener('visibilitychange',()=>{if(document.hidden)client?.auth.stopAutoRefresh();else void restoreNative().finally(()=>client?.auth.startAutoRefresh());});window.addEventListener('amora-native',e=>{if((e as CustomEvent).detail?.trackingSessionUpdated)void restoreNative();});
    client.auth.onAuthStateChange((_event,session)=>{if(session&&rememberSession())queueMicrotask(()=>window.AmoraAndroid?.configureTracking?.(JSON.stringify({access:session.access_token,refresh:session.refresh_token,expires:session.expires_at,user:session.user.id,key:clean.supabasePublishableKey})));});
    return client;
}
export async function configureBackend(config: BackendConfig) { const clean = validateConfig(config); localStorage.setItem('namora.backend.v1', JSON.stringify(clean)); location.reload(); }
export async function getState(): Promise<State | null> {
    const supa = client;
    if (!supa)
        return null;
    const { data: { user }, error: authError } = await supa.auth.getUser();
    if (authError || !user)
        return null;
    const { data: mine, error } = await supa.from('namora_members').select('*').eq('user_id', user.id).maybeSingle();
    if (error)
        throw new Error('O Supabase ainda precisa das tabelas do (N)amora. Aplique o script de instalação no projeto escolhido.');
    const access=await supa.rpc('namora_access');
    const base = { user: { isAdmin:access.data?.administrator===true,userId: user.id, displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Você' }, aiReady: false };
    if (!mine)
        return { ...base, couple: null, members: [], items: [], locations: [] };
    const [couple, members, items, locations] = await Promise.all([
        supa.from('namora_couples').select('id,name,since').eq('id', mine.couple_id).single(),
        supa.from('namora_members').select('*').eq('couple_id', mine.couple_id).order('slot'),
        supa.from('namora_records').select('*').eq('couple_id', mine.couple_id).order('created_at', { ascending: false }),
        supa.from('namora_locations').select('*').eq('couple_id', mine.couple_id).gt('updated_at', new Date(Date.now() - 15 * 60000).toISOString())
    ]);
    for (const r of [couple, members, items, locations])
        if (r.error)
            throw new Error(r.error.message);
    return { ...base, couple: couple.data, members: (members.data || []).map(m => ({ userId: m.user_id, name: m.name, mood: m.mood, slot: m.slot, activity: m.activity, lastSeen: m.last_seen ? new Date(m.last_seen).getTime() : 0 })) as Member[], items: (items.data || []).map(x => ({ id: x.id, data: x.data, version: x.version, creator: x.creator, createdAt: new Date(x.created_at).getTime() })) as Item[], locations: (locations.data || []).map(x => ({ userId: x.user_id, latitude: String(x.latitude), longitude: String(x.longitude), accuracy: x.accuracy, updatedAt: new Date(x.updated_at).getTime() })) };
}
export async function backendAction(payload: Record<string, unknown>) { if (!client)
    throw new Error('Escolha e configure um projeto Supabase primeiro.'); const { data, error } = await client.rpc('namora_action', { payload }); if (error)
    throw new Error(error.message); if (data?.error)
    throw new Error(data.error); return data as {
    ok?: boolean;
    code?: string;
}; }
export function subscribeCouple(coupleId: string, onChange: () => void) { if (!client)
    return () => { }; const c = client.channel('namora:' + coupleId); for (const table of ['namora_members', 'namora_records', 'namora_locations'])
    c.on('postgres_changes', { event: '*', schema: 'public', table, filter: `couple_id=eq.${coupleId}` }, onChange); c.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'namora_couples', filter: `id=eq.${coupleId}` }, onChange); c.subscribe(); return () => { void client?.removeChannel(c); }; }
