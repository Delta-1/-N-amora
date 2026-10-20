import { env } from 'cloudflare:workers';
import { db, identity, membership, json, fail } from '../../../lib/server';
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const user = await identity();
        const m = await membership(user.userId);
        const base = { user: { userId: user.userId, displayName: user.fullName || user.email.split('@')[0] }, aiReady: !!env.OPENAI_API_KEY };
        if (!m)
            return json({ ...base, couple: null, members: [], items: [], locations: [] });
        const [couple, people, items, locations] = await Promise.all([
            db().prepare('SELECT id,name,since FROM couples WHERE id=?').bind(m.couple_id).first(),
            db().prepare('SELECT user_id AS userId,name,mood,slot FROM members WHERE couple_id=? ORDER BY slot').bind(m.couple_id).all(),
            db().prepare('SELECT id, data,creator,version,created_at AS createdAt FROM records WHERE couple_id=? ORDER BY created_at DESC').bind(m.couple_id).all(),
            db().prepare('SELECT user_id AS userId,latitude,longitude,accuracy,updated_at AS updatedAt FROM locations WHERE couple_id=? AND updated_at>?').bind(m.couple_id, Date.now() - 15 * 60000).all(),
        ]);
        return json({ ...base, couple, members: people.results, items: items.results.map(x => ({ ...x, data: JSON.parse(x.data as string) })), locations: locations.results });
    }
    catch (e) {
        return fail(e);
    }
}
