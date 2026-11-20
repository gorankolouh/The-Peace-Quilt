import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PostCard, StoryCard } from '../components/cards';
import { Avatar, Empty, ErrorNote, RoleChip, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { articles, everythingFeed, followingFeed, getRegions, getThemes, newestStories, setFollow, suggestedProfiles } from '../lib/data';
import { nameOf } from '../lib/format';
import type { FeedItem, Profile, Region, Theme } from '../lib/types';

type Tab = 'following' | 'everything' | 'pieces' | 'articles';

export default function Feed() {
  const { me, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('following');
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { Promise.all([getThemes(), getRegions()]).then(([t, r]) => { setThemes(t); setRegions(r); }).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { if (!loading && !me && tab === 'following') setTab('everything'); }, [me, tab, loading]);

  useEffect(() => {
    let live = true;
    setItems(null); setErr(null);
    const load = async (): Promise<FeedItem[]> => {
      if (tab === 'following' && me) return followingFeed(me.id);
      if (tab === 'pieces') return (await newestStories()).map((s) => ({ type: 'story', item: s }));
      if (tab === 'articles') return (await articles()).map((p) => ({ type: 'post', item: p }));
      return everythingFeed();
    };
    if (loading || (tab === 'following' && !me)) return;
    load().then((x) => live && setItems(x)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [tab, me, loading]);

  useEffect(() => {
    if (tab === 'following' && items && items.filter((i) => i.item.author_id !== me?.id).length < 3)
      suggestedProfiles(me?.id).then(setPeople).catch(() => {});
  }, [tab, items, me]);

  const tabs: [Tab, string][] = me
    ? [['following', 'Following'], ['everything', 'Everything'], ['pieces', 'Newest pieces'], ['articles', 'Articles']]
    : [['everything', 'Everything'], ['pieces', 'Newest pieces'], ['articles', 'Articles']];

  return (
    <div className="col">
      <div className="pagehead">
        <h1 className="h1">{me ? 'Your feed' : 'The quilt'}</h1>
        <div className="tabs" role="tablist">
          {tabs.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>
      {me ? (
        <Link className="card composer" to="/new"><Avatar name={nameOf(me)} role={me.role} /><span className="fake">Share a piece, a post or an article</span></Link>
      ) : (
        <div className="card row" style={{ justifyContent: 'space-between' }}><span>Join to share your own piece, follow people and send messages.</span><Link className="btn" to="/signup">Join the quilt</Link></div>
      )}
      <ErrorNote error={err} />
      {!items && !err && <Spinner />}
      {items?.map((it) => it.type === 'story'
        ? <StoryCard key={'s' + it.item.id} s={it.item} themes={themes} regions={regions} />
        : <PostCard key={'p' + it.item.id} p={it.item} />)}
      {items && items.length === 0 && (
        <Empty title={tab === 'following' ? 'Your feed is quiet' : 'Nothing here yet'}>
          <p className="sub">{tab === 'following' ? 'Follow people below, or add the first piece yourself.' : 'Be the first to add a piece.'}</p>
        </Empty>
      )}
      {tab === 'following' && people.length > 0 && (
        <section className="card">
          <h2 className="h2" style={{ margin: 0 }}>People to follow</h2>
          {people.map((p) => (
            <div key={p.id} className="row person">
              <Link to={`/u/${p.username}`} className="who" style={{ flex: 1 }}>
                <Avatar name={nameOf(p)} role={p.role} size={36} />
                <div><div className="row"><span className="n">{nameOf(p)}</span><RoleChip role={p.role} /></div><div className="m">@{p.username}</div></div>
              </Link>
              <button className={'btn sm' + (followed[p.id] ? '' : ' ghost')} onClick={async () => {
                const on = !followed[p.id];
                setFollowed((f) => ({ ...f, [p.id]: on }));
                try { await setFollow(me!.id, p.id, on); } catch { setFollowed((f) => ({ ...f, [p.id]: !on })); }
              }}>{followed[p.id] ? 'Following' : 'Follow'}</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
