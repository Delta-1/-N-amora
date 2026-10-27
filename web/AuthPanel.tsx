import { useState, useEffect, type FormEvent } from 'react';
import { Heart, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import {native} from './native';
import { getClient, configureBackend, rememberSession, setRememberSession } from './supabase';
export default function AuthPanel({ onDone, onNotify, recovery = false }: {
    onDone: () => void;
    onNotify: (s: string) => void;
    recovery?: boolean;
}) {
    const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'password'>(recovery ? 'password' : 'login');
    const [showPassword,setShowPassword]=useState(false);
    const [remember,setRemember]=useState(rememberSession);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [google,setGoogle]=useState(false);
    const [setup, setSetup] = useState(false);
    const available = !!getClient();
    useEffect(()=>{const c=getClient();if(c)void import('./supabase').then(({getBackendConfig})=>{const cfg=getBackendConfig();if(cfg)void fetch(cfg.supabaseUrl+'/auth/v1/settings',{headers:{apikey:cfg.supabasePublishableKey}}).then(r=>r.json()).then((d:any)=>setGoogle(d.external?.google===true)).catch(()=>{});});},[]);
    useEffect(()=>{if(recovery)setMode('password');},[recovery]);
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
            setRememberSession(remember);
            const supa = getClient()!;
            const email = String(f.get('email') || '').trim();
            const password = String(f.get('password') || '');
            const redirect = native()?'https://delta-1.github.io/-N-amora/docs/':new URL(import.meta.env.BASE_URL, location.href).href;
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
    return <div className="auth-panel">{!available || setup ? <><div className="link-illustration"><ShieldCheck size={40}/></div><h3>Conectar o nosso cantinho</h3><p>Escolha primeiro o projeto Supabase. A configuração pode ser publicada junto com o app; estes campos permitem testar neste aparelho.</p><form className="form" onSubmit={submit}><label>URL do projeto<input name="url" type="url" required placeholder="https://seu-projeto.supabase.co"/></label><label>Chave publishable ou anon<textarea name="key" required placeholder="sb_publishable_…"/></label><p className="muted-small">Nunca use service_role, sb_secret_ ou sua chave de IA. O banco deve ter o script de instalação e as regras de acesso aplicados.</p>{error && <p role="alert" className="form-error">{error}</p>}<button className="button full" disabled={busy}>Conectar Supabase <ArrowRight size={16}/></button></form></> : <><div className="link-illustration"><Heart size={36}/></div><h3>Seu amor tem um cantinho aqui.</h3><p>Uma conta para cada pessoa, com e-mail e senha.</p><div className="segmented link-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Entrar</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Criar conta</button></div>{google&&(mode==='login'||mode==='signup')&&<><button className="google-sign-in" disabled={busy} onClick={async()=>{setBusy(true);try{setRememberSession(remember);const redirect=native()?'https://delta-1.github.io/-N-amora/docs/auth-callback.html':new URL(import.meta.env.BASE_URL,location.href).href;const r=await getClient()!.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect,skipBrowserRedirect:true}});if(r.error)throw r.error;if(r.data.url){if(native())native()!.openExternal?.(r.data.url);else location.assign(r.data.url);}}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><span>G</span>Continuar com Google</button><div className="auth-or">ou use seu e-mail</div></>}<form className="form" onSubmit={submit}>{mode === 'signup' && <label>Seu nome<input name="name" required maxLength={50} autoComplete="name"/></label>}{mode !== 'password' && <label>E-mail<input name="email" type="email" required autoComplete="email"/></label>}{mode !== 'reset' && <div className="password-field"><label htmlFor="amora-password">{mode === 'password' ? 'Nova senha' : 'Senha'}</label><div className="password-entry"><input id="amora-password" name="password" type={showPassword?'text':'password'} required minLength={8} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/><button type="button" className="password-toggle" aria-label={showPassword?'Ocultar senha':'Mostrar senha'} title={showPassword?'Ocultar senha':'Mostrar senha'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={20}/>:<Eye size={20}/>}</button></div></div>}{(mode==='login'||mode==='signup')&&<label className="check-label"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Manter conectado neste aparelho</label>}{error && <p role="alert" className="form-error">{error}</p>}<button disabled={busy} className="button full">{busy ? 'Só um instante…' : mode === 'signup' ? 'Criar minha conta' : mode === 'reset' ? 'Enviar link de recuperação' : mode === 'password' ? 'Salvar nova senha' : 'Entrar no Amora'}<ArrowRight size={16}/></button></form><button className="text-button" onClick={() => setMode(mode === 'reset' ? 'login' : 'reset')}>{mode === 'reset' ? 'Voltar para entrar' : 'Esqueci minha senha'}</button></>}</div>;
}
