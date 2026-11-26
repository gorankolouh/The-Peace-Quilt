import { useT } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PostCard, ReportButton, StoryCard } from '../components/cards';
import { Avatar, Empty, ErrorNote, Modal, RoleChip, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import {
  followCounts, followList, getProfileByUsername, getRegions, getThemes, isBlocked, isFollowing, myFollowingSet,
  postsBy, setBlock, setFollow, startConversation, storiesBy,
} from '../lib/data';
import { nameOf } from '../lib/format';
import { removeAvatar, uploadAvatar } from '../lib/media';
import type { Post, Profile, Region, Story, Theme } from '../lib/types';

function PeopleList({ ownerId, which, onClose }: { ownerId: string; which: 'followers' | 'following'; onClose: () => void }) {
  const { me } = useAuth();
  const nav = useNavigate();
  const [list, setList] = useState<Profile[] | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  useEffect(() => {
    followList(ownerId, which).then(setList).catch(() => setList([]));
    if (me) myFollowingSet(me.id).then(setMine).catch(() => {});
  }, [ownerId, which, me]);
  async function toggle(p: Profile) {
    if (!me) return nav('/login');
    const on = !mine.has(p.id);
    const next = new Set(mine);
    if (on) next.add(p.id); else next.delete(p.id);
    setMine(next);
    try { await setFollow(me.id, p.id, on); } catch { setMine(mine); }
  }
  return (
    <Modal title={which === 'followers' ? 'Followers' : 'Following'} onClose={onClose}>
      {!list && <Spinner />}
      {list?.length === 0 && <p className="sub">{which === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</p>}
      <div className="people">
        {list?.map((p) => (
          <div key={p.id} className="row person">
            <Link to={`/u/${p.username}`} className="who" style={{ flex: 1 }} onClick={onClose}>
              <Avatar name={nameOf(p)} role={p.role} size={36} src={p.avatar_url} />
              <div><div className="row"><span className="n">{nameOf(p)}</span><RoleChip role={p.role} /></div><div className="m">@{p.username}</div></div>
            </Link>
            {me && me.id !== p.id && (
              <button className={'btn sm' + (mine.has(p.id) ? ' ghost' : '')} onClick={() => toggle(p)}>{mine.has(p.id) ? 'Following' : 'Follow'}</button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function ProfilePage() {
  const username = useParams().username!;
  const { me, refresh } = useAuth();
  const t = useT();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [stories, setStories] = useState<Story[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);
  const [busyFollow, setBusyFollow] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [tab, setTab] = useState<'posts' | 'pieces'>('posts');
  const [list, setList] = useState<'followers' | 'following' | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const meId = me?.id;

  useEffect(() => {
    setP(undefined); setErr(null);
    (async () => {
      const prof = await getProfileByUsername(username);
      setP(prof);
      if (!prof) return;
      const [s, po, t, r, c] = await Promise.all([storiesBy(prof.id), postsBy(prof.id), getThemes(), getRegions(), followCounts(prof.id)]);
      setStories(s); setPosts(po); setThemes(t); setRegions(r); setCounts(c);
      if (!po.length && s.length) setTab('pieces');
      if (meId && meId !== prof.id) {
        const [f, b] = await Promise.all([isFollowing(meId, prof.id), isBlocked(meId, prof.id)]);
        setFollowing(f); setBlocked(b);
      }
    })().catch((e) => setErr(e.message));
  }, [username, meId]);

  if (err && p === undefined) return <div className="col"><ErrorNote error={err} /></div>;
  if (p === undefined) return <div className="col"><Spinner /></div>;
  if (p === null) return <div className="col"><h1 className="h1">Profile not found</h1><Link to="/feed">Back home</Link></div>;
  const mine = meId === p.id;

  async function toggleFollow() {
    if (!me) return nav('/login');
    if (busyFollow) return;
    const on = !following;
    setBusyFollow(true); setErr(null);
    setFollowing(on);
    setCounts((c) => ({ ...c, followers: Math.max(0, c.followers + (on ? 1 : -1)) }));
    try {
      await setFollow(me.id, p!.id, on);
    } catch (x) {
      const m = (x as Error).message;
      if (!(on && m.includes('duplicate'))) {
        setFollowing(!on);
        setCounts((c) => ({ ...c, followers: Math.max(0, c.followers + (on ? -1 : 1)) }));
        setErr('Could not update following: ' + m);
      }
    }
    setBusyFollow(false);
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
  async function pickPhoto(f: File | null) {
    if (!f || !me) return;
    setPhotoBusy(true); setErr(null);
    try {
      const path = await uploadAvatar(me.id, f, p!.avatar_url ?? null);
      setP({ ...p!, avatar_url: path });
      await refresh();
    } catch (x) { setErr((x as Error).message); }
    setPhotoBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }
  async function dropPhoto() {
    if (!me || !p!.avatar_url) return;
    try { await removeAvatar(me.id, p!.avatar_url); setP({ ...p!, avatar_url: null }); await refresh(); } catch (x) { setErr((x as Error).message); }
  }

  return (
    <div className="col">
      <section className="card profile-card">
        <div className="prof">
          <div className="av-wrap">
            <Avatar name={nameOf(p)} role={p.role} size={96} src={p.avatar_url} />
            {mine && (
              <>
                <button className="av-edit" onClick={() => fileRef.current?.click()} disabled={photoBusy} aria-label={p.avatar_url ? 'Change profile photo' : 'Add profile photo'}>
                  {photoBusy ? '…' : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                  )}
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)} />
              </>
            )}
          </div>
          <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 200 }}>
            <div className="row"><h1 className="h1" style={{ fontSize: 24 }}>{nameOf(p)}</h1><RoleChip role={p.role} />{p.is_researcher && <span className="chip muted">Verified researcher</span>}</div>
            <span className="note">@{p.username}</span>
            {p.bio && <p className="sub">{p.bio}</p>}
            {mine && !p.avatar_url && <button className="linkbtn" onClick={() => fileRef.current?.click()}>Add a profile photo</button>}
            {mine && p.avatar_url && <button className="linkbtn" onClick={dropPhoto}>Remove photo</button>}
          </div>
        </div>
        <div className="stats">
          <div><b>{posts.length}</b><span>{t('profile.contributions')}</span></div>
          <div><b>{stories.length}</b><span>{t('profile.pieces')}</span></div>
          <button className="stat-btn" onClick={() => setList('followers')}><b>{counts.followers}</b><span>{t('profile.followers')}</span></button>
          <button className="stat-btn" onClick={() => setList('following')}><b>{counts.following}</b><span>{t('profile.followingN')}</span></button>
        </div>
        <div className="row">
          {mine ? (
            <Link className="btn ghost" to="/settings">{t('btn.editProfile')}</Link>
          ) : (
            <>
              {!blocked && <button className={'btn' + (following ? ' ghost' : '')} onClick={toggleFollow} disabled={busyFollow} aria-pressed={following}>{following ? t('btn.following') : t('btn.follow')}</button>}
              {!blocked && <button className="btn ghost" onClick={message}>{t('btn.message')}</button>}
              {me && <button className="btn ghost sm" onClick={toggleBlock}>{blocked ? t('btn.unblock') : t('btn.block')}</button>}
              <div className="acts tight"><ReportButton type="profile" id={p.id} label="Report this profile" /></div>
            </>
          )}
        </div>
        <ErrorNote error={err} />
      </section>
      <div className="tabs">
        <button className={'tab' + (tab === 'posts' ? ' on' : '')} onClick={() => setTab('posts')}>{t('profile.contributions')}</button>
        <button className={'tab' + (tab === 'pieces' ? ' on' : '')} onClick={() => setTab('pieces')}>Peace Quilt pieces</button>
      </div>
      {tab === 'pieces' && (stories.length ? stories.map((s) => <StoryCard key={s.id} s={s} themes={themes} regions={regions} />) : <Empty title="No public pieces yet" />)}
      {tab === 'posts' && (posts.length ? posts.map((x) => <PostCard key={x.id} p={x} />) : <Empty title="No contributions yet" />)}
      {mine && <p className="note">Pieces you shared without your name are not listed on your public profile.</p>}
      {list && <PeopleList ownerId={p.id} which={list} onClose={() => setList(null)} />}
    </div>
  );
}
