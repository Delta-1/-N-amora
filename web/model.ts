import { z } from 'zod';
const title = z.string().trim().min(1, 'Dê um nome para este item.').max(140);
export const recordSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('milestone'), title, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), category: z.enum(['Nos conhecemos', 'Primeiro encontro', 'Pedido de namoro', 'Noivado', 'Casamento', 'Outro']), note: z.string().max(500), annual: z.boolean(), remind: z.boolean() }),
    z.object({ kind: z.literal('idea'), title, description: z.string().max(1000), category: z.string().max(50), saved: z.boolean(), done: z.boolean() }),
    z.object({ kind: z.literal('task'), title, due: z.string().datetime().nullable(), done: z.boolean(), assignee: z.string().max(100), category: z.enum(['Casa', 'Compras', 'Pessoal', 'Nós dois']) }),
    z.object({ kind: z.literal('event'), title, date: z.string().datetime(), category: z.enum(['Encontro', 'Faculdade', 'Aniversário', 'Outro']), note: z.string().max(500) }),
    z.object({ kind: z.literal('expense'), title, cents: z.number().int().positive().max(100000000), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), category: z.enum(['Casa', 'Alimentação', 'Faculdade', 'Lazer', 'Transporte', 'Outros']), payer: z.string().min(1).max(100), shared: z.boolean() }),
]);
export type ItemData = z.infer<typeof recordSchema>;
export type Item = {
    id: string;
    version: number;
    creator: string;
    createdAt: number;
    data: ItemData;
};
export type Member = {
    userId: string;
    name: string;
    mood: string;
    slot: number;
    activity?: string;
    lastSeen?: number;
};
export type State = {
    user: {
        userId: string;
        displayName: string;
        isAdmin?: boolean;
    };
    couple: {
        id: string;
        name: string;
        since: string | null;
    } | null;
    members: Member[];
    items: Item[];
    locations: {
        userId: string;
        latitude: string;
        longitude: string;
        accuracy: number;
        updatedAt: number;
    }[];
    aiReady: boolean;
};
export function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
export function amountToCents(s: string) {
    const normalized = s.trim().replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
    const n = Number(normalized);
    if (!Number.isFinite(n) || n <= 0)
        throw new Error('Informe um valor maior que zero.');
    return Math.round(n * 100);
}
export function expenseBalance(items: Item[], members: Member[]) { const shared = items.filter(x => x.data.kind === 'expense' && x.data.shared); const total = shared.reduce((s, x) => s + (x.data.kind === 'expense' ? x.data.cents : 0), 0); return members.map(m => ({ ...m, paid: shared.reduce((s, x) => s + (x.data.kind === 'expense' && x.data.payer === m.userId ? x.data.cents : 0), 0), balance: shared.reduce((s, x) => s + (x.data.kind === 'expense' && x.data.payer === m.userId ? x.data.cents : 0), 0) - total / Math.max(members.length, 1) })); }
