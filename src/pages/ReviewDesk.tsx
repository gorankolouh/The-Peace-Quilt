import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, ErrorNote, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { REPORT_REASONS } from '../lib/constants';
import { cachedProfile, contentReports, decideAppeal, decideReport, decideReview, getProfiles, moderationLog, openAppeals, openReviews, setHidden } from '../lib/data';
import { nameOf, timeAgo } from '../lib/format';
import type { Appeal, ContentReport, ModerationRecord, Review, ReviewStatus } from '../lib/types';

function Decide({ options, onDecide }: { options: [string, string][]; onDecide: (status: string, text: string) => Promise<void> }) {
  const [status, setStatus] = useState(options[0][0]);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="cmp decide" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try { await onDecide(status, text); } catch (x) { setErr((x as Error).message); }
      setBusy(false);
    }}>
      <div className="row">{options.map(([k, l]) => <label key={k} className="radio"><input type="radio" checked={status === k} onChange={() => setStatus(k)} />{l}</label>)}</div>
      <label>Written explanation (public, at least 20 characters)<textarea required minLength={20} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <ErrorNote error={err} />
      <button className="btn sm" disabled={busy}>Record decision</button>
    </form>
  );
}

export default function ReviewDesk() {
  const { me } = useAuth();
  const [tab, setTab] = useState<'facts' | 'appeals' | 'reports' | 'records'>('facts');
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [appeals, setAppeals] = useState<Appeal[] | null>(null);
  const [reports, setReports] = useState<ContentReport[] | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = () => {
    openReviews().then(setReviews).catch((e) => setErr(e.message));
    openAppeals().then(setAppeals).catch((e) => setErr(e.message));
    contentReports().then(setReports).catch((e) => setErr(e.message));
  };
  useEffect(load, []);

  if (!me?.is_moderator) return <div className="col"><h1 className="h1">Review desk</h1><p className="sub">Only reviewers can open this page.</p></div>;
  const openCount = (xs: { status: string }[] | null) => xs?.filter((x) => x.status === 'open').length ?? 0;
  const vis = <T extends { status: string }>(xs: T[] | null) => (xs ?? []).filter((x) => showDone || x.status === 'open');

  return (
    <div className="col">
      <h1 className="h1">Review desk</h1>
      <p className="sub">Every decision needs a written, public explanation. A red correction only comes from here, never from votes. Authors can appeal.</p>
      <div className="tabs">
        <button className={'tab' + (tab === 'facts' ? ' on' : '')} onClick={() => setTab('facts')}>Fact reviews ({openCount(reviews)})</button>
        <button className={'tab' + (tab === 'appeals' ? ' on' : '')} onClick={() => setTab('appeals')}>Appeals ({openCount(appeals)})</button>
        <button className={'tab' + (tab === 'reports' ? ' on' : '')} onClick={() => setTab('reports')}>Content reports ({openCount(reports)})</button>
        <button className={'tab' + (tab === 'records' ? ' on' : '')} onClick={() => setTab('records')}>Records</button>
      </div>
      {tab === 'records' && <Records />}
      {tab !== 'records' && <label className="check"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /><span>Show decided items too</span></label>}
      <ErrorNote error={err} />
      {tab !== 'records' && (!reviews || !appeals || !reports) && !err && <Spinner />}

      {tab === 'facts' && reviews && (vis(reviews).length ? vis(reviews).map((r) => (
        <article key={r.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}><b>Request #{r.id}</b><span className="note">{timeAgo(r.created_at)} · {r.status}</span></div>
          <p>{r.request_text}</p>
          <Link to={`/post/${r.post_id}#transparency`}>Open the contribution and its evidence →</Link>
          {r.decision_text && <p className="decision">{r.decision_text}</p>}
          {r.status === 'open' && (
            <Decide options={[['no_action', 'No change needed'], ['context', 'Add context (blue)'], ['correction', 'Documented correction (red)']]}
              onDecide={async (s, t) => { await decideReview(r.id, s as ReviewStatus, t); load(); }} />
          )}
        </article>
      )) : <Empty title="Nothing waiting" />)}

      {tab === 'appeals' && appeals && (vis(appeals).length ? vis(appeals).map((a) => (
        <article key={a.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}><b>Appeal on review #{a.review_id}</b><span className="note">{timeAgo(a.created_at)} · {a.status}</span></div>
          <p>{a.appeal_text}</p>
          {a.decision_text && <p className="decision">{a.decision_text}</p>}
          {a.status === 'open' && (
            <Decide options={[['upheld', 'Keep the decision'], ['overturned', 'Overturn the decision']]}
              onDecide={async (s, t) => { await decideAppeal(a.id, s as 'upheld' | 'overturned', t); load(); }} />
          )}
        </article>
      )) : <Empty title="Nothing waiting" />)}

      {tab === 'reports' && reports && (vis(reports).length ? vis(reports).map((r) => {
        const link = r.target_type === 'post' ? `/post/${r.target_id}` : r.target_type === 'story' ? `/story/${r.target_id}` : null;
        return (
          <article key={r.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{REPORT_REASONS.find(([k]) => k === r.reason)?.[1] ?? r.reason}</b>
              <span className="note">{r.target_type} #{r.target_id.slice(0, 8)} · {timeAgo(r.created_at)} · {r.status}</span>
            </div>
            {r.details && <p>{r.details}</p>}
            {link && <Link to={link}>Open the reported content →</Link>}
            {r.decision && <p className="decision">{r.decision}</p>}
            {r.status === 'open' && (
              <Decide options={[['dismissed', 'No violation'], ['actioned', 'Violation: hide the content']]}
                onDecide={async (s, t) => {
                  if (s === 'actioned' && ['post', 'story', 'comment'].includes(r.target_type)) await setHidden(r.target_type as 'post' | 'story' | 'comment', Number(r.target_id), true);
                  await decideReport(r.id, s as 'actioned' | 'dismissed', t); load();
                }} />
            )}
          </article>
        );
      }) : <Empty title="Nothing waiting" />)}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  report_actioned: 'Report upheld', report_dismissed: 'Report dismissed',
  review_no_action: 'Review: no action', review_context: 'Review: context added', review_correction: 'Review: correction', review_overturned: 'Review: overturned',
  appeal_upheld: 'Appeal: decision kept', appeal_overturned: 'Appeal: decision reversed',
  content_hidden: 'Content hidden', content_restored: 'Content restored',
};

/** Append-only record of every moderation decision, written by the database itself. */
function Records() {
  const [rows, setRows] = useState<ModerationRecord[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    moderationLog().then(async (r) => { await getProfiles([...new Set(r.map((x) => x.moderator_id).filter(Boolean) as string[])]); setRows(r); }).catch((e) => setErr(e.message));
  }, []);
  function download() {
    const head = 'time,moderator,action,target_type,target_id,category,statement';
    const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = [head, ...(rows ?? []).map((r) => [r.created_at, nameOf(cachedProfile(r.moderator_id)), r.action, r.target_type, r.target_id, r.category, r.statement].map(esc).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'moderation-records.csv'; a.click();
  }
  return (
    <>
      <p className="note">Written automatically by the database for every decision. Entries cannot be edited or deleted, which keeps the record reliable for audits and transparency reports.</p>
      <ErrorNote error={err} />
      {!rows && !err && <Spinner />}
      {rows && rows.length > 0 && <button className="btn ghost sm" onClick={download}>Download as CSV</button>}
      {rows && (rows.length ? (
        <div className="card log-list">
          {rows.map((r) => (
            <div key={r.id} className="log-row">
              <span className="note">{new Date(r.created_at).toLocaleString()}</span>
              <b>{ACTION_LABEL[r.action] ?? r.action}</b>
              <span className="note">{r.target_type} #{r.target_id.slice(0, 8)}{r.category ? ' · ' + r.category : ''} · {nameOf(cachedProfile(r.moderator_id))}</span>
              {r.statement && <p>{r.statement}</p>}
            </div>
          ))}
        </div>
      ) : <Empty title="No decisions recorded yet" />)}
    </>
  );
}
