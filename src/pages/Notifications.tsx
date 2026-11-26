import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Empty, ErrorNote, Spinner } from '../components/ui';
import { currentSubscription, pushSupported } from '../lib/push';
import { cachedProfile, clearNotifications, getNotifications, markNotificationsRead } from '../lib/data';
import { nameOf, timeAgo } from '../lib/format';
import { useT } from '../lib/i18n';
import type { Notification } from '../lib/types';

const ICON: Record<string, string> = {
  follow: '👤', comment: '💬', reply: '↩️', like: '❤️', evidence: '🔎', review_requested: '🟡',
  review_decided: '🧾', appeal_decided: '⚖️', report_decided: '🛡️', content_restricted: '⚠️',
};

function line(n: Notification, actor: string, t: (k: string) => string) {
  switch (n.kind) {
    case 'follow': return <><b>{actor}</b> {t('notif.follow')}</>;
    case 'comment': return <><b>{actor}</b> {t('notif.comment')}</>;
    case 'reply': return <><b>{actor}</b> {t('notif.reply')}</>;
    case 'like': return <><b>{actor}</b> {t('notif.like')}</>;
    case 'evidence': return <><b>{actor}</b> {t('notif.evidence')}</>;
    case 'review_requested': return <>{t('notif.review_requested')}</>;
    case 'review_decided': return <>{t('notif.review_decided')}</>;
    case 'appeal_decided': return <>{t('notif.appeal_decided')}</>;
    case 'report_decided': return <>{t('notif.report_decided')}</>;
    case 'content_restricted': return <><b>{t('notif.content_restricted')}</b></>;
    default: return <>{n.kind}</>;
  }
}

function PushNudge() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!pushSupported() || Notification.permission === 'denied') return;
    currentSubscription().then((s) => setShow(!s)).catch(() => {});
  }, []);
  if (!show) return null;
  return (
    <div className="card push-nudge">
      <span>Get these on your phone, even when Verum Agora is closed.</span>
      <Link className="btn sm" to="/settings#push">Turn on</Link>
    </div>
  );
}

export default function Notifications() {
  const t = useT();
  const [list, setList] = useState<Notification[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    getNotifications().then((n) => { setList(n); markNotificationsRead(); window.dispatchEvent(new Event('va-notifications-read')); }).catch((e) => setErr(e.message));
  }, []);
  return (
    <div className="col">
      <div className="pagehead">
        <h1 className="h1">{t('nav.notifications')}</h1>
        {list && list.length > 0 && <button className="btn ghost sm" onClick={async () => { await clearNotifications(); setList([]); }}>{t('notif.clear')}</button>}
      </div>
      <PushNudge />
      <ErrorNote error={err} />
      {!list && !err && <Spinner />}
      {list?.length === 0 && <Empty title={t('notif.empty')}><p className="sub">{t('notif.empty_help')}</p></Empty>}
      {list && list.length > 0 && (
        <div className="card notif-list">
          {list.map((n) => {
            const a = cachedProfile(n.actor_id);
            const to = n.target_type === 'post' ? `/post/${n.target_id}` : n.target_type === 'story' ? `/story/${n.target_id}` : a?.username ? `/u/${a.username}` : '#';
            return (
              <Link key={n.id} to={to} className={'notif' + (n.read_at ? '' : ' unread')}>
                {a ? <Avatar name={nameOf(a)} role={a.role} size={38} src={a.avatar_url} /> : <span className="notif-ic" aria-hidden="true">{ICON[n.kind] ?? '•'}</span>}
                <span className="l">
                  <span>{line(n, nameOf(a), t)}</span>
                  {n.text && <span className="x">{n.text}</span>}
                  <span className="note">{timeAgo(n.created_at)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
