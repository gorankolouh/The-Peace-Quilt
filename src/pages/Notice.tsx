import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorNote } from '../components/ui';
import { useAuth } from '../lib/auth';
import { REPORT_REASONS } from '../lib/constants';
import { profileIdByUsername, submitNotice } from '../lib/data';

/** Work out what a pasted link points to. Only links to this site are accepted. */
async function resolve(url: string): Promise<{ type: string; id: string } | null> {
  let u: URL;
  try { u = new URL(url.trim(), window.location.origin); } catch { return null; }
  if (u.host !== window.location.host) return null;
  const path = u.pathname + (u.hash.startsWith('#') && u.pathname === '/' ? '/' + u.hash.slice(1).replace('-', '/') : '');
  let m = path.match(/\/post\/(\d+)/); if (m) return { type: 'post', id: m[1] };
  m = path.match(/\/story\/(-?\d+)/); if (m) return { type: 'story', id: m[1] };
  m = path.match(/\/u\/([A-Za-z0-9_.-]+)/);
  if (m) { const id = await profileIdByUsername(m[1]); return id ? { type: 'profile', id } : null; }
  return null;
}

/** Notice of illegal content for anyone, with or without an account (DSA Article 16). */
export default function Notice() {
  const { me } = useAuth();
  const [sp] = useSearchParams();
  const [url, setUrl] = useState(sp.get('url') ?? '');
  const [reason, setReason] = useState('illegal');
  const [details, setDetails] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const csam = reason === 'child_safety';

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const target = await resolve(url);
    if (!target) { setErr('Paste the full link to a contribution, Peace Quilt piece or profile on this site.'); return; }
    setBusy(true);
    try {
      await submitNotice({ reporter: me?.id ?? null, target_type: target.type, target_id: target.id, reason, details, name: csam ? '' : name, email, url });
      setDone(new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC');
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="col">
        <h1 className="h1">Notice received</h1>
        <section className="card">
          <p>Your notice was received on <b>{done}</b> and will be reviewed by a person, not an algorithm. Child-safety notices and threats are reviewed first.</p>
          <p className="note">{email ? 'We will tell you the outcome by email once email notifications are switched on. Until then, the decision is recorded in our moderation log.' : 'You did not leave an email address, so we cannot tell you the outcome.'}</p>
          <Link className="btn ghost" to="/feed">Back to Verum Agora</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="col">
      <span className="eyebrow">Report illegal content</span>
      <h1 className="h1">Send a notice</h1>
      <p className="sub">Anyone can report content they believe is illegal, with or without an account. A person reviews every notice and records the decision. {me && <>You are logged in, so you can also use the flag button on any contribution.</>}</p>
      <form className="cmp card" onSubmit={submit}>
        <label htmlFor="nu">Link to the content<input id="nu" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder={`${window.location.origin}/post/123`} /></label>
        <fieldset className="radios">
          <legend>What is the problem?</legend>
          {REPORT_REASONS.filter(([k]) => k !== 'spam' && k !== 'other').map(([k, l]) => (
            <label key={k} className="radio"><input type="radio" name="nr" checked={reason === k} onChange={() => setReason(k)} />{l}</label>
          ))}
        </fieldset>
        {csam && <p className="note warn">Do not copy, download or forward the material. You do not need to give your name for this category. You can also report it to your national hotline (INHOPE network) or the police.</p>}
        <label htmlFor="nd">Why is this content illegal?{!csam && ' (required)'}
          <textarea id="nd" required={!csam} minLength={csam ? 0 : 20} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)}
            placeholder="Explain which part is illegal and, if you can, under which law." />
        </label>
        {!csam && <label htmlFor="nn">Your name (optional for us, but helps if we need to ask a question)<input id="nn" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>}
        <label htmlFor="ne">Your email (optional, to receive the decision)<input id="ne" type="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label className="check"><input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I believe in good faith that the information in this notice is accurate and complete.</span>
        </label>
        <ErrorNote error={err} />
        <button className="btn" disabled={busy || !agree}>{busy ? 'Sending…' : 'Send notice'}</button>
        <p className="note">Your name and email are only visible to moderators and are not shared with the person you report. See the <Link to="/rules">community rules</Link> and <Link to="/privacy">privacy policy</Link>.</p>
      </form>
    </div>
  );
}
