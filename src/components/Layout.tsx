import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getProfiles, myConversations, unreadNotifications } from '../lib/data';
import { useT } from '../lib/i18n';
import { chime, showBrowserNotification } from '../lib/notify';
import { refreshPushOwner } from '../lib/push';
import type { Message, Notification } from '../lib/types';
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
  const t = useT();
  const [unread, setUnread] = useState(0);
  const [notifs, setNotifs] = useState(0);
  const [toast, setToast] = useState<{ conv: string; who: string; text: string; src?: string | null; role?: string } | null>(null);
  const path = useRef(loc.pathname);
  path.current = loc.pathname;

  // Unread count: refresh on every page change.
  useEffect(() => {
    if (!me) { setUnread(0); return; }
    myConversations().then((c) => setUnread(c.reduce((n, x) => n + x.unread, 0))).catch(() => {});
  }, [me, loc.pathname]);

  // Unread notifications: refresh on page change, when the list is opened, and live on insert.
  useEffect(() => {
    if (!me) { setNotifs(0); return; }
    const load = () => unreadNotifications().then(setNotifs).catch(() => {});
    load();
    const onRead = () => setNotifs(0);
    window.addEventListener('va-notifications-read', onRead);
    const ch = supabase.channel('notifs-' + me.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me.id}` }, (payload) => {
      const n = payload.new as Notification;
      if (path.current === '/notifications') return;
      setNotifs((x) => x + 1);
      if (n.kind === 'content_restricted' || n.kind === 'review_requested') chime();
    }).subscribe();
    return () => { window.removeEventListener('va-notifications-read', onRead); supabase.removeChannel(ch); };
  }, [me, loc.pathname]);

  // Keep this device's push subscription attached to whoever is signed in.
  useEffect(() => { if (me?.id) refreshPushOwner(); }, [me?.id]);

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
    const n = unread + notifs;
    document.title = n > 0 ? `(${n}) Verum Agora` : 'Verum Agora';
  }, [unread, notifs]);

  const profilePath = me?.username ? `/u/${me.username}` : '/login';
  type Item = [string, string, () => JSX.Element];
  const items: Item[] = [
    ['/feed', 'nav.home', Icon.feed],
    ['/subjects', 'nav.subjects', Icon.grid],
    ['/messages', 'nav.messages', Icon.msg],
    [profilePath, me ? 'nav.profile' : 'nav.login', Icon.user],
  ];
  const extra: Item[] = [
    ...(me ? [['/notifications', 'nav.notifications', Icon.bell] as Item] : []),
    ['/connections', 'nav.connections', Icon.link],
    ['/search', 'nav.search', Icon.search],
    ['/peace-quilt', 'nav.quilt', Icon.star],
    ['/transparency', 'nav.transparency', Icon.shield],
    ...(me?.is_moderator ? [['/review', 'nav.review', Icon.flag] as Item] : []),
  ];

  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="side" aria-label="Main navigation">
        <Logo />
        <nav className="nav">
          {items.map(([to, label, ic]) => (
            <NavLink key={label} to={to} className={({ isActive }) => (isActive ? 'on' : '')}>
              {ic()}<span className="lbl">{t(label)}</span>
              {label === 'nav.messages' && unread > 0 && <span className="badge">{unread}</span>}
            </NavLink>
          ))}
          {extra.map(([to, label, ic]) => (
            <NavLink key={label} to={to} className={({ isActive }) => (isActive ? 'on' : '')}>
              {ic()}<span className="lbl">{t(label)}</span>
              {label === 'nav.notifications' && notifs > 0 && <span className="badge">{notifs > 99 ? '99+' : notifs}</span>}
            </NavLink>
          ))}
          {me && <NavLink to="/settings" className={({ isActive }) => (isActive ? 'on' : '')}>{Icon.settings()}<span className="lbl">{t('nav.settings')}</span></NavLink>}
        </nav>
        <Link className="btn add" to="/new">{t('nav.contribute')}</Link>
        <div className="foot">
          <Link to="/rules">{t('nav.rules')}</Link> · <Link to="/notice">{t('nav.notice')}</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> · <Link to="/imprint">Imprint</Link>
        </div>
      </aside>
      <main id="main">
        <div className="mtop">
          <Logo />
          {me && <Link to="/notifications" aria-label={t('nav.notifications')} className="mtop-search mtop-bell">{Icon.bell()}{notifs > 0 && <span className="dot" />}</Link>}
          <Link to="/search" aria-label={t('nav.search')} className="mtop-search">{Icon.search()}</Link>
          {me ? (
            <Link to={profilePath} aria-label="Your profile"><Avatar name={nameOf(me)} role={me.role} size={34} src={me.avatar_url} /></Link>
          ) : (
            <Link className="btn sm" to="/login">{t('nav.login')}</Link>
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
          <NavLink key={label} to={to} className={({ isActive }) => (isActive ? 'on' : '')}>{ic()}{t(label)}</NavLink>
        ))}
        <Link to="/new" className="plus" aria-label="Contribute"><span>{Icon.plus()}</span></Link>
        {[items[2], items[3]].map(([to, label, ic]) => (
          <NavLink key={label} to={to} className={({ isActive }) => (isActive ? 'on' : '')}>
            {ic()}{t(label)}{label === 'nav.messages' && unread > 0 && <span className="dot" aria-label={`${unread} unread`} />}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
