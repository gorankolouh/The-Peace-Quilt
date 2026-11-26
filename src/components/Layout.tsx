import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getProfiles, myConversations } from '../lib/data';
import { chime, showBrowserNotification } from '../lib/notify';
import type { Message } from '../lib/types';
import { RightRail } from './RightRail';
import { nameOf } from '../lib/format';
import { supabase } from '../lib/supabase';
import { Avatar, Icon } from './ui';

export function Logo() {
  return (
    <Link className="logo" to="/">
      <span className="orb" aria-hidden="true" />
      <b>Verum Agora</b>
    </Link>
  );
}

export function Layout() {
  const { me } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<{ conv: string; who: string; text: string; src?: string | null; role?: string } | null>(null);
  const path = useRef(loc.pathname);
  path.current = loc.pathname;

  // Unread count: refresh on every page change.
  useEffect(() => {
    if (!me) { setUnread(0); return; }
    myConversations().then((c) => setUnread(c.reduce((n, x) => n + x.unread, 0))).catch(() => {});
  }, [me, loc.pathname]);

  // Live notifications for new messages.
  useEffect(() => {
    if (!me) return;
    const ch = supabase.channel('notify-' + me.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
      const m = payload.new as Message;
      if (m.sender_id === me.id) return;
      const open = path.current === `/messages/${m.conversation_id}`;
      myConversations().then((c) => setUnread(c.reduce((n, x) => n + x.unread, 0))).catch(() => {});
      if (open && !document.hidden) return;
      const who = (await getProfiles([m.sender_id])).get(m.sender_id);
      const name = who ? nameOf(who) : 'New message';
      const text = m.body || (m.attachment_kind === 'photo' ? '📷 Photo' : '📎 File');
      chime();
      setToast({ conv: m.conversation_id, who: name, text, src: who?.avatar_url, role: who?.role });
      showBrowserNotification(name, text, () => nav(`/messages/${m.conversation_id}`));
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, nav]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Verum Agora` : 'Verum Agora';
  }, [unread]);

  const profilePath = me?.username ? `/u/${me.username}` : '/login';
  const items: [string, string, () => JSX.Element][] = [
    ['/feed', 'Home', Icon.feed],
    ['/subjects', 'Subjects', Icon.grid],
    ['/messages', 'Messages', Icon.msg],
    [profilePath, me ? 'Profile' : 'Log in', Icon.user],
  ];
  const extra: [string, string, () => JSX.Element][] = [
    ['/search', 'Search', Icon.search],
    ['/peace-quilt', 'Peace Quilt', Icon.star],
    ['/transparency', 'Transparency', Icon.shield],
    ...(me?.is_moderator ? [['/review', 'Review desk', Icon.flag] as [string, string, () => JSX.Element]] : []),
  ];

  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="side" aria-label="Main navigation">
        <Logo />
        <nav className="nav">
          {items.map(([to, label, ic]) => (
            <NavLink key={label} to={to} className={({ isActive }) => (isActive ? 'on' : '')}>
              {ic()}{label}
              {label === 'Messages' && unread > 0 && <span className="badge">{unread}</span>}
            </NavLink>
          ))}
          {extra.map(([to, label, ic]) => (
            <NavLink key={label} to={to} className={({ isActive }) => (isActive ? 'on' : '')}>{ic()}{label}</NavLink>
          ))}
          {me && <NavLink to="/settings" className={({ isActive }) => (isActive ? 'on' : '')}>{Icon.settings()}Settings</NavLink>}
        </nav>
        <Link className="btn add" to="/new">Contribute</Link>
        <div className="foot">
          <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> · <Link to="/imprint">Imprint</Link>
        </div>
      </aside>
      <main id="main">
        <div className="mtop">
          <Logo />
          <Link to="/search" aria-label="Search" className="mtop-search">{Icon.search()}</Link>
          {me ? (
            <Link to={profilePath} aria-label="Your profile"><Avatar name={nameOf(me)} role={me.role} size={34} src={me.avatar_url} /></Link>
          ) : (
            <Link className="btn sm" to="/login">Log in</Link>
          )}
        </div>
        <div className="page" key={loc.pathname}><Outlet /></div>
      </main>
      <RightRail />
      {toast && (
        <button className="msg-toast" onClick={() => { nav(`/messages/${toast.conv}`); setToast(null); }} aria-live="polite">
          <Avatar name={toast.who} role={toast.role} size={38} src={toast.src} />
          <span className="t"><b>{toast.who}</b><span>{toast.text.length > 80 ? toast.text.slice(0, 80) + '…' : toast.text}</span></span>
        </button>
      )}
      <nav className="bottom" aria-label="Main navigation">
        {[items[0], items[1]].map(([to, label, ic]) => (
          <NavLink key={label} to={to} className={({ isActive }) => (isActive ? 'on' : '')}>{ic()}{label}</NavLink>
        ))}
        <Link to="/new" className="plus" aria-label="Contribute"><span>{Icon.plus()}</span></Link>
        {[items[2], items[3]].map(([to, label, ic]) => (
          <NavLink key={label} to={to} className={({ isActive }) => (isActive ? 'on' : '')}>
            {ic()}{label}{label === 'Messages' && unread > 0 && <span className="dot" aria-label={`${unread} unread`} />}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
