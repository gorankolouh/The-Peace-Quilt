import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ROLE_COLORS } from '../lib/constants';
import { supabase } from '../lib/supabase';

export default function Welcome() {
  const { me } = useAuth();
  const ref = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('stories_v').select('*', { count: 'exact', head: true }).then(({ count }) => setCount(count ?? null));
  }, []);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, raf = 0;
    const cols = Object.values(ROLE_COLORS);
    let pts: { x: number; y: number; vx: number; vy: number; c: string; r: number }[] = [];
    const size = () => {
      const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
      W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
      pts = Array.from({ length: Math.round(Math.min(90, (W * H) / 14000)) }, (_, i) => ({
        x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
        c: i % 4 === 0 ? cols[i % cols.length] : '#C6F432', r: Math.random() * 1.6 + 1,
      }));
    };
    const frame = () => {
      ctx.fillStyle = '#0A0B0A'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        if (!reduce) { a.x += a.vx; a.y += a.vy; if (a.x < 0 || a.x > W) a.vx *= -1; if (a.y < 0 || a.y > H) a.vy *= -1; }
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) { ctx.strokeStyle = `rgba(198,244,50,${(1 - d / 130) * 0.22})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
      }
      pts.forEach((a) => { ctx.shadowColor = a.c; ctx.shadowBlur = 10; ctx.fillStyle = a.c; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 7); ctx.fill(); });
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      const g = ctx.createLinearGradient(0, 0, W * 0.7, 0);
      g.addColorStop(0, 'rgba(10,11,10,.92)'); g.addColorStop(1, 'rgba(10,11,10,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    size(); frame();
    const onR = () => { size(); if (reduce) frame(); };
    window.addEventListener('resize', onR);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onR); };
  }, []);

  return (
    <section className="hero">
      <canvas ref={ref} className="hero-cv" aria-hidden="true" />
      <div className="in">
        <span className="eyebrow">A living archive for peace</span>
        <h1>The Peace<br /><em>Quilt</em></h1>
        <p className="lead">Thousands of small, true stories from doctors, mothers, teachers and mediators. Sewn together, they become a pattern no one can ignore.</p>
        <div className="ctas">
          {me ? <Link className="btn" to="/feed">Go to your feed</Link> : <Link className="btn" to="/signup">Join the quilt</Link>}
          <Link className="btn ghost" to="/constellation">See the constellation</Link>
          {!me && <Link className="btn ghost" to="/login">Log in</Link>}
        </div>
        {count !== null && count > 0 && <p className="note" style={{ marginTop: 16 }}>{count} pieces sewn so far.</p>}
        <div className="pillars">
          <div><b>One piece at a time</b><span>Share a story, a photo, a voice note or a long article.</span></div>
          <div><b>Threads, not silos</b><span>Every piece is tagged by role, theme and region, so separate voices connect.</span></div>
          <div><b>Safe by design</b><span>Consent per story, pseudonyms, and location data removed from photos before upload.</span></div>
        </div>
        <p className="foot-links"><Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> · <Link to="/imprint">Imprint</Link></p>
      </div>
    </section>
  );
}
