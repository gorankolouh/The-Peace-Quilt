import { useEffect, useState, type ReactNode } from 'react';
import { ROLE_COLORS } from '../lib/constants';
import { initials } from '../lib/format';
import { avatarUrl, mediaUrl } from '../lib/media';
import type { MediaKind } from '../lib/types';

const svg = (d: ReactNode, size = 20, sw = 1.8) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
export const Icon = {
  feed: () => svg(<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />),
  star: () => svg(<><circle cx="5" cy="6" r="2" /><circle cx="18" cy="5" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7 6.5l9-1M6.2 7.6l4.8 8.8M17 6.8l-4 9.4" /></>),
  msg: () => svg(<path d="M4 5h16v11H9l-5 4z" />),
  grid: () => svg(<><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>),
  search: () => svg(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>),
  user: () => svg(<><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>),
  plus: () => svg(<path d="M12 5v14M5 12h14" />, 22, 2.2),
  heart: (on: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
  ),
  comment: () => svg(<path d="M4 5h16v11H9l-5 4z" />, 18),
  flag: () => svg(<path d="M5 21V4h11l-2 4 2 4H5" />, 18),
  back: () => svg(<path d="M15 5l-7 7 7 7" />, 16, 2),
  send: () => svg(<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />, 18),
  settings: () => svg(<><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2L10 21h4l.5-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /></>),
};

export function Avatar({ name, role, size = 42, src }: { name: string; role?: string; size?: number; src?: string | null }) {
  const c = ROLE_COLORS[role || 'Member'] || '#EEF2EA';
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img className="av av-img" src={avatarUrl(src)} alt="" width={size} height={size} style={{ width: size, height: size, boxShadow: `0 0 0 2px ${c}55` }} onError={() => setBroken(true)} />;
  }
  return (
    <span className="av" style={{ background: c + '26', color: c, width: size, height: size, fontSize: Math.max(11, size * 0.31) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function RoleChip({ role }: { role: string }) {
  const c = ROLE_COLORS[role] || '#EEF2EA';
  return <span className="chip" style={{ background: c + '26', color: c }}>{role}</span>;
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="chip muted">{children}</span>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="skeletons" role="status" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card skel" style={{ animationDelay: `${i * 0.12}s` }}>
          <div className="row"><span className="sk sk-av" /><span className="sk sk-line" style={{ width: '40%' }} /></div>
          <span className="sk sk-line" /><span className="sk sk-line" style={{ width: '85%' }} /><span className="sk sk-line" style={{ width: '60%' }} />
        </div>
      ))}
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  const text = /failed to fetch|network/i.test(error) ? 'Could not connect. Check your internet connection and try again.' : error;
  return <p className="err" role="alert">{text}</p>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card empty">
      <b>{title}</b>
      {children}
    </div>
  );
}

export function MediaView({ path, kind, label }: { path: string; kind: MediaKind; label?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    mediaUrl(path).then((u) => {
      if (!live) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => { live = false; };
  }, [path]);
  if (failed) return <div className="photo">This file is not available.</div>;
  if (!url) return <div className="photo">Loading {kind}…</div>;
  if (kind === 'photo') return <img className="media" src={url} alt={label || 'Photo shared with this piece'} loading="lazy" />;
  if (kind === 'audio') return <audio className="media-audio" controls preload="none" src={url} />;
  if (kind === 'video') return <video className="media" controls preload="metadata" src={url} />;
  return (
    <a className="doc" href={url} target="_blank" rel="noopener noreferrer">
      <span className="ic">PDF</span>
      <span>Open document</span>
    </a>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 19 }}>{title}</h2>
          <button className="btn ghost sm" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
