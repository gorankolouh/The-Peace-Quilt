import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Comments, CoverArt, LikeButton, PostCard, ReportButton, SubjectChips } from '../components/cards';
import { Avatar, ErrorNote, Icon, MediaView, RoleChip, Spinner } from '../components/ui';
import { POST_KINDS, countryName, languageName } from '../lib/constants';
import { cachedProfile, deletePost, getPost, relatedPosts } from '../lib/data';
import { nameOf, readMinutes, timeAgo } from '../lib/format';
import { removeMedia } from '../lib/media';
import type { Post, Related } from '../lib/types';
import { useSubjects } from '../lib/useSubjects';
import { TransparencyPanel } from '../components/transparency';

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function RelatedList({ postId }: { postId: number }) {
  const subjects = useSubjects();
  const [items, setItems] = useState<Related[] | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<number | null>(null);
  useEffect(() => { setItems(null); relatedPosts(postId).then(setItems).catch(() => setItems([])); }, [postId]);
  const reason = (r: Related) => {
    const bits: string[] = [];
    if (r.shared_subtopics) bits.push(`${r.shared_subtopics} shared subtopic${r.shared_subtopics > 1 ? 's' : ''}`);
    if (r.shared_tags.length) bits.push('topic ' + r.shared_tags.map((t) => '#' + t).join(', '));
    if (r.shared_subjects) bits.push(`${r.shared_subjects} shared subject${r.shared_subjects > 1 ? 's' : ''}`);
    if (r.same_country) bits.push(`same country (${countryName(r.post.country)})`);
    if (!bits.length) bits.push('similar wording');
    return 'Connected by: ' + bits.join(' · ');
  };
  const usedSubjects = [...new Set((items ?? []).flatMap((r) => r.post.subject_ids))];
  const shown = (items ?? []).filter((r) => !subjectFilter || r.post.subject_ids.includes(subjectFilter));
  return (
    <section className="related" aria-label="Related discussions">
      <h2 className="h2">Related discussions</h2>
      <p className="note">Found by shared subjects, subtopics, topics, country and wording. Not by popularity.</p>
      {usedSubjects.length > 1 && (
        <div className="tabs">
          <button className={'tab' + (subjectFilter === null ? ' on' : '')} onClick={() => setSubjectFilter(null)}>All</button>
          {usedSubjects.map((id) => <button key={id} className={'tab' + (subjectFilter === id ? ' on' : '')} onClick={() => setSubjectFilter(id)}>{subjects.find((s) => s.id === id)?.name ?? ''}</button>)}
        </div>
      )}
      {!items && <Spinner />}
      {items?.length === 0 && <p className="sub">No related discussions yet. They appear as others publish on the same subjects and topics.</p>}
      {shown.map((r) => <PostCard key={r.post.id} p={r.post} reason={reason(r)} />)}
    </section>
  );
}

export default function PostPage() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const [p, setP] = useState<Post | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);

  const loc = useLocation();
  useEffect(() => { setP(undefined); getPost(id).then(setP).catch((e) => setErr(e.message)); }, [id]);
  useEffect(() => {
    if (!p || !loc.hash) return;
    const t = setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    return () => clearTimeout(t);
  }, [p, loc.hash]);

  if (err) return <div className="col"><ErrorNote error={err} /></div>;
  if (p === undefined) return <div className="col"><Spinner /></div>;
  if (p === null) return <div className="col"><h1 className="h1">Not found</h1><Link to="/feed">Back home</Link></div>;
  const a = cachedProfile(p.author_id);
  const long = p.kind === 'article' || p.kind === 'research';

  async function remove() {
    if (!window.confirm('Delete this permanently?')) return;
    if (p!.media_path) await removeMedia(p!.media_path);
    await deletePost(p!.id);
    nav('/feed');
  }

  const meta = [timeAgo(p.created_at), p.updated_at ? `edited ${timeAgo(p.updated_at)}` : '', languageName(p.language), countryName(p.country)].filter(Boolean).join(' · ');
  const author = (
    <Link className="who" to={a?.username ? `/u/${a.username}` : '#'}>
      <Avatar name={nameOf(a)} role={a?.role} src={a?.avatar_url} />
      <div><div className="row"><span className="n">{nameOf(a)}</span>{a && <RoleChip role={a.role} />}</div><div className="m">{a?.username ? '@' + a.username + ' · ' : ''}{meta}</div></div>
    </Link>
  );

  return (
    <article className={long ? 'read' : 'col'}>
      <button className="back" onClick={() => nav(-1)}>{Icon.back()}Back</button>
      {long && <div className="cover big" aria-hidden="true"><CoverArt seed={p.id} /></div>}
      <span className="eyebrow block">{POST_KINDS[p.kind]}{long ? ` · ${readMinutes(p.body)} min read` : ''}</span>
      {p.title && <h1 className={long ? '' : 'h1'}>{p.title}</h1>}
      {author}
      <SubjectChips ids={p.subject_ids} subtopicIds={p.subtopic_ids} tags={p.tags} />
      {p.media_path && p.media_kind && <MediaView path={p.media_path} kind={p.media_kind} />}
      <div className={long ? 'prose' : 'prose short'}>{p.body.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div>
      {p.sources?.length > 0 && (
        <section className="card sources" aria-label="Sources">
          <b>Sources and references</b>
          <ol>
            {p.sources.map((s, i) => (
              <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer nofollow ugc">{s.title || hostOf(s.url)}</a> <span className="note">{hostOf(s.url)}</span></li>
            ))}
          </ol>
        </section>
      )}
      <div className="acts">
        <LikeButton type="post" id={p.id} liked={p.liked} count={p.like_count} />
        <span className="spacer" />
        {p.is_mine ? (
          <>
            <Link className="btn ghost sm" to={`/post/${p.id}/edit`}>Edit</Link>
            <button className="btn ghost sm danger" onClick={remove}>Delete</button>
          </>
        ) : <ReportButton type="post" id={p.id} />}
      </div>
      {p.kind !== 'question' && <TransparencyPanel post={p} />}
      <Comments type="post" id={p.id} />
      <RelatedList postId={p.id} />
    </article>
  );
}
