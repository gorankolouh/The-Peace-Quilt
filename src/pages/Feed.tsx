import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PostCard, StoryCard } from '../components/cards';
import { Avatar, Empty, ErrorNote, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { exploreFeed, followingFeed, getInterests, getRegions, getThemes, interestsFeed, latestFeed } from '../lib/data';
import { nameOf } from '../lib/format';
import type { FeedItem, Region, Theme } from '../lib/types';
import { SUBJECT_COLORS, useSubjects } from '../lib/useSubjects';

type Tab = 'interests' | 'following' | 'latest' | 'explore';

const WHY: Record<Tab, string> = {
  interests: 'Contributions tagged with the subjects you chose, newest first, from anyone. Follower counts play no part.',
  following: 'Everything from the people you follow, newest first.',
  latest: 'Every public contribution in the order it was published. Nothing is ranked.',
  explore: 'Contributions outside your chosen subjects, so you can discover other discussions.',
};

export default function Feed() {
  const { me, loading } = useAuth();
  const subjects = useSubjects();
  const [tab, setTab] = useState<Tab>('interests');
  const [interests, setInterests] = useState<number[] | null>(null);
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { Promise.all([getThemes(), getRegions()]).then(([t, r]) => { setThemes(t); setRegions(r); }).catch(() => {}); }, []);
  useEffect(() => {
    if (loading) return;
    if (!me) { setInterests([]); setTab((t) => (t === 'interests' || t === 'following' ? 'latest' : t)); return; }
    getInterests(me.id).then(setInterests).catch(() => setInterests([]));
  }, [me, loading]);

  useEffect(() => {
    if (loading || interests === null) return;
    if (tab === 'interests' && interests.length === 0) { setItems([]); return; }
    let live = true;
    setItems(null); setErr(null);
    const load = (): Promise<FeedItem[]> => {
      if (tab === 'interests') return interestsFeed(interests);
      if (tab === 'following' && me) return followingFeed(me.id);
      if (tab === 'explore') return exploreFeed(interests);
      return latestFeed();
    };
    load().then((x) => live && setItems(x)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [tab, me, loading, interests]);

  const tabs: [Tab, string][] = me
    ? [['interests', 'My Interests'], ['following', 'Following'], ['latest', 'Latest'], ['explore', 'Explore']]
    : [['latest', 'Latest'], ['explore', 'Explore']];
  const noInterests = tab === 'interests' && interests !== null && interests.length === 0;

  return (
    <div className="col">
      <div className="pagehead">
        <h1 className="h1">{me ? 'Home' : 'Verum Agora'}</h1>
        <div className="tabs" role="tablist">
          {tabs.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>
      <p className="note why"><b>Why you see this:</b> {WHY[tab]}</p>

      {tab === 'interests' && interests && interests.length > 0 && (
        <div className="row subj-row">
          {interests.map((id) => {
            const s = subjects.find((x) => x.id === id);
            return s ? <Link key={id} to={`/s/${s.slug}`} className="chip subj" style={{ background: SUBJECT_COLORS[id] + '1f', color: SUBJECT_COLORS[id] }}>{s.name}</Link> : null;
          })}
          <Link to="/settings" className="note">Change</Link>
        </div>
      )}

      {me ? (
        <Link className="card composer" to="/new"><Avatar name={nameOf(me)} role={me.role} /><span className="fake">Share information, ask a question or publish an article</span></Link>
      ) : (
        <div className="card row" style={{ justifyContent: 'space-between' }}><span>Join to publish, follow subjects and people, and send messages.</span><Link className="btn" to="/signup">Join Verum Agora</Link></div>
      )}

      {noInterests && (
        <Empty title="Choose the subjects you care about">
          <p className="sub">Your home feed is built from subjects, not from popularity.</p>
          <Link className="btn" to="/settings">Choose subjects</Link>
        </Empty>
      )}

      <ErrorNote error={err} />
      {!items && !err && <Spinner />}
      {items?.map((it) => it.type === 'story'
        ? <StoryCard key={'s' + it.item.id} s={it.item} themes={themes} regions={regions} />
        : <PostCard key={'p' + it.item.id} p={it.item} />)}
      {items && items.length === 0 && !noInterests && (
        <Empty title="Nothing here yet">
          <p className="sub">{tab === 'following' ? 'Follow people from their profiles to see their contributions here.' : 'Be the first to contribute.'}</p>
        </Empty>
      )}
    </div>
  );
}
