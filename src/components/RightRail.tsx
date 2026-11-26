import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { latestFeed } from '../lib/data';
import type { Post } from '../lib/types';
import { SUBJECT_COLORS, useSubjects } from '../lib/useSubjects';

type Node = { x: number; y: number; vx: number; vy: number; r: number; c: string; subject?: number; post?: Post; label?: string };

/** A small, slowly drifting network: the 12 subjects as hubs, recent contributions as satellites. */
function LiveNetwork({ posts }: { posts: Post[] }) {
  const subjects = useSubjects();
  const ref = useRef<HTMLCanvasElement>(null);
  const nav = useNavigate();
  const nodes = useRef<Node[]>([]);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !subjects.length) return;
    const ctx = cv.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const d = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    const hubs: Node[] = subjects.map((s, i) => {
      const a = (i / subjects.length) * Math.PI * 2;
      return { x: W / 2 + Math.cos(a) * W * 0.34, y: H / 2 + Math.sin(a) * H * 0.34, vx: 0, vy: 0, r: 4.5, c: SUBJECT_COLORS[s.id], subject: s.id, label: s.name };
    });
    const sats: Node[] = posts.slice(0, 36).map((p) => {
      const hub = hubs.find((h) => h.subject === p.subject_ids[0]) ?? hubs[(p.id * 7) % hubs.length];
      return { x: hub.x + (Math.random() - 0.5) * 50, y: hub.y + (Math.random() - 0.5) * 50, vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2, r: 2.4, c: hub.c, post: p, label: p.title || p.body.slice(0, 60) };
    });
    nodes.current = [...hubs, ...sats];
    let raf = 0, t = 0;
    const frame = () => {
      t += 0.004;
      ctx.clearRect(0, 0, W, H);
      hubs.forEach((h, i) => {
        const a = (i / hubs.length) * Math.PI * 2 + t * 0.6;
        h.x = W / 2 + Math.cos(a) * W * 0.34;
        h.y = H / 2 + Math.sin(a) * H * 0.34 + Math.sin(t * 3 + i) * 3;
      });
      sats.forEach((s) => {
        const hubsOf = hubs.filter((h) => s.post!.subject_ids.includes(h.subject!));
        const target = hubsOf[0] ?? hubs[0];
        s.vx += (target.x - s.x) * 0.0006 + (Math.random() - 0.5) * 0.02;
        s.vy += (target.y - s.y) * 0.0006 + (Math.random() - 0.5) * 0.02;
        s.vx *= 0.985; s.vy *= 0.985;
        s.x += s.vx; s.y += s.vy;
        hubsOf.forEach((h) => {
          ctx.strokeStyle = h.c + '55'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(h.x, h.y); ctx.stroke();
        });
      });
      for (let i = 0; i < hubs.length; i++) {
        const a = hubs[i], b = hubs[(i + 1) % hubs.length];
        ctx.strokeStyle = 'rgba(198,244,50,0.10)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      [...hubs, ...sats].forEach((n) => {
        ctx.shadowColor = n.c; ctx.shadowBlur = n.subject ? 12 : 6; ctx.fillStyle = n.c;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + (n.subject ? Math.sin(t * 4 + n.subject) * 0.6 : 0), 0, 7); ctx.fill();
      });
      ctx.shadowBlur = 0;
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [subjects, posts]);

  function hit(ev: React.MouseEvent<HTMLCanvasElement>): Node | null {
    const r = ref.current!.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    let best: Node | null = null, bd = 14;
    nodes.current.forEach((n) => { const dd = Math.hypot(n.x - x, n.y - y); if (dd < bd) { bd = dd; best = n; } });
    return best;
  }

  return (
    <div className="live-net">
      <canvas ref={ref} className="live-cv" aria-label="Live network of subjects and recent contributions"
        onMouseMove={(e) => setHover(hit(e)?.label ?? null)} onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const n = hit(e);
          if (n?.post) nav(`/post/${n.post.id}`);
          else if (n?.subject) { const s = subjects.find((x) => x.id === n.subject); if (s) nav(`/s/${s.slug}`); }
        }} />
      <span className="live-label">{hover ?? 'Hover a light, tap to open'}</span>
    </div>
  );
}

const QUILT = ['#7DD3FC', '#F9A8D4', '#C6F432', '#86EFAC', '#C4B5FD', '#FDBA74'];

export function RightRail() {
  const [posts, setPosts] = useState<Post[]>([]);
  const subjects = useSubjects();
  useEffect(() => {
    if (window.innerWidth < 1240) return;
    latestFeed().then((items) => setPosts(items.flatMap((i) => (i.type === 'post' ? [i.item] : [])))).catch(() => {});
  }, []);
  return (
    <aside className="rail" aria-label="Discover">
      <section className="rail-card">
        <div className="rail-head"><b>Live connections</b><span className="live-dot" aria-hidden="true" /></div>
        <LiveNetwork posts={posts} />
        <p className="note">Twelve subjects, and the newest contributions moving towards them.</p>
      </section>
      <Link to="/peace-quilt" className="rail-card quilt-card">
        <div className="mini-quilt" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => <i key={i} style={{ background: QUILT[(i * 5) % QUILT.length], animationDelay: `${(i % 6) * 0.35 + Math.floor(i / 6) * 0.2}s` }} />)}
        </div>
        <b>The Peace Quilt</b>
        <span className="note">Small, true peace stories, sewn into a living constellation.</span>
      </Link>
      <section className="rail-card">
        <b>Subjects</b>
        <div className="rail-subjects">
          {subjects.map((s) => (
            <Link key={s.id} to={`/s/${s.slug}`}><i style={{ background: SUBJECT_COLORS[s.id] }} />{s.name}</Link>
          ))}
        </div>
      </section>
    </aside>
  );
}
