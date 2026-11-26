import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PostCard, StoryCard } from '../components/cards';
import { Avatar, Empty, ErrorNote, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { exploreFeed, followingFeed, getInterests, getRegions, getThemes, interestsFeed, latestFeed, NO_PREFS, updateMyProfile, type FeedPrefs } from '../lib/data';
import { nameOf } from '../lib/format';
import type { FeedItem, Region, Theme } from '../lib/types';
import { SUBJECT_COLORS, useSubjects } from '../lib/useSubjects';
import { LANGS, useT } from '../lib/i18n';
import type { Profile } from '../lib/types';

type Tab = 'interests' | 'following' | 'latest' | 'explore';

const WHY: Record<Tab, string> = {
  interests: 'Contributions tagged with the subjects you chose, newest first, from anyone. Follower counts play no part.',
  following: 'Everything from the people you follow, newest first.',
  latest: 'Every public contribution in the order it was published. Nothing is ranked.',
  explore: 'Contributions outside your chosen subjects, so you can discover other discussions.',
};

export default function Feed() {
  const { me, loading, refresh } = useAuth();
  const t = useT();
  const [prefs, setPrefsState] = useState<FeedPrefs>(NO_PREFS);
  const [showPrefs, setShowPrefs] = useState(false);
  useEffect(() => { setPrefsState(readPrefs(me)); }, [me]);
  async function savePrefs(next: FeedPrefs) {
    setPrefsState(next);
    if (me) {
      try { await updateMyProfile(me.id, { feed_languages: next.languages, feed_sourced_only: next.sourcedOnly, muted_subjects: next.muted }); await refresh(); } catch { /* kept locally */ }
    } else {
      try { localStorage.setItem('va-feed', JSON.stringify(next)); } catch { /* storage unavailable */ }
    }
  }
  const prefKey = JSON.stringify(prefs);
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
      if (tab === 'interests') return interestsFeed(interests, prefs);
      if (tab === 'following' && me) return followingFeed(me.id);
      if (tab === 'explore') return exploreFeed(interests, prefs);
      return latestFeed(prefs);
    };
    load().then((x) => live && setItems(x)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [tab, me?.id, loading, interests, prefKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs: [Tab, string][] = me
    ? [['interests', t('feed.interests')], ['following', t('feed.following')], ['latest', t('feed.latest')], ['explore', t('feed.explore')]]
    : [['latest', t('feed.latest')], ['explore', t('feed.explore')]];
  const noInterests = tab === 'interests' && interests !== null && interests.length === 0;

  return (
    <div className="col">
      <div className="pagehead">
        <h1 className="h1">{me ? t('feed.home') : 'Verum Agora'}</h1>
        <div className="tabs" role="tablist">
          {tabs.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="note why">
        <span><b>{t('feed.why')}</b> {t('feed.why.' + tab) === 'feed.why.' + tab ? WHY[tab] : t('feed.why.' + tab)}</span>
        {tab !== 'following' && <PrefsSummary prefs={prefs} />}
        {tab !== 'following' && <button className="linkbtn" onClick={() => setShowPrefs((x) => !x)} aria-expanded={showPrefs}>{t('fc.button')}</button>}
      </div>
      {showPrefs && tab !== 'following' && <FeedControls prefs={prefs} onChange={savePrefs} onClose={() => setShowPrefs(false)} />}

      {tab === 'interests' && interests && interests.length > 0 && (
        <div className="row subj-row">
          {interests.map((id) => {
            const s = subjects.find((x) => x.id === id);
            return s ? <Link key={id} to={`/s/${s.slug}`} className="chip subj" style={{ background: SUBJECT_COLORS[id] + '1f', color: SUBJECT_COLORS[id] }}>{s.name}</Link> : null;
          })}
          <Link to="/settings" className="note">{t('feed.change')}</Link>
        </div>
      )}

      {me ? (
        <Link className="card composer" to="/new"><Avatar name={nameOf(me)} role={me.role} src={me.avatar_url} /><span className="fake">{t('feed.compose')}</span></Link>
      ) : (
        <div className="card row" style={{ justifyContent: 'space-between' }}><span>{t('feed.join')}</span><Link className="btn" to="/signup">{t('feed.joinBtn')}</Link></div>
      )}

      <Link to="/peace-quilt" className="card quilt-strip">
        <div className="mini-quilt small" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ background: ['#7DD3FC', '#F9A8D4', '#C6F432', '#86EFAC', '#C4B5FD', '#FDBA74'][(i * 5) % 6], animationDelay: `${(i % 6) * 0.3}s` }} />)}
        </div>
        <span><b>{t('nav.quilt')}</b><span className="note">{t('feed.quilt')}</span></span>
      </Link>

      {noInterests && (
        <Empty title={t('feed.choose')}>
          <p className="sub">{t('feed.chooseHelp')}</p>
          <Link className="btn" to="/settings">{t('feed.chooseBtn')}</Link>
        </Empty>
      )}

      <ErrorNote error={err} />
      {!items && !err && <Spinner />}
      {items?.map((it) => it.type === 'story'
        ? <StoryCard key={'s' + it.item.id} s={it.item} themes={themes} regions={regions} />
        : <PostCard key={'p' + it.item.id} p={it.item} />)}
      {items && items.length === 0 && !noInterests && (
        <Empty title={t('feed.empty')}>
          <p className="sub">{tab === 'following' ? 'Follow people from their profiles to see their contributions here.' : 'Be the first to contribute.'}</p>
        </Empty>
      )}
    </div>
  );
}

function readPrefs(me: Profile | null): FeedPrefs {
  if (me) return { languages: me.feed_languages ?? [], sourcedOnly: !!me.feed_sourced_only, muted: me.muted_subjects ?? [] };
  try { return { ...NO_PREFS, ...JSON.parse(localStorage.getItem('va-feed') || '{}') }; } catch { return NO_PREFS; }
}

function PrefsSummary({ prefs }: { prefs: FeedPrefs }) {
  const t = useT();
  const subjects = useSubjects();
  const bits: string[] = [];
  if (prefs.languages.length) bits.push(prefs.languages.map((c) => LANGS.find(([k]) => k === c)?.[1] ?? c).join(', '));
  if (prefs.sourcedOnly) bits.push(t('fc.sourced.short'));
  if (prefs.muted.length) bits.push(t('fc.hidden.short') + ' ' + prefs.muted.map((id) => subjects.find((s) => s.id === id)?.name).filter(Boolean).join(', '));
  if (!bits.length) return null;
  return <span className="fc-summary">{t('fc.yours')} {bits.join(' · ')}</span>;
}

/** Controls the reader owns: languages, sourced-only, hidden subjects. Nothing here is decided by popularity. */
function FeedControls({ prefs, onChange, onClose }: { prefs: FeedPrefs; onChange: (p: FeedPrefs) => void; onClose: () => void }) {
  const t = useT();
  const subjects = useSubjects();
  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  return (
    <section className="card fc" aria-label={t('fc.title')}>
      <div className="row" style={{ justifyContent: 'space-between' }}><b>{t('fc.title')}</b><button className="linkbtn" onClick={onClose}>{t('fc.close')}</button></div>
      <div>
        <span className="note">{t('fc.languages')}</span>
        <div className="fc-opts">
          {LANGS.map(([code, name]) => (
            <button key={code} type="button" className={'lang-opt' + (prefs.languages.includes(code) ? ' on' : '')} aria-pressed={prefs.languages.includes(code)}
              onClick={() => onChange({ ...prefs, languages: toggle(prefs.languages, code) })}>{name}</button>
          ))}
        </div>
      </div>
      <label className="check"><input type="checkbox" checked={prefs.sourcedOnly} onChange={(e) => onChange({ ...prefs, sourcedOnly: e.target.checked })} /><span>{t('fc.sourced')}</span></label>
      <div>
        <span className="note">{t('fc.hide')}</span>
        <div className="fc-opts">
          {subjects.map((s) => (
            <button key={s.id} type="button" className={'lang-opt sm' + (prefs.muted.includes(s.id) ? ' off' : '')} aria-pressed={prefs.muted.includes(s.id)}
              onClick={() => onChange({ ...prefs, muted: toggle(prefs.muted, s.id) })}>{s.name}</button>
          ))}
        </div>
      </div>
      {(prefs.languages.length > 0 || prefs.sourcedOnly || prefs.muted.length > 0) && <button className="btn ghost sm" onClick={() => onChange(NO_PREFS)}>{t('fc.reset')}</button>}
    </section>
  );
}
