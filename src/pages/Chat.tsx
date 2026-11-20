import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ReportButton } from '../components/cards';
import { Avatar, ErrorNote, Icon, RoleChip, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { cachedProfile, conversationOther, getMessages, markRead, sendMessage } from '../lib/data';
import { clock, nameOf } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { Message } from '../lib/types';

export default function Chat() {
  const conv = useParams().id!;
  const { me } = useAuth();
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [other, setOther] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!me) return;
    let live = true;
    Promise.all([getMessages(conv), conversationOther(conv, me.id)])
      .then(([m, o]) => { if (!live) return; setMsgs(m); setOther(o); markRead(conv); })
      .catch((e) => setErr(e.message));
    const ch = supabase
      .channel('chat-' + conv)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv}` }, (payload) => {
        const m = payload.new as Message;
        setMsgs((list) => (list && !list.some((x) => x.id === m.id) ? [...list, m] : list));
        markRead(conv);
      })
      .subscribe();
    return () => { live = false; supabase.removeChannel(ch); };
  }, [conv, me]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !me) return;
    setText('');
    try {
      await sendMessage(me.id, conv, body);
      const m = await getMessages(conv);
      setMsgs(m);
    } catch (x) { setErr((x as Error).message); setText(body); }
  }

  const p = cachedProfile(other);
  return (
    <div className="col">
      <Link className="back" to="/messages">{Icon.back()}Messages</Link>
      {p && (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Link className="who" to={p.username ? `/u/${p.username}` : '#'}>
            <Avatar name={nameOf(p)} role={p.role} />
            <div><div className="row"><span className="n">{nameOf(p)}</span><RoleChip role={p.role} /></div>{p.username && <div className="m">@{p.username}</div>}</div>
          </Link>
          <div className="acts tight"><ReportButton type="profile" id={p.id} label="Report this person" /></div>
        </div>
      )}
      <ErrorNote error={err} />
      {!msgs && !err && <Spinner />}
      <div className="chat" aria-live="polite">
        {msgs?.length === 0 && <p className="sub">Say hello. Other members cannot see this conversation. Messages are not end-to-end encrypted, so avoid sharing details that could put anyone at risk.</p>}
        {msgs?.map((m) => (
          <div key={m.id} className={'b ' + (m.sender_id === me?.id ? 'me' : 'them')}>
            {m.body}<small>{clock(m.created_at)}</small>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="send" onSubmit={send}>
        <label htmlFor="mi" className="sr">Message</label>
        <input id="mi" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Write a message" autoComplete="off" />
        <button className="btn" type="submit" aria-label="Send" disabled={!text.trim()}>{Icon.send()}</button>
      </form>
    </div>
  );
}
