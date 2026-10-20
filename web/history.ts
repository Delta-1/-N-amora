import type { Item } from './model';
export function nextAnniversary(date: string, now = new Date()) { const original = new Date(date + 'T12:00:00'); let year = now.getFullYear(); const make = (y: number) => { const last = new Date(y, original.getMonth() + 1, 0).getDate(); return new Date(y, original.getMonth(), Math.min(original.getDate(), last), 12); }; let next = make(year); if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12))
    next = make(++year); return next; }
export function daysUntil(date: Date, now = new Date()) { return Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime()) / 86400000); }
export function upcomingMilestones(items: Item[], now = new Date()) { return items.filter(i => i.data.kind === 'milestone' && i.data.remind).map(i => { const d = i.data; if (d.kind !== 'milestone')
    throw new Error(); const date = d.annual ? nextAnniversary(d.date, now) : new Date(d.date + 'T12:00:00'); return { item: i, date, days: daysUntil(date, now) }; }).filter(i => i.days >= 0).sort((a, b) => a.days - b.days); }
export function distanceKm(a: {
    latitude: string;
    longitude: string;
}, b: {
    latitude: string;
    longitude: string;
}) { const r = (n: number) => n * Math.PI / 180; const p1 = r(+a.latitude), p2 = r(+b.latitude); const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(r(+b.longitude - +a.longitude) / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
