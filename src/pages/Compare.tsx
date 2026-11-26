import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Empty, ErrorNote, Spinner } from '../components/ui';
import { cachedProfile, eventClaims } from '../lib/data';
import { nameOf, timeAgo } from '../lib/format';
import type { EventClaim, Post } from '../lib/types';

export default function Compare() {
  const tag = decodeURIComponent(useParams().tag!);
  const [data, setData] = useState<{ claims: EventClaim[]; posts: Post[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setData(null); eventClaims(tag).then(setData).catch((e) => setErr(e.message)); }, [tag]);

  const groups = useMemo(() => {
    const m = new Map<string, EventClaim[]>();
    (data?.claims ?? []).forEach((c) => { const k = c.metric ?? 'other statements'; m.set(k, [...(m.get(k) ?? []), c]); });
    return [...m.entries()];
  }, [data]);

  return (
    <div className="col">
      <Link className="back" to="/transparency">How comparison works</Link>
      <span className="eyebrow">Compare reports</span>
      <h1 className="h1">{tag}</h1>
      <p className="notice amber">A figure is not more likely to be true because more people repeat it, and a minority figure is not automatically wrong. Look at the sources: claims that rely on the same original source count as one.</p>
      <ErrorNote error={err} />
      {!data && !err && <Spinner />}
      {data && data.claims.length === 0 && <Empty title="No claims recorded for this event yet" />}
      {groups.map(([metric, claims]) => {
        const values = claims.map((c) => c.value).filter((v): v is number => v !== null);
        const min = Math.min(...values), max = Math.max(...values);
        return (
          <section key={metric} className="card">
            <h2 className="h2" style={{ margin: 0 }}>{metric}</h2>
            {values.length > 1 && (
              <>
                <p className="sub">Reported values range from <b>{min.toLocaleString('en-GB')}</b> to <b>{max.toLocaleString('en-GB')}</b>{min > 0 ? ` (${(max / min).toFixed(1)}× apart)` : ''}.</p>
                <div className="range" aria-hidden="true">
                  {claims.filter((c) => c.value !== null).map((c) => (
                    <span key={c.claim_id} className="range-dot" style={{ left: `${max === min ? 50 : ((c.value! - min) / (max - min)) * 100}%` }} title={c.value!.toLocaleString('en-GB')} />
                  ))}
                </div>
              </>
            )}
            <div className="compare-table" role="table" aria-label={`Reports on ${metric}`}>
              <div className="ct-row ct-head" role="row">
                <span role="columnheader">Reported</span><span role="columnheader">Statement</span><span role="columnheader">Evidence</span>
              </div>
              {claims.map((c) => {
                const p = data!.posts.find((x) => x.id === c.post_id);
                return (
                  <Link key={c.claim_id} to={`/post/${c.post_id}#transparency`} className="ct-row" role="row">
                    <span role="cell" className="ct-val">{c.value !== null ? `${c.value.toLocaleString('en-GB')}${c.unit ? ' ' + c.unit : ''}` : '—'}{c.occurred_on && <small>{c.occurred_on}</small>}{c.location && <small>{c.location}</small>}</span>
                    <span role="cell">“{c.statement}”<small>{p ? `${nameOf(cachedProfile(p.author_id))} · ${timeAgo(c.created_at)}` : ''}</small></span>
                    <span role="cell" className="ct-ev">
                      <b>{c.independent_sources}</b> independent source{c.independent_sources === 1 ? '' : 's'}
                      <small>{c.supports} for · {c.contradicts} against · {c.context} context</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
