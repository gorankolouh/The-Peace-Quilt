import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { buildThreads, Constellation } from '../components/Constellation';
import { RoleChip, Spinner, ErrorNote, Empty } from '../components/ui';
import { STORY_ROLES, ROLE_COLORS } from '../lib/constants';
import { allStories, getRegions, getThemes } from '../lib/data';
import type { Region, Story, Theme } from '../lib/types';
import { exampleStories } from '../lib/demo';

const MIN_REAL = 12;

export default function ConstellationPage() {
  const [sp] = useSearchParams();
  const [stories, setStories] = useState<Story[] | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [mode, setMode] = useState<0 | 1>(sp.get('focus') ? 1 : 0);
  const [role, setRole] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(sp.get('focus') ? Number(sp.get('focus')) : null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([allStories(), getThemes(), getRegions()])
      .then(([s, t, r]) => {
        const all = s.length < MIN_REAL ? [...exampleStories(), ...s] : s;
        setStories(all); setThemes(t); setRegions(r);
        if (sel === null && all.length) setSel(all[all.length - 1].id);
      })
      .catch((e) => setErr(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode === 1 || !stories?.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => setMode(1), 1500);
    return () => clearTimeout(t);
  }, [stories]); // eslint-disable-line react-hooks/exhaustive-deps

  const threads = useMemo(() => (stories ? buildThreads(stories) : []), [stories]);
  const s = stories?.find((x) => x.id === sel);
  const realCount = stories?.filter((x) => x.id > 0).length ?? 0;
  const withExamples = !!stories?.some((x) => x.id < 0);

  return (
    <div className="col wide">
      <div className="pagehead">
        <div>
          <h1 className="h1">The Peace Quilt</h1>
          {stories && <p className="sub">A collection in <Link to="/s/peace-international">Peace &amp; International Affairs</Link>. {realCount} real piece{realCount === 1 ? '' : 's'} · {threads.length} threads. Tap any piece.</p>}
        </div>
        <div className="tabs">
          <button className={'tab' + (mode === 0 ? ' on' : '')} onClick={() => setMode(0)}>Quilt</button>
          <button className={'tab' + (mode === 1 ? ' on' : '')} onClick={() => setMode(1)}>Constellation</button>
        </div>
      </div>
      <div className="roles" aria-label="Highlight by role">
        {STORY_ROLES.map((r) => (
          <button key={r} className={'rc' + (role === r ? ' on' : '')} aria-pressed={role === r} onClick={() => setRole(role === r ? null : r)}>
            <i style={{ background: ROLE_COLORS[r] }} />{r}
          </button>
        ))}
      </div>
      <ErrorNote error={err} />
      {!stories && !err && <Spinner />}
      {stories && stories.length === 0 && <Empty title="The quilt is still empty"><p className="sub"><Link to="/new">Add the first piece.</Link></p></Empty>}
      {withExamples && (
        <div className="safe">
          <b>Example pieces shown</b>
          <span>Until the quilt has its own stories, it shows fictional example pieces so you can see how it works. They are not part of the archive and disappear once real pieces are added. <Link to="/new?kind=story">Add your peace story</Link></span>
        </div>
      )}
      {stories && stories.length > 0 && (
        <>
          <div className="stage">
            <Constellation stories={stories} themes={themes} threads={threads} mode={mode} roleFilter={role} selected={sel} onSelect={setSel} />
            <div className="legend"><span><i />Same theme</span><span><i className="d" />Same region</span></div>
          </div>
          {s && (
            <div className="card peek">
              <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 220 }}>
                <div className="row"><RoleChip role={s.role} /><span className="note">{regions.find((r) => r.id === s.region_id)?.name} · {themes.find((t) => t.id === s.theme_id)?.short}</span></div>
                <b className="peek-title">{s.title}</b>
                <span className="sub">{s.body.length > 200 ? s.body.slice(0, 200) + '…' : s.body}</span>
              </div>
              {s.id > 0 ? <Link className="btn" to={`/story/${s.id}`}>Open piece</Link> : <span className="chip muted">Example piece</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
