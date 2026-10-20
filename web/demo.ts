import type { State, ItemData, Item } from './model';
export function demoState(): State {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const day = (offset: number, hour = 19) => { const d = new Date(now); d.setDate(d.getDate() + offset); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
    const item = (n: number, data: ItemData): Item => ({ id: `demo-${n}`, version: 1, creator: 'you', createdAt: Date.now() - n * 1000, data });
    return { user: { userId: 'you', displayName: 'Você' }, couple: { id: 'demo', name: 'Nosso pequeno mundo', since: '2025-08-16' }, members: [{ userId: 'you', name: 'Você', mood: 'feliz', activity: 'Estudando', lastSeen: Date.now(), slot: 1 }, { userId: 'love', name: 'Seu amor', mood: 'apaixonado', activity: 'A caminho', lastSeen: Date.now(), slot: 2 }], aiReady: false, locations: [], items: [
            item(30, { kind: 'milestone', title: 'O dia em que nos conhecemos', date: '2025-05-16', category: 'Nos conhecemos', note: 'Um novo capítulo começou aqui.', annual: true, remind: true }),
            item(31, { kind: 'milestone', title: 'Nosso pedido de namoro', date: '2025-08-16', category: 'Pedido de namoro', note: 'Desde então, um plano de cada vez.', annual: true, remind: true }),
            item(1, { kind: 'task', title: 'Escolher um filme para sexta', done: false, due: day(0, 20), category: 'Nós dois', assignee: 'both' }),
            item(2, { kind: 'task', title: 'Fazer a lista do mercado', done: false, due: day(1, 10), category: 'Compras', assignee: 'you' }),
            item(3, { kind: 'task', title: 'Regar nossas plantinhas', done: true, due: null, category: 'Casa', assignee: 'love' }),
            item(4, { kind: 'event', title: 'Um jantar só nosso', date: day(1, 20), category: 'Encontro', note: 'Preparar nossa receita favorita, juntos.' }),
            item(5, { kind: 'event', title: 'Organizar a semana', date: day(3, 18), category: 'Outro', note: 'Separar um tempinho para planejar.' }),
            item(6, { kind: 'expense', title: 'Comprinhas do mercado', cents: 18650, date: today, category: 'Alimentação', payer: 'you', shared: true }),
            item(7, { kind: 'expense', title: 'Faculdade · pessoa 1', cents: 60000, date: today, category: 'Faculdade', payer: 'you', shared: false }),
            item(8, { kind: 'expense', title: 'Faculdade · pessoa 2', cents: 60000, date: today, category: 'Faculdade', payer: 'love', shared: false }),
            item(9, { kind: 'expense', title: 'Café da tarde a dois', cents: 4200, date: today, category: 'Lazer', payer: 'love', shared: true }),
        ] };
}
