import { upcomingMilestones } from './history';
import { money, type Item } from './model';
export function localLilith(message: string, items: Item[], name = 'vocês') {
    const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/historia|conhec|namoro|noivado|casamento|data especial/.test(text)) {
        const next = upcomingMilestones(items)[0];
        return next ? `A próxima data especial é “${next.item.data.title}”, ${next.days === 0 ? 'hoje!' : 'em ' + next.days + ' dias.'} Na aba História vocês podem guardar o primeiro encontro, pedidos e outras memórias, com lembrete anual. 💜` : 'Cada história tem seus dias especiais. Abram a aba História e guardem quando se conheceram, o pedido de namoro, o noivado ou qualquer memória que mereça ser celebrada. 💜';
    }
    if (/gasto|despesa|dinheiro|econom|faculdade|financ/.test(text)) {
        const expenses = items.filter(x => x.data.kind === 'expense' && x.data.date.slice(0, 7) === new Date().toISOString().slice(0, 7));
        const total = expenses.reduce((s, x) => s + (x.data.kind === 'expense' ? x.data.cents : 0), 0);
        return `Vamos cuidar do bolso, ${name}! Neste mês, vocês registraram ${money(total)} em despesas. Separem primeiro os gastos fixos, como faculdade e casa. Depois escolham juntos um limite para lazer. Na aba Despesas, o saldo da divisão mostra quem pagou a mais nas contas compartilhadas. 🌿`;
    }
    if (/agenda|semana|dia|compromisso|evento|lembre/.test(text)) {
        const events = items.filter(x => x.data.kind === 'event' && new Date(x.data.date).getTime() >= Date.now()).sort((a, b) => (a.data.kind === 'event' ? a.data.date : '').localeCompare(b.data.kind === 'event' ? b.data.date : ''));
        return events.length ? `O próximo momento na agenda é “${events[0].data.title}”. Que tal reservar também 15 minutinhos para conversar sobre a semana? Você pode criar um evento na Agenda e ativar os lembretes nas configurações. 💜` : 'A agenda está livre por enquanto. Que tal marcar um jantar ou um passeio? Abra Agenda → Novo evento e escolham um horário que seja bom para os dois. 💜';
    }
    if (/tarefa|lista|organiz|casa/.test(text)) {
        const n = items.filter(x => x.data.kind === 'task' && !x.data.done).length;
        return `Vocês têm ${n} ${n === 1 ? 'tarefa pendente' : 'tarefas pendentes'}. Minha sugestão: escolham só três prioridades para hoje e dividam com carinho. Na aba Listas, cada tarefa pode ficar com uma pessoa ou com os dois. Um passinho de cada vez! 🌱`;
    }
    if (/encontro|romant|ideia|amor|jantar/.test(text))
        return 'Uma ideia de encontro leve: cada um escolhe uma música, vocês preparam um lanche e passam meia hora sem telas. No final, contem uma coisa boa do dia e uma coisa que gostariam de fazer juntos. Querem guardar a ideia? Criem um evento na Agenda. 🍓';
    if (/local|mapa|onde/.test(text))
        return 'Para se encontrarem, abram a aba Mapa. Cada pessoa precisa ativar o compartilhamento no próprio aparelho. Vocês podem pausar quando quiserem. A localização atualiza com o aplicativo aberto; não acompanho ninguém em segundo plano. 📍';
    return 'Oi! Sou a Lilith, a amora que cuida dos pequenos planos de vocês. Posso ajudar com a agenda, tarefas, gastos e ideias de encontros. Estou no modo de ajuda local, com sugestões prontas e resumos dos seus registros. Sobre qual desses assuntos vamos conversar? 💜';
}
