import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Comments, LikeButton, ReportButton, ShareButton } from '../components/cards';
import { buildThreads, connectedTo } from '../components/Constellation';
import { Avatar, Chip, ErrorNote, Icon, MediaView, RoleChip, Spinner } from '../components/ui';
import { CONSENT_LABEL, CONSENT_SHORT } from '../lib/constants';
import { allStories, cachedProfile, deleteStory, getRegions, getStory, getThemes } from '../lib/data';
import { nameOf, timeAgo } from '../lib/format';
import { removeMedia } from '../lib/media';
import { supabase } from '../lib/supabase';
import type { Region, Story, Theme } from '../lib/types';

export default function StoryPage() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const [s, setS] = useState<Story | null | undefined>(undefined);
  const [all, setAll] = useState<Story[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setS(undefined);
    Promise.all([getStory(id), allStories(), getThemes(), getRegions()])
      .then(([a, b, c, d]) => { setS(a); setAll(b); setThemes(c); setRegions(d); })
      .catch((e) => setErr(e.message));
  }, [id]);

  const connected = useMemo(() => {
    const map = connectedTo(id, buildThreads(all));
    return [...map.entries()].map(([sid, type]) => ({ story: all.find((x) => x.id === sid)!, type })).filter((x) => x.story);
  }, [all, id]);

  if (err) return <div className="col"><ErrorNote error={err} /></div>;
  if (s === undefined) return <div className="col"><Spinner /></div>;
  if (s === null) return <div className="col"><h1 className="h1">Piece not found</h1><p className="sub">It may have been withdrawn by its author.</p><Link to="/feed">Back to the feed</Link></div>;

  const theme = themes.find((t) => t.id === s.theme_id);
  const region = regions.find((r) => r.id === s.region_id);
  const author = cachedProfile(s.author_id);

  async function setConsent(c: string) {
    const { error } = await supabase.from('stories').update({ consent: c }).eq('id', s!.id);
    if (error) setErr(error.message); else setS({ ...s!, consent: c as Story['consent'] });
  }
  async function withdraw() {
    try {
      if (s!.media_path) await removeMedia(s!.media_path);
      await deleteStory(s!.id);
      nav('/feed');
    } catch (x) { setErr((x as Error).message); }
  }

  return (
    <div className="col detail">
      <button className="back" onClick={() => nav(-1)}>{Icon.back()}Back</button>
      <span className="eyebrow">Piece · {theme?.name}</span>
      <h1>{s.title}</h1>
      <div className="row">
        <RoleChip role={s.role} />
        <Chip>{region?.name}</Chip>
        <Chip>{CONSENT_SHORT[s.consent]}</Chip>
        <Chip>{timeAgo(s.created_at)}</Chip>
      </div>
      {author?.username ? (
        <Link className="who" to={`/u/${author.username}`}><Avatar name={nameOf(author)} role={author.role} src={author.avatar_url} size={32} /><span className="n">{nameOf(author)}</span></Link>
      ) : (
        <div className="who"><Avatar name="P C" role={s.role} size={32} /><span className="n">{s.consent === 'pseudonymous' ? 'Pseudonymous contributor' : 'Contributor'}</span></div>
      )}
      {s.media_path && s.media_kind && <MediaView path={s.media_path} kind={s.media_kind} label={s.title} />}
      <p className="story-body">{s.body}</p>
      <div className="acts">
        <LikeButton type="story" id={s.id} liked={s.liked} count={s.like_count} />
        <ShareButton path={`/story/${s.id}`} title={s.title} />
        <span className="spacer" />
        {!s.is_mine && <ReportButton type="story" id={s.id} />}
      </div>

      {s.is_mine && (
        <section className="card">
          <b>Your piece</b>
          <label htmlFor="cons">Who can see it
            <select id="cons" value={s.consent} onChange={(e) => setConsent(e.target.value)}>
              {Object.entries(CONSENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {!confirm ? (
            <button className="btn ghost danger" onClick={() => setConfirm(true)}>Withdraw and delete this piece</button>
          ) : (
            <div className="row">
              <span>This deletes the piece and its file permanently.</span>
              <button className="btn danger" onClick={withdraw}>Delete permanently</button>
              <button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          )}
        </section>
      )}

      <h2 className="h2">Connected pieces</h2>
      {connected.length === 0 && <p className="sub">No connections yet. They appear as more pieces with the same theme or region are added.</p>}
      <div className="links">
        {connected.map(({ story, type }) => (
          <Link key={story.id} className="link" to={`/story/${story.id}`}>
            <b>{story.title}</b><span>{type === 'theme' ? 'same theme' : 'same region'}</span>
          </Link>
        ))}
      </div>
      <Link className="btn ghost" to={`/constellation?focus=${s.id}`}>{Icon.star()}Show in the constellation</Link>
      <Comments type="story" id={s.id} />
    </div>
  );
}
