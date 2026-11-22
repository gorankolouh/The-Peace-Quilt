import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { myConversations } from '../lib/data';
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
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!me) { setUnread(0); return; }
    let live = true;
    const load = () => myConversations().then((c) => live && setUnread(c.reduce((n, x) => n + x.unread, 0))).catch(() => {});
    load();
    const ch = supabase.channel('unread').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, load).subscribe();
    return () => { live = false; supabase.removeChannel(ch); };
  }, [me, loc.pathname]);

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
            <Link to={profilePath} aria-label="Your profile"><Avatar name={nameOf(me)} role={me.role} size={34} /></Link>
          ) : (
            <Link className="btn sm" to="/login">Log in</Link>
          )}
        </div>
        <Outlet />
      </main>
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
