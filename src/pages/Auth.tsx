import { useT } from '../lib/i18n';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../components/Layout';
import { ErrorNote } from '../components/ui';
import { useAuth } from '../lib/auth';
import { PROFILE_ROLES } from '../lib/constants';
import { setInterests, updateMyProfile } from '../lib/data';
import { InterestsPicker } from '../components/InterestsPicker';
import { DEMO, supabase } from '../lib/supabase';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <Logo />
      <div className="card auth-card">
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  );
}

function GoogleButton({ next }: { next: string }) {
  const t = useT();
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  return (
    <>
      <button
        type="button"
        className="btn ghost wide"
        onClick={async () => {
          if (DEMO) { await supabase.auth.signInWithPassword({ email: 'demo@x', password: 'demo' }); nav(next); return; }
          const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + next } });
          if (error) setErr(error.message);
        }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        {t('auth.google')}
      </button>
      <ErrorNote error={err} />
    </>
  );
}

export function Login() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get('next') || '/feed';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message === 'Invalid login credentials' ? 'The email or password is not correct.' : error.message);
    else nav(next);
  }
  async function forgot() {
    if (!email) { setErr('Enter your email first, then tap "Forgot password".'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset' });
    if (error) setErr(error.message); else setInfo('If an account exists for this email, a reset link is on its way.');
  }
  return (
    <Shell title={t('auth.login')}>
      <GoogleButton next={next} />
      <div className="or"><span>{t('auth.or')}</span></div>
      <form className="cmp" onSubmit={submit}>
        <label htmlFor="em">{t('auth.email')}<input id="em" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label htmlFor="pw">{t('auth.password')}<input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <ErrorNote error={err} />
        {info && <p className="ok">{info}</p>}
        <button className="btn wide" disabled={busy}>{busy ? 'Logging in…' : t('auth.login')}</button>
        <button type="button" className="linkbtn" onClick={forgot}>{t('auth.forgot')}</button>
      </form>
      <p className="sub">{t('auth.new')} <Link to="/signup">{t('auth.createLink')}</Link></p>
    </Shell>
  );
}

export function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const t = useT();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) { setErr('Use at least 10 characters for your password.'); return; }
    setBusy(true); setErr(null);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin + '/setup' },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else if (data.session) nav('/setup');
    else setDone(true);
  }
  if (done) return <Shell title="Check your email"><p>We sent a confirmation link to <b>{email}</b>. Open it to finish creating your account.</p></Shell>;
  return (
    <Shell title={t('auth.join')}>
      <GoogleButton next="/setup" />
      <div className="or"><span>{t('auth.or')}</span></div>
      <form className="cmp" onSubmit={submit}>
        <label htmlFor="nm">Name shown on your profile<input id="nm" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label htmlFor="em2">{t('auth.email')}<input id="em2" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label htmlFor="pw2">Password (at least 10 characters)<input id="pw2" type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="check"><input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I agree to the <Link to="/terms" target="_blank">Terms</Link> and have read the <Link to="/privacy" target="_blank">Privacy Policy</Link>. I am at least 16 years old.</span>
        </label>
        <ErrorNote error={err} />
        <button className="btn wide" disabled={busy || !agree}>{busy ? 'Creating account…' : t('auth.create')}</button>
      </form>
      <p className="sub">{t('auth.have')} <Link to="/login">{t('auth.login')}</Link></p>
    </Shell>
  );
}

export function ResetPassword() {
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) { setErr('Use at least 10 characters.'); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) setErr(error.message); else nav('/feed');
  }
  return (
    <Shell title="Choose a new password">
      <form className="cmp" onSubmit={submit}>
        <label htmlFor="npw">New password<input id="npw" type="password" autoComplete="new-password" required minLength={10} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <ErrorNote error={err} />
        <button className="btn wide">Save password</button>
      </form>
    </Shell>
  );
}

export function Setup() {
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [name, setName] = useState(me?.display_name ?? '');
  const [role, setRole] = useState(me?.role ?? 'Member');
  const [bio, setBio] = useState('');
  const [interests, setInt] = useState<number[]>([]);
  const [err, setErr] = useState<string | null>(null);
  if (!me) return null;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(u)) { setErr('Usernames use 3–24 lowercase letters, numbers or underscores.'); return; }
    try {
      if (interests.length < 1) { setErr('Choose at least one subject for your home feed.'); return; }
      await updateMyProfile(me!.id, { username: u, display_name: name.trim(), role, bio: bio.trim() });
      await setInterests(me!.id, interests);
      await refresh();
      nav('/feed');
    } catch (x) {
      const m = (x as Error).message;
      setErr(m.includes('duplicate') ? 'That username is taken. Try another.' : m);
    }
  }
  return (
    <div className="col">
      <h1 className="h1">Set up your profile</h1>
      <p className="sub">You can use a pseudonym. Choose the subjects you care about: Verum Agora connects you through subjects, not popularity.</p>
      <form className="cmp card" onSubmit={submit}>
        <label htmlFor="un">Username<input id="un" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. lena_mediates" autoCapitalize="none" /></label>
        <label htmlFor="dn">Display name<input id="dn" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label htmlFor="rl">How do you take part?<select id="rl" value={role} onChange={(e) => setRole(e.target.value)}>{PROFILE_ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label htmlFor="bi">Short bio (optional)<textarea id="bi" maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Avoid details that reveal exactly where you live." /></label>
        <fieldset className="radios">
          <legend>Which subjects interest you? Your home feed is built from these.</legend>
          <InterestsPicker value={interests} onChange={setInt} />
        </fieldset>
        <ErrorNote error={err} />
        <button className="btn">Save and continue</button>
      </form>
    </div>
  );
}
