import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { buildThreads, Constellation } from '../components/Constellation';
import { RoleChip, Spinner, ErrorNote, Empty } from '../components/ui';
import { STORY_ROLES, ROLE_COLORS } from '../lib/constants';
import { allStories, getRegions, getThemes } from '../lib/data';
import type { Region, Story, Theme } from '../lib/types';

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
      .then(([s, t, r]) => { setStories(s); setThemes(t); setRegions(r); if (sel === null && s.length) setSel(s[s.length - 1].id); })
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

  return (
    <div className="col wide">
      <div className="pagehead">
        <div>
          <h1 className="h1">The constellation</h1>
          {stories && <p className="sub">{stories.length} pieces · {threads.length} threads. Tap any piece.</p>}
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
              <Link className="btn" to={`/story/${s.id}`}>Open piece</Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
