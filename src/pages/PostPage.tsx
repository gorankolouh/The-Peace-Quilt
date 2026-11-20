import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Comments, CoverArt, LikeButton, ReportButton } from '../components/cards';
import { Avatar, ErrorNote, Icon, MediaView, RoleChip, Spinner } from '../components/ui';
import { cachedProfile, deletePost, getPost } from '../lib/data';
import { nameOf, readMinutes, timeAgo } from '../lib/format';
import { removeMedia } from '../lib/media';
import type { Post } from '../lib/types';

export default function PostPage() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const [p, setP] = useState<Post | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setP(undefined); getPost(id).then(setP).catch((e) => setErr(e.message)); }, [id]);

  if (err) return <div className="col"><ErrorNote error={err} /></div>;
  if (p === undefined) return <div className="col"><Spinner /></div>;
  if (p === null) return <div className="col"><h1 className="h1">Not found</h1><Link to="/feed">Back to the feed</Link></div>;
  const a = cachedProfile(p.author_id);

  async function remove() {
    if (!window.confirm('Delete this permanently?')) return;
    if (p!.media_path) await removeMedia(p!.media_path);
    await deletePost(p!.id);
    nav('/feed');
  }

  const author = (
    <Link className="who" to={a?.username ? `/u/${a.username}` : '#'}>
      <Avatar name={nameOf(a)} role={a?.role} />
      <div><div className="row"><span className="n">{nameOf(a)}</span>{a && <RoleChip role={a.role} />}</div><div className="m">{a?.username ? '@' + a.username + ' · ' : ''}{timeAgo(p.created_at)}</div></div>
    </Link>
  );

  return (
    <article className={p.kind === 'article' ? 'read' : 'col'}>
      <button className="back" onClick={() => nav(-1)}>{Icon.back()}Back</button>
      {p.kind === 'article' ? (
        <>
          <div className="cover big" aria-hidden="true"><CoverArt seed={p.id} /></div>
          <span className="eyebrow block">Article · {readMinutes(p.body)} min read</span>
          <h1>{p.title}</h1>
          {author}
          {p.media_path && p.media_kind && <MediaView path={p.media_path} kind={p.media_kind} />}
          <div className="prose">{p.body.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div>
        </>
      ) : (
        <div className="card">
          {author}
          <p className="post-body">{p.body}</p>
          {p.media_path && p.media_kind && <MediaView path={p.media_path} kind={p.media_kind} />}
        </div>
      )}
      <div className="acts">
        <LikeButton type="post" id={p.id} liked={p.liked} count={p.like_count} />
        <span className="spacer" />
        {p.is_mine ? <button className="btn ghost sm danger" onClick={remove}>Delete</button> : <ReportButton type="post" id={p.id} />}
      </div>
      <Comments type="post" id={p.id} />
    </article>
  );
}
