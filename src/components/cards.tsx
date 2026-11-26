import { useT } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { CONSENT_SHORT, POST_KINDS, REPORT_REASONS, countryName } from '../lib/constants';
import { SUBJECT_COLORS, useSubjects } from '../lib/useSubjects';
import { Signals } from './transparency';
import { addComment, cachedProfile, deleteComment, getComments, report, setLike } from '../lib/data';
import { nameOf, readMinutes, timeAgo } from '../lib/format';
import type { Comment, Post, Region, Story, Theme } from '../lib/types';
import { Avatar, Chip, ErrorNote, Icon, MediaView, Modal, RoleChip } from './ui';

export function LikeButton({ type, id, liked, count }: { type: 'story' | 'post'; id: number; liked: boolean; count: number }) {
  const { me } = useAuth();
  const nav = useNavigate();
  const [on, setOn] = useState(liked);
  const [n, setN] = useState(count);
  useEffect(() => { setOn(liked); setN(count); }, [liked, count]);
  async function toggle() {
    if (!me) return nav('/login');
    const next = !on;
    setOn(next);
    setN((x) => x + (next ? 1 : -1));
    try { await setLike(me.id, type, id, next); } catch { setOn(!next); setN((x) => x + (next ? -1 : 1)); }
  }
  return (
    <button className={on ? 'liked' : ''} onClick={toggle} aria-pressed={on} aria-label={on ? 'Remove like' : 'Like'}>
      {Icon.heart(on)}<span>{n}</span>
    </button>
  );
}

/** Share a link. Uses the phone's share sheet where available, otherwise copies the link. No tracking parameters are added. */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  async function share() {
    const url = window.location.origin + path;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setDone(true); setTimeout(() => setDone(false), 2000);
    } catch { /* cancelled */ }
  }
  return (
    <button className="iconbtn share" onClick={share} aria-label={t('btn.share')} title={t('btn.share')}>
      {Icon.share()}{done && <span className="copied" role="status">{t('btn.copied')}</span>}
    </button>
  );
}

export function ReportButton({ type, id, label = 'Report' }: { type: string; id: string | number; label?: string }) {
  const { me } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('danger');
  const [details, setDetails] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await report(me?.id ?? null, type, id, reason, details.trim()); setSent(true); }
    catch (x) { setErr((x as Error).message); }
  }
  return (
    <>
      <button aria-label={label} title={label} onClick={() => (me ? setOpen(true) : nav('/login'))}>{Icon.flag()}</button>
      {open && (
        <Modal title="Report this content" onClose={() => { setOpen(false); setSent(false); }}>
          {sent ? (
            <p>Thank you. Our moderators will review it. If someone is in immediate danger, contact local emergency services as well.</p>
          ) : (
            <form className="cmp" onSubmit={submit}>
              <fieldset className="radios">
                <legend>What is wrong?</legend>
                {REPORT_REASONS.map(([k, l]) => (
                  <label key={k} className="radio"><input type="radio" name="reason" value={k} checked={reason === k} onChange={() => setReason(k)} />{l}</label>
                ))}
              </fieldset>
              {reason === 'child_safety' && <p className="note warn">Do not copy, download or forward the material. Moderators see this report first. You can also report it to your national hotline (INHOPE network) or the police.</p>}
              {reason === 'threat' && <p className="note warn">If someone is in immediate danger, contact local emergency services (112 in the EU) first.</p>}
              <label htmlFor="rd">Details (optional)<textarea id="rd" maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} /></label>
              <ErrorNote error={err} />
              <button className="btn" type="submit">Send report</button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

function Who({ authorId, role, meta, pseudonymous }: { authorId: string | null; role: string; meta: string; pseudonymous?: boolean }) {
  const p = cachedProfile(authorId);
  const name = authorId ? nameOf(p) : pseudonymous ? 'Pseudonymous contributor' : 'Contributor';
  const inner = (
    <>
      <Avatar name={authorId ? name : 'P C'} role={role} src={p?.avatar_url} />
      <div style={{ minWidth: 0 }}>
        <div className="row"><span className="n">{name}</span><RoleChip role={role} /></div>
        <div className="m">{meta}</div>
      </div>
    </>
  );
  return p?.username ? <Link className="who" to={`/u/${p.username}`}>{inner}</Link> : <div className="who">{inner}</div>;
}

export function StoryCard({ s, themes, regions }: { s: Story; themes: Theme[]; regions: Region[] }) {
  const theme = themes.find((t) => t.id === s.theme_id);
  const region = regions.find((r) => r.id === s.region_id);
  return (
    <article className="card">
      <Who authorId={s.author_id} role={s.role} meta={`${region?.name ?? ''} · ${timeAgo(s.created_at)}`} pseudonymous={s.consent === 'pseudonymous'} />
      <Link className="piece" to={`/story/${s.id}`}>
        <span className="eyebrow">Piece · {theme?.short}{s.consent !== 'public' ? ` · ${CONSENT_SHORT[s.consent]}` : ''}</span>
        <h3>{s.title}</h3>
        <p>{s.body.length > 320 ? s.body.slice(0, 320) + '…' : s.body}</p>
        <span className="more">Read and see connected pieces →</span>
      </Link>
      {s.media_path && s.media_kind && <MediaView path={s.media_path} kind={s.media_kind} label={s.title} />}
      <div className="acts">
        <LikeButton type="story" id={s.id} liked={s.liked} count={s.like_count} />
        <Link to={`/story/${s.id}`} aria-label="Comments">{Icon.comment()}<span>{s.comment_count}</span></Link>
        <ShareButton path={`/story/${s.id}`} title={s.title} />
        <span className="spacer" />
        <ReportButton type="story" id={s.id} />
      </div>
    </article>
  );
}

export function SubjectChips({ ids, subtopicIds = [], tags = [] }: { ids: number[]; subtopicIds?: number[]; tags?: string[] }) {
  const subjects = useSubjects();
  if (!ids.length && !tags.length) return null;
  const subtopics = subjects.flatMap((s) => s.subtopics).filter((t) => subtopicIds.includes(t.id));
  return (
    <div className="row subj-row">
      {ids.map((id) => {
        const s = subjects.find((x) => x.id === id);
        if (!s) return null;
        const c = SUBJECT_COLORS[id];
        return <Link key={id} to={`/s/${s.slug}`} className="chip subj" style={{ background: c + '1f', color: c }}>{s.name}</Link>;
      })}
      {subtopics.map((t) => <span key={'t' + t.id} className="chip muted">{t.name}</span>)}
      {tags.map((t) => <Link key={'g' + t} to={`/search?tag=${encodeURIComponent(t)}`} className="chip tag">#{t}</Link>)}
    </div>
  );
}

export function PostCard({ p, reason }: { p: Post; reason?: string }) {
  const author = cachedProfile(p.author_id);
  const long = p.kind === 'article' || p.kind === 'research';
  const meta = [author?.username ? '@' + author.username : '', timeAgo(p.created_at), countryName(p.country), p.updated_at ? 'edited' : '']
    .filter(Boolean).join(' · ');
  return (
    <article className="card">
      <Who authorId={p.author_id} role={author?.role ?? 'Member'} meta={meta} />
      {long ? (
        <Link className="art" to={`/post/${p.id}`}>
          <div className="cover" aria-hidden="true"><CoverArt seed={p.id} /></div>
          <div className="txt">
            <span className="eyebrow muted">{POST_KINDS[p.kind]} · {readMinutes(p.body)} min read</span>
            <h3>{p.title}</h3>
            <p>{p.body.slice(0, 200)}{p.body.length > 200 ? '…' : ''}</p>
          </div>
        </Link>
      ) : (
        <Link to={`/post/${p.id}`} className="plain">
          {p.kind === 'question' && <span className="eyebrow q">Question</span>}
          {p.title && <h3 className="post-title">{p.title}</h3>}
          <p className="post-body">{p.body.length > 600 ? p.body.slice(0, 600) + '…' : p.body}</p>
        </Link>
      )}
      {!long && p.media_path && p.media_kind && <MediaView path={p.media_path} kind={p.media_kind} />}
      <Signals p={p} compact />
      <SubjectChips ids={p.subject_ids || []} tags={p.tags || []} />
      {p.sources?.length > 0 && <span className="note">{p.sources.length} source{p.sources.length > 1 ? 's' : ''} linked</span>}
      {reason && <span className="note reason">{reason}</span>}
      <div className="acts">
        <LikeButton type="post" id={p.id} liked={p.liked} count={p.like_count} />
        <Link to={`/post/${p.id}`} aria-label="Comments">{Icon.comment()}<span>{p.comment_count}</span></Link>
        <ShareButton path={`/post/${p.id}`} title={p.title || 'Verum Agora'} />
        <span className="spacer" />
        <ReportButton type="post" id={p.id} />
      </div>
    </article>
  );
}

export function CoverArt({ seed }: { seed: number }) {
  const cols = ['#F9A8D4', '#C6F432', '#7DD3FC', '#86EFAC', '#FDBA74', '#C4B5FD'];
  const r = (i: number) => ((seed * 9301 + i * 49297) % 233280) / 233280;
  const pts = Array.from({ length: 8 }, (_, i) => [20 + r(i) * 360, 15 + r(i + 20) * 110]);
  return (
    <svg viewBox="0 0 400 140" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <path d={'M' + pts.map((p) => p.join(' ')).join(' L')} stroke="#C6F432" strokeOpacity=".45" fill="none" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3 + (i % 2)} fill={cols[i % cols.length]} style={{ filter: `drop-shadow(0 0 6px ${cols[i % cols.length]})` }} />)}
    </svg>
  );
}

function CommentRow({ c, onDelete, onReply, isReply }: { c: Comment; onDelete: () => void; onReply?: () => void; isReply?: boolean }) {
  const { me } = useAuth();
  const p = cachedProfile(c.author_id);
  return (
    <div className={'comment' + (isReply ? ' reply' : '')}>
      <Avatar name={nameOf(p)} role={p?.role} size={isReply ? 28 : 32} src={p?.avatar_url} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row">{p?.username ? <Link to={`/u/${p.username}`} className="plain"><b>{nameOf(p)}</b></Link> : <b>{nameOf(p)}</b>}<span className="note">{timeAgo(c.created_at)}</span></div>
        <p>{c.body}</p>
        <div className="row comment-acts">
          {onReply && me && <button className="linkbtn" onClick={onReply}>Reply</button>}
          {me?.id === c.author_id && <button className="linkbtn" onClick={onDelete}>Delete</button>}
        </div>
      </div>
      {me?.id !== c.author_id && <div className="acts tight"><ReportButton type="comment" id={c.id} /></div>}
    </div>
  );
}

function CommentForm({ onSubmit, placeholder, autoFocus, id }: { onSubmit: (t: string) => Promise<void>; placeholder: string; autoFocus?: boolean; id: string }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="send inline" onSubmit={async (e) => { e.preventDefault(); if (!text.trim()) return; setBusy(true); try { await onSubmit(text.trim()); setText(''); } finally { setBusy(false); } }}>
      <label htmlFor={id} className="sr">{placeholder}</label>
      <input id={id} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={placeholder} autoFocus={autoFocus} />
      <button className="btn" type="submit" disabled={!text.trim() || busy}>Post</button>
    </form>
  );
}

export function Comments({ type, id }: { type: 'story' | 'post'; id: number }) {
  const { me } = useAuth();
  const [list, setList] = useState<Comment[] | null>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => getComments(type, id).then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [type, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const post = (parent: number | null) => async (text: string) => {
    if (!me) return;
    setErr(null);
    try { await addComment(me.id, type, id, text, parent); setReplyTo(null); await load(); } catch (x) { setErr((x as Error).message); }
  };
  const remove = (cid: number) => async () => { await deleteComment(cid); load(); };
  const top = (list ?? []).filter((c) => !c.parent_id);
  const replies = (pid: number) => (list ?? []).filter((c) => c.parent_id === pid);
  return (
    <section className="comments" aria-label="Comments">
      <h2 className="h2">Comments{list && list.length > 0 ? ` (${list.length})` : ''}</h2>
      {list?.length === 0 && <p className="sub">No comments yet. Start the discussion.</p>}
      {top.map((c) => (
        <div key={c.id} className="thread">
          <CommentRow c={c} onDelete={remove(c.id)} onReply={() => setReplyTo(replyTo === c.id ? null : c.id)} />
          {(replies(c.id).length > 0 || replyTo === c.id) && (
            <div className="replies">
              {replies(c.id).map((r) => <CommentRow key={r.id} c={r} isReply onDelete={remove(r.id)} />)}
              {replyTo === c.id && <CommentForm id={`r-${c.id}`} placeholder={`Reply to ${nameOf(cachedProfile(c.author_id))}`} autoFocus onSubmit={post(c.id)} />}
            </div>
          )}
        </div>
      ))}
      {me ? <CommentForm id={`c-${type}-${id}`} placeholder="Write a comment" onSubmit={post(null)} /> : <p className="sub"><Link to="/login">Log in</Link> to comment.</p>}
      <ErrorNote error={err} />
    </section>
  );
}

export { Chip };
