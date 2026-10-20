import type { SupabaseClient } from '@supabase/supabase-js';
import type { State, Item, Member } from './model';
export type BackendConfig = {
    supabaseUrl: string;
    supabasePublishableKey: string;
    aiFunctionName?: string;
};
let client: SupabaseClient | null = null;
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
    const clean = validateConfig(config);
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(clean.supabaseUrl, clean.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'namora.auth.v1' } });
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
    const base = { user: { userId: user.id, displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Você' }, aiReady: false };
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
