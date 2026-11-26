import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { equivalentTerms, linkTerms } from '../lib/data';
import { useT } from '../lib/i18n';
import { ErrorNote } from './ui';

/** Shows which topic names in other languages mean the same, and lets signed-in people add one. */
export function LinkTerms({ tags }: { tags: string[] }) {
  const { me } = useAuth();
  const t = useT();
  const [eq, setEq] = useState<Record<string, string[]>>({});
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState(tags[0] ?? '');
  const [term, setTerm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const key = tags.join('|');
  const load = () => Promise.all(tags.map(async (x) => [x, (await equivalentTerms(x).catch(() => [x])).filter((y) => y !== x)] as const))
    .then((rows) => setEq(Object.fromEntries(rows)));
  useEffect(() => { load(); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!tags.length) return null;
  const known = Object.entries(eq).filter(([, v]) => v.length);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    try { await linkTerms(term, tag); setTerm(''); setOk(true); setTimeout(() => setOk(false), 2500); load(); }
    catch (x) { setErr((x as Error).message); }
  }
  return (
    <div className="terms">
      {known.map(([k, v]) => (
        <span key={k} className="note">#{k} = {v.map((x, i) => <span key={x}>{i ? ', ' : ''}<Link to={`/search?tag=${encodeURIComponent(x)}`}>#{x}</Link></span>)}</span>
      ))}
      {me && !open && <button className="linkbtn" onClick={() => setOpen(true)}>{t('terms.add')}</button>}
      {open && (
        <form className="terms-form" onSubmit={submit}>
          <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label={t('terms.topic')}>{tags.map((x) => <option key={x} value={x}>#{x}</option>)}</select>
          <span className="note">=</span>
          <input value={term} onChange={(e) => setTerm(e.target.value)} required minLength={2} maxLength={60} placeholder={t('terms.placeholder')} aria-label={t('terms.other')} />
          <button className="btn sm" type="submit">{t('terms.save')}</button>
          <button className="linkbtn" type="button" onClick={() => setOpen(false)}>×</button>
          {ok && <span className="ok">{t('terms.saved')}</span>}
          <ErrorNote error={err} />
          <span className="note">{t('terms.help')}</span>
        </form>
      )}
    </div>
  );
}
