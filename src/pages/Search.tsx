import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PostCard } from '../components/cards';
import { Avatar, Empty, ErrorNote, Spinner } from '../components/ui';
import { nameOf } from '../lib/format';
import { useT } from '../lib/i18n';
import { COUNTRIES, LANGUAGES, POST_KINDS } from '../lib/constants';
import { searchPeople, searchPosts } from '../lib/data';
import type { Post, Profile } from '../lib/types';
import { useSubjects } from '../lib/useSubjects';

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const subjects = useSubjects();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [results, setResults] = useState<Post[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const t = useT();
  const filters = {
    q: sp.get('q') ?? '',
    subject: sp.get('subject') ? Number(sp.get('subject')) : null,
    country: sp.get('country'),
    language: sp.get('lang'),
    kind: sp.get('kind'),
    tag: sp.get('tag'),
    from: sp.get('from'),
    to: sp.get('to'),
    sort: sp.get('sort'),
  };
  const year = new Date().getFullYear();
  const years = Array.from({ length: Math.max(1, year - 2025) }, (_, i) => year - i);
  const SORTS: [string, string][] = [['new', t('search.sort.new')], ['old', t('search.sort.old')], ['discussed', t('search.sort.discussed')], ['sourced', t('search.sort.sourced')]];
  const key = sp.toString();

  useEffect(() => {
    setResults(null); setErr(null);
    searchPosts(filters).then(setResults).catch((e) => setErr(e.message));
    searchPeople(filters.q).then(setPeople).catch(() => setPeople([]));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(name: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value) next.set(name, value); else next.delete(name);
    setSp(next);
  }
  function setYear(y: number | null) {
    const next = new URLSearchParams(sp);
    if (y) { next.set('from', `${y}-01-01`); next.set('to', `${y}-12-31`); } else { next.delete('from'); next.delete('to'); }
    setSp(next);
  }
  const activeYear = filters.from?.endsWith('-01-01') && filters.to === filters.from.slice(0, 4) + '-12-31' ? Number(filters.from.slice(0, 4)) : null;

  return (
    <div className="col">
      <h1 className="h1">{t('search.title')}</h1>
      <p className="sub">{t('search.sub')}</p>
      <form className="send inline" role="search" onSubmit={(e) => { e.preventDefault(); set('q', q.trim()); }}>
        <label htmlFor="sq" className="sr">Search</label>
        <input id="sq" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} />
        <button className="btn" type="submit">{t('nav.search')}</button>
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
        <label htmlFor="ff">{t('search.from')}<input id="ff" type="date" value={filters.from ?? ''} onChange={(e) => set('from', e.target.value)} /></label>
        <label htmlFor="ft">{t('search.to')}<input id="ft" type="date" value={filters.to ?? ''} onChange={(e) => set('to', e.target.value)} /></label>
        <label htmlFor="so">{t('search.sort')}<select id="so" value={filters.sort ?? 'new'} onChange={(e) => set('sort', e.target.value === 'new' ? '' : e.target.value)}>
          {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select></label>
      </div>
      <div className="row archive-years" aria-label={t('search.archive')}>
        <span className="note">{t('search.archive')}:</span>
        <button className={'tab' + (!activeYear && !filters.from && !filters.to ? ' on' : '')} onClick={() => setYear(null)}>{t('subjects.all')}</button>
        {years.map((y) => <button key={y} className={'tab' + (activeYear === y ? ' on' : '')} onClick={() => setYear(y)}>{y}</button>)}
      </div>
      {people.length > 0 && (
        <div className="card people-hits">
          <b className="note">{t('search.people')}</b>
          <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
            {people.map((p) => (
              <Link key={p.id} to={`/u/${p.username}`} className="person-chip"><Avatar name={nameOf(p)} role={p.role} size={28} src={p.avatar_url} /><span>{nameOf(p)}</span></Link>
            ))}
          </div>
        </div>
      )}
      {filters.tag && <p className="note">Topic: <b>#{filters.tag}</b> <button className="linkbtn" onClick={() => set('tag', '')}>Clear</button></p>}
      <ErrorNote error={err} />
      {!results && !err && <Spinner />}
      {results && <p className="note">{results.length} {t('search.results')} · {SORTS.find(([k]) => k === (filters.sort ?? 'new'))?.[1]}</p>}
      {results?.map((p) => <PostCard key={p.id} p={p} />)}
      {results && results.length === 0 && <Empty title={t('search.none')}><p className="sub">{t('search.noneHelp')}</p></Empty>}
    </div>
  );
}
