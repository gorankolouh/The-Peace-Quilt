import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PostCard } from '../components/cards';
import { Empty, ErrorNote, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { getInterests, setInterests, subjectCounts, subjectPosts } from '../lib/data';
import type { Post } from '../lib/types';
import { SUBJECT_COLORS, useSubjects } from '../lib/useSubjects';

export function SubjectsIndex() {
  const subjects = useSubjects();
  const [counts, setCounts] = useState<Record<number, number>>({});
  useEffect(() => { subjectCounts().then(setCounts).catch(() => {}); }, []);
  return (
    <div className="col wide">
      <div className="pagehead">
        <div>
          <h1 className="h1">Explore subjects</h1>
          <p className="sub">Twelve subjects connect everything on Verum Agora. A contribution can belong to several.</p>
        </div>
      </div>
      {!subjects.length && <Spinner />}
      <div className="subj-grid">
        {subjects.map((s) => (
          <Link key={s.id} to={`/s/${s.slug}`} className="card subj-card" style={{ borderTopColor: SUBJECT_COLORS[s.id] }}>
            <span className="eyebrow" style={{ color: SUBJECT_COLORS[s.id] }}>{counts[s.id] ?? 0} contribution{(counts[s.id] ?? 0) === 1 ? "" : "s"}</span>
            <h2>{s.name}</h2>
            <p className="sub">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SubjectPage() {
  const slug = useParams().slug!;
  const subjects = useSubjects();
  const { me } = useAuth();
  const subject = subjects.find((s) => s.slug === slug);
  const [topic, setTopic] = useState<number | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [mine, setMine] = useState<number[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setTopic(null); }, [slug]);
  useEffect(() => {
    if (!subject) return;
    setPosts(null);
    subjectPosts(subject.id, topic).then(setPosts).catch((e) => setErr(e.message));
  }, [subject, topic]);
  useEffect(() => { if (me) getInterests(me.id).then(setMine).catch(() => {}); }, [me]);

  if (!subjects.length) return <div className="col"><Spinner /></div>;
  if (!subject) return <div className="col"><h1 className="h1">Subject not found</h1><Link to="/subjects">All subjects</Link></div>;
  const c = SUBJECT_COLORS[subject.id];
  const following = mine.includes(subject.id);

  async function toggle() {
    if (!me) return;
    const next = following ? mine.filter((x) => x !== subject!.id) : [...mine, subject!.id];
    setMine(next);
    try { await setInterests(me.id, next); } catch (x) { setErr((x as Error).message); }
  }

  return (
    <div className="col">
      <Link className="back" to="/subjects">All subjects</Link>
      <section className="card subj-head" style={{ borderTopColor: c }}>
        <span className="eyebrow" style={{ color: c }}>Subject</span>
        <h1 className="h1">{subject.name}</h1>
        <p className="sub">{subject.description}</p>
        {me && <button className={'btn' + (following ? ' ghost' : '')} onClick={toggle}>{following ? 'In my interests' : 'Add to my interests'}</button>}
      </section>
      <div className="tabs" aria-label="Subtopics">
        <button className={'tab' + (topic === null ? ' on' : '')} onClick={() => setTopic(null)}>All</button>
        {subject.subtopics.map((t) => (
          <button key={t.id} className={'tab' + (topic === t.id ? ' on' : '')} onClick={() => setTopic(t.id)}>{t.name}</button>
        ))}
      </div>
      {subject.id === 2 && (
        <Link to="/peace-quilt" className="card collection">
          <span className="orb" aria-hidden="true" />
          <div><b>The Peace Quilt</b><p className="sub">A collection of small, true peace stories, sewn into a living constellation.</p></div>
        </Link>
      )}
      <ErrorNote error={err} />
      {!posts && !err && <Spinner />}
      {posts?.map((p) => <PostCard key={p.id} p={p} />)}
      {posts && posts.length === 0 && <Empty title="No contributions here yet"><Link className="btn" to="/new">Start the discussion</Link></Empty>}
    </div>
  );
}
