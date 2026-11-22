import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PostCard } from '../components/cards';
import { Empty, ErrorNote, Spinner } from '../components/ui';
import { COUNTRIES, LANGUAGES, POST_KINDS } from '../lib/constants';
import { searchPosts } from '../lib/data';
import type { Post } from '../lib/types';
import { useSubjects } from '../lib/useSubjects';

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const subjects = useSubjects();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [results, setResults] = useState<Post[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const filters = {
    q: sp.get('q') ?? '',
    subject: sp.get('subject') ? Number(sp.get('subject')) : null,
    country: sp.get('country'),
    language: sp.get('lang'),
    kind: sp.get('kind'),
    tag: sp.get('tag'),
  };
  const key = sp.toString();

  useEffect(() => {
    setResults(null); setErr(null);
    searchPosts(filters).then(setResults).catch((e) => setErr(e.message));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(name: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value) next.set(name, value); else next.delete(name);
    setSp(next);
  }

  return (
    <div className="col">
      <h1 className="h1">Search the archive</h1>
      <form className="send inline" role="search" onSubmit={(e) => { e.preventDefault(); set('q', q.trim()); }}>
        <label htmlFor="sq" className="sr">Search</label>
        <input id="sq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keywords, e.g. school funding, AI act, housing" />
        <button className="btn" type="submit">Search</button>
      </form>
      <div className="filters">
        <label htmlFor="fs">Subject<select id="fs" value={filters.subject ?? ''} onChange={(e) => set('subject', e.target.value)}>
          <option value="">All subjects</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></label>
        <label htmlFor="fc">Country<select id="fc" value={filters.country ?? ''} onChange={(e) => set('country', e.target.value)}>
          <option value="">Any country</option>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select></label>
        <label htmlFor="fl">Language<select id="fl" value={filters.language ?? ''} onChange={(e) => set('lang', e.target.value)}>
          <option value="">Any language</option>{LANGUAGES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select></label>
        <label htmlFor="fk">Type<select id="fk" value={filters.kind ?? ''} onChange={(e) => set('kind', e.target.value)}>
          <option value="">All types</option>{Object.entries(POST_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select></label>
      </div>
      {filters.tag && <p className="note">Topic: <b>#{filters.tag}</b> <button className="linkbtn" onClick={() => set('tag', '')}>Clear</button></p>}
      <ErrorNote error={err} />
      {!results && !err && <Spinner />}
      {results && <p className="note">{results.length} result{results.length === 1 ? '' : 's'}, newest first</p>}
      {results?.map((p) => <PostCard key={p.id} p={p} />)}
      {results && results.length === 0 && <Empty title="No matching contributions"><p className="sub">Try fewer words or remove a filter.</p></Empty>}
    </div>
  );
}
