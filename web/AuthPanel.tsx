import { useState, type FormEvent } from 'react';
import { Heart, ArrowRight, ShieldCheck } from 'lucide-react';
import { getClient, configureBackend } from './supabase';
export default function AuthPanel({ onDone, onNotify, recovery = false }: {
    onDone: () => void;
    onNotify: (s: string) => void;
    recovery?: boolean;
}) {
    const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'password'>(recovery ? 'password' : 'login');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [setup, setSetup] = useState(false);
    const available = !!getClient();
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setBusy(true);
        setError('');
        const f = new FormData(e.currentTarget);
        try {
            if (!available || setup) {
                await configureBackend({ supabaseUrl: String(f.get('url')), supabasePublishableKey: String(f.get('key')) });
                return;
            }
            const supa = getClient()!;
            const email = String(f.get('email') || '').trim();
            const password = String(f.get('password') || '');
            const redirect = new URL(import.meta.env.BASE_URL, location.href).href;
            if (mode === 'reset') {
                const r = await supa.auth.resetPasswordForEmail(email, { redirectTo: redirect });
                if (r.error)
                    throw r.error;
                onNotify('Se o e-mail estiver cadastrado, você receberá o link para redefinir a senha.');
                setMode('login');
            }
            else if (mode === 'signup') {
                const r = await supa.auth.signUp({ email, password, options: { data: { display_name: String(f.get('name')) }, emailRedirectTo: redirect } });
                if (r.error)
                    throw r.error;
                if (r.data.session)
                    onDone();
                else {
                    onNotify('Confira seu e-mail para confirmar o cadastro antes de entrar.');
                    setMode('login');
                }
            }
            else if (mode === 'password') {
                const r = await supa.auth.updateUser({ password });
                if (r.error)
                    throw r.error;
                onNotify('Senha atualizada.');
                onDone();
            }
            else {
                const r = await supa.auth.signInWithPassword({ email, password });
                if (r.error)
                    throw r.error;
                onDone();
            }
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Não foi possível entrar.');
        }
        finally {
            setBusy(false);
        }
    }
    return <div className="auth-panel">{!available || setup ? <><div className="link-illustration"><ShieldCheck size={40}/></div><h3>Conectar o nosso cantinho</h3><p>Escolha primeiro o projeto Supabase. A configuração pode ser publicada junto com o app; estes campos permitem testar neste aparelho.</p><form className="form" onSubmit={submit}><label>URL do projeto<input name="url" type="url" required placeholder="https://seu-projeto.supabase.co"/></label><label>Chave publishable ou anon<textarea name="key" required placeholder="sb_publishable_…"/></label><p className="muted-small">Nunca use service_role, sb_secret_ ou sua chave de IA. O banco deve ter o script de instalação e as regras de acesso aplicados.</p>{error && <p role="alert" className="form-error">{error}</p>}<button className="button full" disabled={busy}>Conectar Supabase <ArrowRight size={16}/></button></form></> : <><div className="link-illustration"><Heart size={36}/></div><h3>Seu amor tem um cantinho aqui.</h3><p>Uma conta para cada pessoa, com e-mail e senha.</p><div className="segmented link-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Entrar</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Criar conta</button></div><form className="form" onSubmit={submit}>{mode === 'signup' && <label>Seu nome<input name="name" required maxLength={50} autoComplete="name"/></label>}{mode !== 'password' && <label>E-mail<input name="email" type="email" required autoComplete="email"/></label>}{mode !== 'reset' && <label>{mode === 'password' ? 'Nova senha' : 'Senha'}<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/></label>}{error && <p role="alert" className="form-error">{error}</p>}<button disabled={busy} className="button full">{busy ? 'Só um instante…' : mode === 'signup' ? 'Criar minha conta' : mode === 'reset' ? 'Enviar link de recuperação' : mode === 'password' ? 'Salvar nova senha' : 'Entrar no (N)amora'}<ArrowRight size={16}/></button></form><button className="text-button" onClick={() => setMode(mode === 'reset' ? 'login' : 'reset')}>{mode === 'reset' ? 'Voltar para entrar' : 'Esqueci minha senha'}</button></>}</div>;
}
