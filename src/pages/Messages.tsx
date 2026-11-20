import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Empty, ErrorNote, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { cachedProfile, myConversations } from '../lib/data';
import { nameOf, timeAgo } from '../lib/format';
import type { Conversation } from '../lib/types';

export default function Messages() {
  const { me } = useAuth();
  const [list, setList] = useState<Conversation[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { myConversations().then(setList).catch((e) => setErr(e.message)); }, []);
  return (
    <div className="col">
      <h1 className="h1">Messages</h1>
      <ErrorNote error={err} />
      {!list && !err && <Spinner />}
      {list && list.length === 0 && (
        <Empty title="No conversations yet"><p className="sub">Open someone's profile and tap Message to start one.</p></Empty>
      )}
      {list && list.length > 0 && (
        <div className="card inbox">
          {list.map((c) => {
            const p = cachedProfile(c.other_id);
            return (
              <Link key={c.conversation_id} to={`/messages/${c.conversation_id}`} className={c.unread ? 'u' : ''}>
                <Avatar name={nameOf(p)} role={p?.role} />
                <span className="l">
                  <span className="t"><span className="n">{nameOf(p)}</span><span className="note">{c.last_at ? timeAgo(c.last_at) : ''}</span></span>
                  <span className="x">{c.last_sender === me?.id ? 'You: ' : ''}{c.last_body ?? 'No messages yet'}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
