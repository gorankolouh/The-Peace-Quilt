import { useEffect, useRef } from 'react';
import { ROLE_COLORS } from '../lib/constants';
import type { Story, Theme } from '../lib/types';

export type Thread = { a: number; b: number; type: 'theme' | 'place' };

export function buildThreads(stories: Story[]): Thread[] {
  const out: Thread[] = [];
  const byTheme = new Map<number, Story[]>();
  const byRegion = new Map<number, Story[]>();
  stories.forEach((s) => {
    if (!byTheme.has(s.theme_id)) byTheme.set(s.theme_id, []);
    byTheme.get(s.theme_id)!.push(s);
    if (!byRegion.has(s.region_id)) byRegion.set(s.region_id, []);
    byRegion.get(s.region_id)!.push(s);
  });
  byTheme.forEach((m) => {
    if (m.length < 2) return;
    m.forEach((s, j) => {
      if (m.length > 2 || j === 0) out.push({ a: s.id, b: m[(j + 1) % m.length].id, type: 'theme' });
      if (m.length > 4 && j % 2 === 0) out.push({ a: s.id, b: m[(j + 2) % m.length].id, type: 'theme' });
    });
  });
  byRegion.forEach((m) => {
    const sorted = [...m].sort((x, y) => x.theme_id - y.theme_id);
    for (let j = 0; j + 1 < sorted.length; j++)
      if (sorted[j].theme_id !== sorted[j + 1].theme_id) out.push({ a: sorted[j].id, b: sorted[j + 1].id, type: 'place' });
  });
  return out;
}

export function connectedTo(id: number, threads: Thread[]) {
  const seen = new Map<number, Thread['type']>();
  threads.forEach((t) => {
    if (t.a === id && !seen.has(t.b)) seen.set(t.b, t.type);
    if (t.b === id && !seen.has(t.a)) seen.set(t.a, t.type);
  });
  return seen;
}

type Props = {
  stories: Story[];
  themes: Theme[];
  threads: Thread[];
  mode: 0 | 1;
  roleFilter: string | null;
  selected: number | null;
  onSelect: (id: number) => void;
};

type P = { qx: number; qy: number; qs: number; cx: number; cy: number };

export function Constellation({ stories, themes, threads, mode, roleFilter, selected, onSelect }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef({
    t: mode as number, target: mode as number, raf: 0, from: mode as number, start: 0,
    pos: new Map<number, P>(), labels: [] as [string, number, number][], stars: [] as number[][], W: 0, H: 0,
    starLayer: null as HTMLCanvasElement | null, glows: new Map<string, HTMLCanvasElement>(), byId: new Map<number, Story>(),
  });
  const props = useRef({ stories, themes, threads, roleFilter, selected });
  props.current = { stories, themes, threads, roleFilter, selected };
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ease = (v: number) => { const x = Math.max(0, Math.min(1, v)); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
  const lerp = (a: number, b: number, e: number) => a + (b - a) * e;

  function layout() {
    const cv = ref.current;
    if (!cv) return;
    const s = st.current;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1); // 3x phone screens gain nothing visible but cost 2x the work
    s.W = r.width; s.H = r.height;
    cv.width = s.W * dpr; cv.height = s.H * dpr;
    cv.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { stories, themes } = props.current;
    const n = Math.max(1, stories.length);
    const cols = Math.max(4, Math.min(s.W < 560 ? 8 : 14, Math.ceil(Math.sqrt(n * (s.W / s.H)))));
    const rows = Math.ceil(n / cols);
    const cell = Math.min((s.W - 32) / cols, (s.H - 60) / rows, 64);
    const ox = (s.W - cell * cols) / 2, oy = (s.H - 30 - cell * rows) / 2;
    const used = themes.filter((t) => stories.some((x) => x.theme_id === t.id));
    const k = Math.max(1, used.length);
    const cx = s.W / 2, cy = s.H / 2 - 14;
    const rx = s.W * (s.W < 560 ? 0.29 : 0.33), ry = s.H * 0.29;
    const cr = Math.min(s.W, s.H) * (s.W < 560 ? 0.1 : 0.085) * Math.min(1.8, Math.max(1, Math.sqrt(n / (k * 6))));
    s.pos.clear();
    s.labels = [];
    used.forEach((th, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / k;
      const tx = k === 1 ? cx : cx + Math.cos(a) * rx, ty = k === 1 ? cy : cy + Math.sin(a) * ry;
      const m = stories.filter((x) => x.theme_id === th.id);
      m.forEach((x, j) => {
        const b = (j * 2 * Math.PI) / m.length + i;
        const rr = m.length > 12
          ? cr * (0.3 + 0.7 * Math.sqrt((j + 1) / m.length))
          : cr * (1 + 0.12 * Math.sin(j * 2.7));
        const gi = stories.indexOf(x);
        s.pos.set(x.id, { qx: ox + ((gi % cols) + 0.5) * cell, qy: oy + (Math.floor(gi / cols) + 0.5) * cell, qs: cell - 6, cx: tx + Math.cos(b) * rr, cy: ty + Math.sin(b) * rr });
      });
      s.labels.push([th.short.toUpperCase(), tx, ty + cr + 18]);
    });
    if (!s.stars.length) for (let i = 0; i < 150; i++) s.stars.push([Math.random(), Math.random(), Math.random() * 1.1 + 0.2, Math.random()]);
    s.byId = new Map(stories.map((x) => [x.id, x]));
    // Stars are drawn once into their own layer, then faded in as a single image.
    const sl = document.createElement('canvas');
    sl.width = cv.width; sl.height = cv.height;
    const sc = sl.getContext('2d')!;
    sc.setTransform(dpr, 0, 0, dpr, 0, 0);
    s.stars.forEach((p) => { sc.fillStyle = `rgba(238,242,234,${0.15 + 0.4 * p[3]})`; sc.beginPath(); sc.arc(p[0] * s.W, p[1] * s.H, p[2], 0, 7); sc.fill(); });
    s.starLayer = sl;
  }

  // A soft glow per colour, rendered once and reused (canvas blur on every piece, every frame, is what made phones stutter).
  function glow(col: string) {
    const s = st.current;
    let g = s.glows.get(col);
    if (!g) {
      g = document.createElement('canvas');
      g.width = g.height = 64;
      const c = g.getContext('2d')!;
      const rg = c.createRadialGradient(32, 32, 2, 32, 32, 30);
      rg.addColorStop(0, col + 'aa'); rg.addColorStop(0.35, col + '44'); rg.addColorStop(1, col + '00');
      c.fillStyle = rg; c.fillRect(0, 0, 64, 64);
      s.glows.set(col, g);
    }
    return g;
  }

  function draw() {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const s = st.current;
    const { stories, threads, roleFilter, selected } = props.current;
    const e = ease(s.t);
    const { W, H } = s;
    ctx.fillStyle = '#050605';
    ctx.fillRect(0, 0, W, H);
    if (e > 0 && s.starLayer) { ctx.globalAlpha = e; ctx.drawImage(s.starLayer, 0, 0, W, H); ctx.globalAlpha = 1; }
    const at = (id: number): [number, number] => { const p = s.pos.get(id)!; return [lerp(p.qx, p.cx, e), lerp(p.qy, p.cy, e)]; };
    const byId = s.byId;
    const la = Math.max(0, (e - 0.45) / 0.55);
    if (la > 0) {
      threads.forEach((l) => {
        const A = byId.get(l.a), B = byId.get(l.b);
        if (!A || !B || !s.pos.has(l.a) || !s.pos.has(l.b)) return;
        const dim = roleFilter && A.role !== roleFilter && B.role !== roleFilter;
        const hot = l.a === selected || l.b === selected;
        const rgb = l.type === 'theme' ? '198,244,50' : '110,231,183';
        ctx.strokeStyle = `rgba(${rgb},${(hot ? 0.95 : l.type === 'theme' ? 0.4 : 0.2) * la * (dim ? 0.2 : 1)})`;
        ctx.lineWidth = hot ? 1.8 : 1;
        ctx.setLineDash(l.type === 'theme' ? [] : [3, 4]);
        const [ax, ay] = at(l.a), [bx, by] = at(l.b);
        ctx.beginPath(); ctx.moveTo(ax, ay);
        if (l.type === 'theme') ctx.lineTo(bx, by);
        else ctx.quadraticCurveTo((ax + bx) / 2 + (ay - by) * 0.15, (ay + by) / 2 + (bx - ax) * 0.15, bx, by);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.font = '600 12px "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      s.labels.forEach(([nm, x, y]) => { ctx.fillStyle = `rgba(198,244,50,${la * 0.9})`; ctx.fillText(nm, x, Math.min(y, H - 36)); });
    }
    stories.forEach((x) => {
      const p = s.pos.get(x.id);
      if (!p) return;
      const [px, py] = at(x.id);
      const col = ROLE_COLORS[x.role] || '#EEF2EA';
      const dim = roleFilter && x.role !== roleFilter;
      const sz = lerp(p.qs, x.id === selected ? 14 : 10, e), rad = lerp(4, sz / 2, e);
      if (e > 0.05) { ctx.globalAlpha = (dim ? 0.15 : 1) * e; const gs = sz + 26; ctx.drawImage(glow(col), px - gs / 2, py - gs / 2, gs, gs); }
      ctx.globalAlpha = dim ? 0.15 : 1;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.roundRect(px - sz / 2, py - sz / 2, sz, sz, rad); ctx.fill();
      if (e < 0.6 && p.qs > 22) {
        ctx.strokeStyle = `rgba(5,6,5,${0.5 * (1 - e / 0.6)})`; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(px - sz / 2 + 4, py - sz / 2 + 4, sz - 8, sz - 8, 2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (x.id === selected) { ctx.strokeStyle = '#EEF2EA'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(px - sz / 2 - 4, py - sz / 2 - 4, sz + 8, sz + 8, rad + 4); ctx.stroke(); }
      ctx.globalAlpha = 1;
    });
  }

  // Time-based, so it takes the same 0.9 s on every phone, whatever its frame rate.
  function kick() {
    const s = st.current;
    cancelAnimationFrame(s.raf);
    if (reduce) { s.t = s.target; draw(); return; }
    s.from = s.t; s.start = -1;
    const dur = 900 * Math.abs(s.target - s.from);
    const tick = (now: number) => {
      if (s.start < 0) s.start = now; // start the clock on the first frame
      const k = dur ? Math.max(0, Math.min(1, (now - s.start) / dur)) : 1;
      s.t = s.from + (s.target - s.from) * k;
      draw();
      if (k < 1) s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
  }

  useEffect(() => {
    layout(); draw();
    const onR = () => { layout(); draw(); };
    window.addEventListener('resize', onR);
    return () => { window.removeEventListener('resize', onR); cancelAnimationFrame(st.current.raf); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { layout(); draw(); }, [stories, themes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { draw(); }, [roleFilter, selected, threads]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { st.current.target = mode; kick(); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  function click(ev: React.MouseEvent<HTMLCanvasElement>) {
    const cv = ref.current!;
    const r = cv.getBoundingClientRect();
    const mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const s = st.current, e = ease(s.t);
    let best = -1, bd = 1e9;
    props.current.stories.forEach((x) => {
      const p = s.pos.get(x.id);
      if (!p) return;
      const px = lerp(p.qx, p.cx, e), py = lerp(p.qy, p.cy, e), sz = lerp(p.qs, 10, e);
      const d = Math.hypot(mx - px, my - py);
      if (d < sz / 2 + 12 && d < bd) { bd = d; best = x.id; }
    });
    if (best >= 0) onSelect(best);
  }

  return <canvas ref={ref} className="cv" onClick={click} aria-label="Map of all story pieces. Tap a piece to open it." />;
}
