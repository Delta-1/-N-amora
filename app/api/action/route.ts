import { z } from 'zod';
import { db, identity, membership, mustBeLinked, json, fail, checkOrigin, hash, inviteCode, ApiError, rateLimit } from '../../../lib/server';
import { recordSchema } from '../../../lib/validation';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
    try {
        checkOrigin(request);
        const u = await identity();
        if (Number(request.headers.get('content-length')) > 20000)
            throw new ApiError('Conteúdo muito grande.', 413);
        const body = await request.json() as Record<string, unknown>;
        const action = z.string().parse(body.action);
        if (action === 'create' || action === 'join') {
            await rateLimit(u.userId, 'link', 10);
            if (await membership(u.userId))
                throw new ApiError('Você já faz parte de um vínculo.', 409);
            const name = z.string().trim().min(1).max(50).parse(body.name);
            if (action === 'create') {
                const title = z.string().trim().min(1).max(70).parse(body.title);
                const since = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().parse(body.since ?? null);
                const id = crypto.randomUUID();
                const code = inviteCode();
                await db().batch([db().prepare('INSERT INTO couples(id,name,since,invite_hash,invite_expires,created_at) VALUES (?,?,?,?,?,?)').bind(id, title, since, await hash(code), Date.now() + 86400000, Date.now()), db().prepare('INSERT INTO members(user_id,couple_id,slot,name,mood) VALUES (?,?,1,?,?)').bind(u.userId, id, name, '')]);
                return json({ ok: true, code });
            }
            const code = z.string().trim().toUpperCase().regex(/^[A-Z2-9]{12}$/).parse(body.code);
            const c = await db().prepare('SELECT id FROM couples WHERE invite_hash=? AND invite_expires>?').bind(await hash(code), Date.now()).first<{
                id: string;
            }>();
            if (!c)
                throw new ApiError('Convite inválido ou expirado. Peça um novo código.');
            const people = await db().prepare('SELECT slot FROM members WHERE couple_id=?').bind(c.id).all<{
                slot: number;
            }>();
            if (people.results.length !== 1)
                throw new ApiError('Este vínculo já tem duas pessoas.', 409);
            const slot = people.results[0].slot === 1 ? 2 : 1;
            try {
                await db().batch([db().prepare('INSERT INTO members(user_id,couple_id,slot,name,mood) VALUES (?,?,?,?,?)').bind(u.userId, c.id, slot, name, ''), db().prepare('UPDATE couples SET invite_hash=?,invite_expires=0 WHERE id=?').bind(await hash(inviteCode()), c.id)]);
            }
            catch {
                throw new ApiError('O vínculo já foi preenchido ou sua conta já está vinculada.', 409);
            }
            return json({ ok: true });
        }
        const m = await mustBeLinked(u.userId);
        if (action === 'invite') {
            const code = inviteCode();
            await db().prepare('UPDATE couples SET invite_hash=?,invite_expires=? WHERE id=?').bind(await hash(code), Date.now() + 86400000, m.couple_id).run();
            return json({ ok: true, code });
        }
        if (action === 'profile') {
            const name = z.string().trim().min(1).max(50).parse(body.name);
            await db().prepare('UPDATE members SET name=? WHERE user_id=?').bind(name, u.userId).run();
            return json({ ok: true });
        }
        if (action === 'mood') {
            const mood = z.enum(['feliz', 'apaixonado', 'tranquilo', 'cansado', 'precisando de carinho', '']).parse(body.mood);
            await db().prepare('UPDATE members SET mood=? WHERE user_id=?').bind(mood, u.userId).run();
            return json({ ok: true });
        }
        if (action === 'couple') {
            const name = z.string().trim().min(1).max(70).parse(body.name);
            const since = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().parse(body.since);
            await db().prepare('UPDATE couples SET name=?,since=? WHERE id=?').bind(name, since, m.couple_id).run();
            return json({ ok: true });
        }
        if (action === 'save') {
            const data = recordSchema.parse(body.data);
            const people = await db().prepare('SELECT user_id FROM members WHERE couple_id=?').bind(m.couple_id).all<{
                user_id: string;
            }>();
            if (data.kind === 'expense' && !people.results.some(x => x.user_id === data.payer))
                throw new ApiError('Selecione quem pagou.');
            if (data.kind === 'task' && data.assignee !== 'both' && !people.results.some(x => x.user_id === data.assignee))
                throw new ApiError('Selecione um responsável do vínculo.');
            if (body.id) {
                const id = z.string().uuid().parse(body.id);
                const version = z.number().int().positive().parse(body.version);
                const result = await db().prepare('UPDATE records SET data=?,version=version+1 WHERE id=? AND couple_id=? AND version=? AND kind=?').bind(JSON.stringify(data), id, m.couple_id, version, data.kind).run();
                if (!result.meta.changes)
                    throw new ApiError('Este item mudou. Atualize a tela e tente de novo.', 409);
            }
            else {
                await db().prepare('INSERT INTO records(id,couple_id,kind,data,creator,version,created_at) VALUES (?,?,?,?,?,1,?)').bind(crypto.randomUUID(), m.couple_id, data.kind, JSON.stringify(data), u.userId, Date.now()).run();
            }
            return json({ ok: true });
        }
        if (action === 'delete') {
            const id = z.string().uuid().parse(body.id);
            const version = z.number().int().positive().parse(body.version);
            const r = await db().prepare('DELETE FROM records WHERE id=? AND couple_id=? AND version=?').bind(id, m.couple_id, version).run();
            if (!r.meta.changes)
                throw new ApiError('Este item já mudou. Atualize a tela.', 409);
            return json({ ok: true });
        }
        if (action === 'location') {
            await rateLimit(u.userId, 'location', 30);
            if (body.enabled === false) {
                await db().prepare('DELETE FROM locations WHERE user_id=?').bind(u.userId).run();
                return json({ ok: true });
            }
            const p = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100000) }).parse(body);
            await db().prepare('INSERT INTO locations(user_id,couple_id,latitude,longitude,accuracy,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,updated_at=excluded.updated_at,couple_id=excluded.couple_id').bind(u.userId, m.couple_id, String(p.latitude), String(p.longitude), Math.round(p.accuracy), Date.now()).run();
            return json({ ok: true });
        }
        if (action === 'leave') {
            await db().batch([db().prepare('DELETE FROM locations WHERE user_id=?').bind(u.userId), db().prepare('DELETE FROM members WHERE user_id=?').bind(u.userId), db().prepare('UPDATE couples SET invite_hash=?,invite_expires=0 WHERE id=?').bind(await hash(inviteCode()), m.couple_id)]);
            return json({ ok: true });
        }
        throw new ApiError('Ação não encontrada.', 404);
    }
    catch (e) {
        return fail(e);
    }
}
