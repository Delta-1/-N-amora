import { useState, type FormEvent } from 'react';
import { Sparkles, RefreshCw, Heart, Check, CalendarDays, Bookmark, Leaf, Lock } from 'lucide-react';
import type { Item, ItemData } from './model';
const pool = [
    { title: 'Um encontro de músicas', description: 'Cada um escolhe três músicas que contam um pedacinho da sua história. Ouçam juntos e contem por que cada uma importa.', category: 'Em casa', icon: '♫' },
    { title: 'Piquenique de fim de tarde', description: 'Um lanche simples, uma toalha e um lugar ao ar livre. Deixem o celular de lado e vejam o céu mudar de cor.', category: 'Ao ar livre', icon: '☀' },
    { title: 'Cartas para o nosso futuro', description: 'Escrevam uma carta sobre os planos de hoje. Combinem uma data para abrir juntos e guardem esse momento na história.', category: 'Surpresa', icon: '♡' },
    { title: 'Chef por uma noite', description: 'Escolham uma receita nova, dividam os ingredientes e cozinhem juntos. A melhor parte pode ser a bagunça.', category: 'Em casa', icon: '✿' },
    { title: 'Uma caminhada sem destino', description: 'Reservem uma hora para caminhar, escolher um caminho diferente e descobrir um cantinho novo perto de casa.', category: 'Ao ar livre', icon: '↗' },
    { title: 'O que a gente ainda não contou', description: 'Cada pessoa responde: qual memória pequena te deixa feliz? Qual sonho você quer realizar nos próximos anos? O que fazemos bem juntos?', category: 'Conversa', icon: '✧' },
    { title: 'Um dia com os olhos do outro', description: 'Cada um fotografa cinco detalhes bonitos da própria rotina. À noite, contem as histórias por trás das fotos.', category: 'Surpresa', icon: '◈' },
    { title: 'Cinema com ingresso de papel', description: 'Façam um ingresso à mão, escolham um filme e preparem uma pipoca diferente. Vale dress code de pijama.', category: 'Em casa', icon: '★' },
    { title: 'Nosso mapa de sonhos', description: 'Cada um escreve três planos: um simples para este mês, outro para o ano e um sonho distante. Escolham juntos o primeiro passo.', category: 'Conversa', icon: '✦' },
];
export default function IdeasPanel({ items, onSave, onToast }: {
    items: Item[];
    onSave: (data: ItemData, item?: Item) => Promise<boolean>;
    onToast: (s: string) => void;
}) {
    const [category, setCategory] = useState('Todas');
    const [round, setRound] = useState(0);
    const [planning, setPlanning] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const candidates = pool.filter(i => category === 'Todas' || i.category === category);
    const shown = Array.from({ length: Math.min(3, candidates.length) }, (_, i) => candidates[(i + round) % candidates.length]);
    const saved = items.filter(i => i.data.kind === 'idea');
    async function saveIdea(idea: typeof pool[number]) { if (busy)
        return; setBusy(true); try {
        await onSave({ kind: 'idea', title: idea.title, description: idea.description, category: idea.category, saved: true, done: false });
    }
    finally {
        setBusy(false);
    } }
    async function plan(e: FormEvent<HTMLFormElement>, title: string, description: string) { e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); try {
        if (await onSave({ kind: 'event', title, date: new Date(String(f.get('date'))).toISOString(), category: 'Encontro', note: description.slice(0, 500) })) {
            setPlanning(null);
            onToast('Encontro guardado na agenda 💜');
        }
    }
    finally {
        setBusy(false);
    } }
    return <div><div className="ideas-intro"><div><span className="eyebrow">MAIS MOMENTOS, MENOS ROTINA</span><h2>E se hoje a gente…?</h2><p>Uma ideia simples pode virar uma memória especial.</p></div><span className="ideas-orbit">✧<Heart size={35}/></span></div><div className="section-toolbar ideas-toolbar"><div className="idea-filters">{['Todas', 'Em casa', 'Ao ar livre', 'Surpresa', 'Conversa'].map(c => <button key={c} className={category === c ? 'active' : ''} onClick={() => { setCategory(c); setRound(0); }}>{c}</button>)}</div><button className="button secondary" onClick={() => setRound(r => r + 1)}><RefreshCw size={15}/> Outras ideias</button></div><div className="ideas-grid" key={category + round}>{shown.map((idea, i) => { const existing = saved.find(x => x.data.title === idea.title); return <article className="idea-card" key={idea.title} style={{ '--entry-delay': `${i * 75}ms` } as React.CSSProperties}><span className="idea-symbol">{idea.icon}</span><span className="tag">{idea.category}</span><h3>{idea.title}</h3><p>{idea.description}</p><button className="text-button" disabled={!!existing || busy} onClick={() => void saveIdea(idea)}>{existing ? <Check size={15}/> : <Bookmark size={15}/>} {existing ? 'Guardada no nosso cantinho' : 'Guardar essa ideia'}</button></article>; })}</div><div className="future-ai"><span className="quick-icon lilac"><Sparkles size={24}/></span><div><h3>Ideias feitas para a história de vocês</h3><p>A geração personalizada com IA chegará em uma próxima etapa, com acesso pago. Por enquanto, explorem as sugestões gratuitas acima.</p></div><span className="tag"><Lock size={12}/> IA · em breve</span></div><section className="saved-ideas"><div className="card-heading"><h3><Bookmark size={18}/> Nosso potinho de ideias</h3><span className="tag">{saved.length} guardadas</span></div>{saved.length ? saved.map(i => { const d = i.data; if (d.kind !== 'idea')
        return null; return <div className={`saved-idea ${d.done ? 'done' : ''}`} key={i.id}><button className="checkbox" aria-label={`${d.done ? 'Reabrir' : 'Concluir'} ideia ${d.title}`} onClick={() => void onSave({ ...d, done: !d.done }, i)}>{d.done && <Check size={13}/>}</button><div><strong>{d.title}</strong><small>{d.category}</small></div><button className="text-button" onClick={() => setPlanning(planning === i.id ? null : i.id)}><CalendarDays size={15}/> Marcar na agenda</button>{planning === i.id && <form className="idea-plan form" onSubmit={e => void plan(e, d.title, d.description)}><label>Quando vai ser nosso encontro?<input name="date" type="datetime-local" required/></label><button className="button" disabled={busy}>Guardar encontro</button></form>}</div>; }) : <div className="empty"><Leaf size={26}/><h3>Ideias boas merecem ficar.</h3><p>Toque em “Guardar essa ideia” para começar o potinho de vocês.</p></div>}</section></div>;
}
