import { useT } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  addClaim, addEvidence, cachedProfile, deleteClaim, deleteEvidence, getClaims, getConflicts, requestReview, reviewsFor, submitAppeal,
} from '../lib/data';
import { nameOf, timeAgo } from '../lib/format';
import type { Claim, ClaimInput, Conflict, Nature, Post, Review } from '../lib/types';
import { ErrorNote, Modal } from './ui';

export const NATURE_LABEL: Record<Nature, string> = {
  factual: 'Mainly factual report',
  opinion: 'Opinion or interpretation',
  mixed: 'Facts and opinion',
};

export function emptyClaim(): ClaimInput {
  return { statement: '', event_tag: '', metric: '', value: '', unit: '', occurred_on: '', location: '', source: '' };
}

/** Small signal pills for cards and headers. */
export function Signals({ p, compact }: { p: Post; compact?: boolean }) {
  const t = useT();
  const items: [string, string, string][] = [];
  if (p.signal_correction) items.push(['red', t('signal.correction'), 'A human review documented a factual correction. The author can appeal.']);
  if (p.signal_conflict) items.push(['amber', t('signal.conflict'), 'Other contributions report different figures or dates for the same event. This does not mean either is false.']);
  if (p.signal_context) items.push(['blue', t('signal.context'), 'Further sources or explanations are available.']);
  if (!items.length && !(p.nature === 'opinion' && !compact)) return null;
  return (
    <div className="signals">
      {items.map(([c, label, help]) => (
        <Link key={c} to={`/post/${p.id}#transparency`} className={'signal ' + c} title={help}><i aria-hidden="true" />{label}</Link>
      ))}
      {!compact && p.nature === 'opinion' && <span className="signal grey"><i aria-hidden="true" />Opinion</span>}
    </div>
  );
}

function fmt(n: number | null, unit?: string | null) {
  if (n === null || n === undefined) return '';
  return n.toLocaleString('en-GB') + (unit ? ' ' + unit : '');
}

function ClaimFacts({ c }: { c: Claim }) {
  const bits = [
    c.value !== null ? `${c.metric ?? 'value'}: ${fmt(c.value, c.unit)}` : c.metric,
    c.occurred_on ? new Date(c.occurred_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
    c.location ?? '',
  ].filter(Boolean);
  return (
    <div className="row claim-facts">
      {c.event_tag && <Link className="chip tag" to={`/compare/${encodeURIComponent(c.event_tag)}`}>Event: {c.event_tag}</Link>}
      {bits.map((b) => <span key={b} className="chip muted">{b}</span>)}
    </div>
  );
}

function EvidenceForm({ claimId, onDone }: { claimId: number; onDone: () => void }) {
  const { me } = useAuth();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [stance, setStance] = useState('supports');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (!me) return <p className="note"><Link to="/login">Log in</Link> to add evidence.</p>;
  return (
    <form className="cmp evidence-form" onSubmit={async (e) => {
      e.preventDefault();
      try { await addEvidence(me.id, claimId, { url, title, stance, note }); onDone(); } catch (x) { setErr((x as Error).message); }
    }}>
      <div className="two">
        <label htmlFor={`eu${claimId}`}>Link to the source<input id={`eu${claimId}`} type="url" required placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <label htmlFor={`es${claimId}`}>This source…<select id={`es${claimId}`} value={stance} onChange={(e) => setStance(e.target.value)}>
          <option value="supports">supports the claim</option><option value="contradicts">contradicts the claim</option><option value="context">adds context</option>
        </select></label>
      </div>
      <label htmlFor={`et${claimId}`}>Title (optional)<input id={`et${claimId}`} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label htmlFor={`en${claimId}`}>What does it show? (optional)<input id={`en${claimId}`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <ErrorNote error={err} />
      <button className="btn sm">Add evidence</button>
    </form>
  );
}

function ClaimCard({ c, canEdit, onChange, conflicts }: { c: Claim; canEdit: boolean; onChange: () => void; conflicts: Conflict[] }) {
  const { me } = useAuth();
  const [adding, setAdding] = useState(false);
  const by = (s: string) => c.evidence.filter((e) => e.stance === s);
  const independent = new Set(by('supports').map((e) => e.domain)).size;
  const mine = conflicts.filter((x) => x.claim_id === c.id);
  return (
    <div className="claim">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p className="claim-text">“{c.statement}”</p>
        {canEdit && <button className="linkbtn" onClick={async () => { if (window.confirm('Remove this claim and its evidence?')) { await deleteClaim(c.id); onChange(); } }}>Remove</button>}
      </div>
      <ClaimFacts c={c} />
      <div className="evidence-sum">
        <span className="ev sup">{by('supports').length} supporting</span>
        <span className="ev con">{by('contradicts').length} contradicting</span>
        <span className="ev ctx">{by('context').length} context</span>
        <span className="note">· {independent} independent source{independent === 1 ? '' : 's'}</span>
      </div>
      {mine.length > 0 && (
        <div className="conflict">
          <b>Conflicting information</b>
          {mine.map((x) => (
            <Link key={x.other_claim_id} to={`/post/${x.other_post_id}`} className="conflict-row">
              {x.kind === 'number' && <>Another contribution reports <b>{fmt(x.other_value, x.other?.unit)}</b> instead of <b>{fmt(x.mine_value, c.unit)}</b>{x.ratio ? ` (${x.ratio}× apart)` : ''}.</>}
              {x.kind === 'date' && <>Another contribution gives a different date: <b>{x.other?.occurred_on}</b>.</>}
              {x.kind === 'place' && <>Another contribution gives a different place: <b>{x.other?.location}</b>.</>}
              <span className="note"> {x.post?.title || x.post?.body.slice(0, 60)} →</span>
            </Link>
          ))}
          {c.event_tag && <Link className="btn ghost sm" to={`/compare/${encodeURIComponent(c.event_tag)}`}>Compare all reports on this event</Link>}
        </div>
      )}
      {c.evidence.length > 0 && (
        <ul className="evidence-list">
          {c.evidence.map((e) => (
            <li key={e.id} className={'ev-' + e.stance}>
              <span className={'ev-tag ' + e.stance}>{e.stance === 'supports' ? 'Supports' : e.stance === 'contradicts' ? 'Contradicts' : 'Context'}</span>
              <a href={e.url} target="_blank" rel="noopener noreferrer nofollow ugc">{e.title || e.domain}</a>
              <span className="note"> {e.domain} · added by {nameOf(cachedProfile(e.added_by))}</span>
              {e.note && <div className="note">{e.note}</div>}
              {me?.id === e.added_by && <button className="linkbtn" onClick={async () => { await deleteEvidence(e.id); onChange(); }}>Remove</button>}
            </li>
          ))}
        </ul>
      )}
      {adding ? <EvidenceForm claimId={c.id} onDone={() => { setAdding(false); onChange(); }} /> : <button className="btn ghost sm" onClick={() => setAdding(true)}>Add evidence</button>}
    </div>
  );
}

function QuestionClaim({ post, claims, onClose, onDone }: { post: Post; claims: Claim[]; onClose: () => void; onDone: () => void }) {
  const { me } = useAuth();
  const [claimId, setClaimId] = useState<string>(claims[0] ? String(claims[0].id) : '');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title="Question a factual claim" onClose={onClose}>
      {sent ? (
        <p>Thank you. A human reviewer will look at it and publish a written decision on this page. The author is told and can respond.</p>
      ) : (
        <form className="cmp" onSubmit={async (e) => {
          e.preventDefault();
          if (!me) return;
          try {
            if (url.trim() && claimId) await addEvidence(me.id, Number(claimId), { url: url.trim(), title: '', stance: 'contradicts', note: '' });
            await requestReview(me.id, post.id, claimId ? Number(claimId) : null, text + (url.trim() && !claimId ? `\n\nSource: ${url.trim()}` : ''));
            setSent(true); onDone();
          } catch (x) { setErr((x as Error).message); }
        }}>
          <p className="note">Use this for factual statements, not for opinions you disagree with. Disagreement is welcome in the comments.</p>
          {claims.length > 0 && (
            <label htmlFor="qc">Which claim?<select id="qc" value={claimId} onChange={(e) => setClaimId(e.target.value)}>
              {claims.map((c) => <option key={c.id} value={c.id}>{c.statement.slice(0, 90)}</option>)}
              <option value="">Another statement in the text</option>
            </select></label>
          )}
          <label htmlFor="qt">What is wrong, and how do you know?<textarea id="qt" required minLength={10} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} /></label>
          <label htmlFor="qu">Evidence link (strongly recommended)<input id="qu" type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
          <ErrorNote error={err} />
          <button className="btn">Send for review</button>
        </form>
      )}
    </Modal>
  );
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Waiting for review', no_action: 'Reviewed: no change needed', context: 'Reviewed: context added',
  correction: 'Reviewed: documented correction', overturned: 'Overturned on appeal',
};

function ReviewItem({ r, onDone }: { r: Review; onDone: () => void }) {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const canAppeal = r.on_my_post && (r.status === 'context' || r.status === 'correction') && !r.appeal_status;
  return (
    <div className={'review st-' + r.status}>
      <div className="row" style={{ justifyContent: 'space-between' }}><b>{STATUS_LABEL[r.status]}</b><span className="note">{timeAgo(r.decided_at ?? r.created_at)}</span></div>
      <p className="note">Request: {r.request_text}</p>
      {r.decision_text && <p className="decision">{r.decision_text}</p>}
      {r.appeal_status && <p className="note">Appeal: {r.appeal_status === 'open' ? 'waiting for a decision' : r.appeal_status}{r.appeal_decision ? ` — ${r.appeal_decision}` : ''}</p>}
      {canAppeal && me && (open ? (
        <form className="cmp" onSubmit={async (e) => { e.preventDefault(); try { await submitAppeal(me.id, r.id, text); setOpen(false); onDone(); } catch (x) { setErr((x as Error).message); } }}>
          <label htmlFor={`ap${r.id}`}>Why should this be reconsidered? Add sources if you can.<textarea id={`ap${r.id}`} required minLength={20} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} /></label>
          <ErrorNote error={err} />
          <button className="btn sm">Send appeal</button>
        </form>
      ) : <button className="btn ghost sm" onClick={() => setOpen(true)}>Request reconsideration</button>)}
    </div>
  );
}

/** The transparency section on a contribution's page. */
export function TransparencyPanel({ post }: { post: Post }) {
  const { me } = useAuth();
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [asking, setAsking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ClaimInput>(emptyClaim());
  const [err, setErr] = useState<string | null>(null);
  const load = () => {
    getClaims(post.id).then(setClaims).catch(() => setClaims([]));
    getConflicts(post.id).then(setConflicts).catch(() => setConflicts([]));
    reviewsFor(post.id).then(setReviews).catch(() => setReviews([]));
  };
  useEffect(load, [post.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="card transparency" id="transparency" aria-label="Information transparency">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="h2" style={{ margin: 0 }}>Facts and sources</h2>
        <Link to="/transparency" className="note">How this works</Link>
      </div>
      <div className="row">
        <span className={'nature n-' + (post.nature ?? 'mixed')}>{NATURE_LABEL[post.nature ?? 'mixed']}</span>
        <Signals p={post} compact />
      </div>
      {post.signal_conflict && <p className="notice amber">Other contributions report different facts about the same event. That does not mean this one is wrong. Compare the reports and their sources below.</p>}
      {post.signal_correction && <p className="notice red">A human review documented a factual correction to this contribution. Read the decision below. The author may appeal.</p>}

      {claims === null && <p className="note">Loading claims…</p>}
      {claims?.length === 0 && <p className="sub">No factual claims have been listed for this contribution{post.is_mine ? '. Add the key facts so others can check and connect them.' : '.'}</p>}
      {claims?.map((c) => <ClaimCard key={c.id} c={c} canEdit={!!post.is_mine} onChange={load} conflicts={conflicts} />)}

      {post.is_mine && (adding ? (
        <form className="cmp claim-form" onSubmit={async (e) => {
          e.preventDefault();
          if (!me) return;
          try { await addClaim(me.id, post.id, draft); setDraft(emptyClaim()); setAdding(false); load(); } catch (x) { setErr((x as Error).message); }
        }}>
          <ClaimFields value={draft} onChange={setDraft} idp="pc" />
          <ErrorNote error={err} />
          <div className="row"><button className="btn sm">Save claim</button><button type="button" className="btn ghost sm" onClick={() => setAdding(false)}>Cancel</button></div>
        </form>
      ) : <button className="btn ghost sm" onClick={() => setAdding(true)}>Add a factual claim</button>)}

      {!post.is_mine && me && <button className="btn ghost sm" onClick={() => setAsking(true)}>Question a factual claim</button>}
      {!me && <p className="note"><Link to="/login">Log in</Link> to add evidence or question a claim.</p>}

      {reviews.length > 0 && (
        <div className="reviews">
          <b>Review history</b>
          {reviews.map((r) => <ReviewItem key={r.id} r={r} onDone={load} />)}
        </div>
      )}
      {asking && <QuestionClaim post={post} claims={claims ?? []} onClose={() => setAsking(false)} onDone={load} />}
    </section>
  );
}

export function ClaimFields({ value, onChange, idp }: { value: ClaimInput; onChange: (c: ClaimInput) => void; idp: string }) {
  const set = (k: keyof ClaimInput) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="claim-fields">
      <label htmlFor={`${idp}s`}>The factual statement<input id={`${idp}s`} required minLength={5} maxLength={300} value={value.statement} onChange={set('statement')} placeholder="e.g. Germany is missing about 14,000 teachers this school year" /></label>
      <div className="three">
        <label htmlFor={`${idp}e`}>Event or topic<input id={`${idp}e`} maxLength={60} value={value.event_tag} onChange={set('event_tag')} placeholder="e.g. teacher shortage germany 2026" /></label>
        <label htmlFor={`${idp}m`}>What is counted<input id={`${idp}m`} maxLength={40} value={value.metric} onChange={set('metric')} placeholder="e.g. missing teachers" /></label>
        <label htmlFor={`${idp}v`}>Number<input id={`${idp}v`} inputMode="decimal" value={value.value} onChange={set('value')} placeholder="e.g. 14000" /></label>
      </div>
      <div className="three">
        <label htmlFor={`${idp}u`}>Unit (optional)<input id={`${idp}u`} maxLength={20} value={value.unit} onChange={set('unit')} placeholder="e.g. people, €, %" /></label>
        <label htmlFor={`${idp}d`}>Date (optional)<input id={`${idp}d`} type="date" value={value.occurred_on} onChange={set('occurred_on')} /></label>
        <label htmlFor={`${idp}l`}>Place (optional)<input id={`${idp}l`} maxLength={80} value={value.location} onChange={set('location')} /></label>
      </div>
      <label htmlFor={`${idp}src`}>Source for this claim (optional)<input id={`${idp}src`} type="url" placeholder="https://" value={value.source} onChange={set('source')} /></label>
      <p className="note">Using the same event name as others lets Verum Agora compare reports and flag figures that differ a lot.</p>
    </div>
  );
}
