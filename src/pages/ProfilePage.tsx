import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PostCard, ReportButton, StoryCard } from '../components/cards';
import { Avatar, Empty, ErrorNote, RoleChip, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { followCounts, getProfileByUsername, getRegions, getThemes, isBlocked, isFollowing, postsBy, setBlock, setFollow, startConversation, storiesBy } from '../lib/data';
import { nameOf } from '../lib/format';
import type { Post, Profile, Region, Story, Theme } from '../lib/types';

export default function ProfilePage() {
  const username = useParams().username!;
  const { me } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [stories, setStories] = useState<Story[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [tab, setTab] = useState<'pieces' | 'posts'>('pieces');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setP(undefined);
    (async () => {
      const prof = await getProfileByUsername(username);
      setP(prof);
      if (!prof) return;
      const [s, po, t, r, c] = await Promise.all([storiesBy(prof.id), postsBy(prof.id), getThemes(), getRegions(), followCounts(prof.id)]);
      setStories(s); setPosts(po); setThemes(t); setRegions(r); setCounts(c);
      if (me && me.id !== prof.id) {
        const [f, b] = await Promise.all([isFollowing(me.id, prof.id), isBlocked(me.id, prof.id)]);
        setFollowing(f); setBlocked(b);
      }
    })().catch((e) => setErr(e.message));
  }, [username, me]);

  if (err) return <div className="col"><ErrorNote error={err} /></div>;
  if (p === undefined) return <div className="col"><Spinner /></div>;
  if (p === null) return <div className="col"><h1 className="h1">Profile not found</h1><Link to="/feed">Back to the feed</Link></div>;
  const mine = me?.id === p.id;

  async function toggleFollow() {
    if (!me) return nav('/login');
    const on = !following;
    setFollowing(on);
    setCounts((c) => ({ ...c, followers: c.followers + (on ? 1 : -1) }));
    try { await setFollow(me.id, p!.id, on); } catch (x) { setFollowing(!on); setErr((x as Error).message); }
  }
  async function message() {
    if (!me) return nav('/login');
    try { nav(`/messages/${await startConversation(p!.id)}`); } catch (x) { setErr((x as Error).message); }
  }
  async function toggleBlock() {
    if (!me) return;
    const on = !blocked;
    if (on && !window.confirm(`Block ${nameOf(p)}? They will not be able to message you.`)) return;
    await setBlock(me.id, p!.id, on);
    setBlocked(on);
    if (on) setFollowing(false);
  }

  return (
    <div className="col">
      <section className="card">
        <div className="prof">
          <Avatar name={nameOf(p)} role={p.role} size={72} />
          <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 200 }}>
            <div className="row"><h1 className="h1" style={{ fontSize: 24 }}>{nameOf(p)}</h1><RoleChip role={p.role} />{p.is_researcher && <span className="chip muted">Verified researcher</span>}</div>
            <span className="note">@{p.username}</span>
            {p.bio && <p className="sub">{p.bio}</p>}
          </div>
        </div>
        <div className="stats">
          <div><b>{stories.length}</b><span>Pieces</span></div>
          <div><b>{posts.length}</b><span>Posts</span></div>
          <div><b>{counts.followers}</b><span>Followers</span></div>
          <div><b>{counts.following}</b><span>Following</span></div>
        </div>
        <div className="row">
          {mine ? (
            <Link className="btn ghost" to="/settings">Edit profile</Link>
          ) : (
            <>
              {!blocked && <button className={'btn' + (following ? ' ghost' : '')} onClick={toggleFollow}>{following ? 'Following' : 'Follow'}</button>}
              {!blocked && <button className="btn ghost" onClick={message}>Message</button>}
              {me && <button className="btn ghost sm" onClick={toggleBlock}>{blocked ? 'Unblock' : 'Block'}</button>}
              <div className="acts tight"><ReportButton type="profile" id={p.id} label="Report this profile" /></div>
            </>
          )}
        </div>
      </section>
      <div className="tabs">
        <button className={'tab' + (tab === 'pieces' ? ' on' : '')} onClick={() => setTab('pieces')}>Pieces</button>
        <button className={'tab' + (tab === 'posts' ? ' on' : '')} onClick={() => setTab('posts')}>Posts and articles</button>
      </div>
      {tab === 'pieces' && (stories.length ? stories.map((s) => <StoryCard key={s.id} s={s} themes={themes} regions={regions} />) : <Empty title="No public pieces yet" />)}
      {tab === 'posts' && (posts.length ? posts.map((x) => <PostCard key={x.id} p={x} />) : <Empty title="No posts yet" />)}
      {mine && <p className="note">Pieces you shared without your name are not listed on your public profile.</p>}
    </div>
  );
}
