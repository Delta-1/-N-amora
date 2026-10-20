import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
export class ApiError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
export function db() { if (!env.DB)
    throw new ApiError('O banco de dados ainda não está disponível.', 503); return env.DB; }
export async function identity() { const u = await getChatGPTUser(); if (!u)
    throw new ApiError('Entre na sua conta para continuar.', 401); return u; }
export async function membership(userId: string) { return await db().prepare('SELECT * FROM members WHERE user_id = ?').bind(userId).first<{
    user_id: string;
    couple_id: string;
    name: string;
    slot: number;
}>(); }
export async function mustBeLinked(userId: string) { const m = await membership(userId); if (!m)
    throw new ApiError('Crie ou entre em um vínculo primeiro.', 403); return m; }
export function json(value: unknown, status = 200) { return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'Vary': 'Cookie' } }); }
export function fail(e: unknown) { if (e instanceof ApiError)
    return json({ error: e.message }, e.status); if (e && typeof e === 'object' && 'issues' in e)
    return json({ error: 'Confira os campos e tente novamente.' }, 400); console.error('Namora request failed', e instanceof Error ? e.message : 'Unknown error'); return json({ error: 'Não foi possível salvar agora. Tente novamente.' }, 500); }
export function checkOrigin(r: Request) { const origin = r.headers.get('origin'); if (origin && origin !== new URL(r.url).origin)
    throw new ApiError('Origem não permitida.', 403); }
export async function hash(s: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map(x => x.toString(16).padStart(2, '0')).join(''); }
export function inviteCode() { const bytes = crypto.getRandomValues(new Uint8Array(12)); const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from(bytes, x => alphabet[x % 32]).join(''); }
export async function rateLimit(userId: string, scope: string, max: number) { const now = Date.now(); const row = await db().prepare('INSERT INTO rate_limits (id,count,reset_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN reset_at < ? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at < ? THEN ? ELSE reset_at END RETURNING count').bind(`${scope}:${userId}`, now + 60000, now, now, now + 60000).first<{
    count: number;
}>(); if (row && row.count > max)
    throw new ApiError('Muitas tentativas. Aguarde um minuto.', 429); }
