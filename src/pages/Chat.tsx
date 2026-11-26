import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ReportButton } from '../components/cards';
import { Avatar, ErrorNote, Icon, MediaView, RoleChip, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { cachedProfile, conversationOther, getMessages, markRead, sendMessage } from '../lib/data';
import { clock, nameOf } from '../lib/format';
import { kindOf, removeMedia, uploadMedia } from '../lib/media';
import { DEMO, supabase } from '../lib/supabase';
import type { Message } from '../lib/types';

const EMOJI = [
  '😀', '😂', '🙂', '😊', '😍', '🥰', '😉', '😎', '🤔', '😮', '😢', '😭', '😡', '🙏', '👍', '👎',
  '👏', '🙌', '💪', '🤝', '✌️', '❤️', '💚', '💛', '💙', '🔥', '✨', '🎉', '🕊️', '🌍', '🇪🇺', '📚',
  '📌', '✅', '❗', '❓', '👀', '💡', '☕', '🌱',
];

function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="emoji-pop" role="dialog" aria-label="Choose an emoji">
      {EMOJI.map((e) => <button key={e} type="button" onClick={() => onPick(e)} aria-label={`Insert ${e}`}>{e}</button>)}
    </div>
  );
}

export default function Chat() {
  const conv = useParams().id!;
  const { me } = useAuth();
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [other, setOther] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    const poll = DEMO ? setInterval(() => getMessages(conv).then((m) => live && setMsgs(m)), 2000) : undefined;
    return () => { live = false; clearInterval(poll); supabase.removeChannel(ch); };
  }, [conv, me]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  function insertEmoji(e: string) {
    const el = input.current;
    if (!el) { setText((t) => t + e); return; }
    const start = el.selectionStart ?? text.length;
    const stop = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + e + text.slice(stop);
    setText(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + e.length; });
  }

  function pick(f: File | null) {
    setErr(null);
    if (!f) return;
    if (!kindOf(f)) { setErr('You can send photos, audio, video or PDF files.'); return; }
    if (f.size > 50 * 1024 * 1024) { setErr('Files can be up to 50 MB.'); return; }
    setFile(f);
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && !file) || !me || sending) return;
    setSending(true); setErr(null);
    let up: { path: string; kind: string } | null = null;
    try {
      if (file) up = await uploadMedia(me.id, file);
      await sendMessage(me.id, conv, body, up ? { ...up, name: file!.name.slice(0, 200) } : null);
      setText(''); setFile(null); setEmojiOpen(false);
      if (fileRef.current) fileRef.current.value = '';
      setMsgs(await getMessages(conv));
    } catch (x) {
      if (up) await removeMedia(up.path);
      setErr((x as Error).message);
    }
    setSending(false);
    input.current?.focus();
  }

  const p = cachedProfile(other);
  return (
    <div className="col chat-page">
      <Link className="back" to="/messages">{Icon.back()}Messages</Link>
      {p && (
        <div className="row chat-head" style={{ justifyContent: 'space-between' }}>
          <Link className="who" to={p.username ? `/u/${p.username}` : '#'}>
            <Avatar name={nameOf(p)} role={p.role} src={p.avatar_url} />
            <div><div className="row"><span className="n">{nameOf(p)}</span><RoleChip role={p.role} /></div>{p.username && <div className="m">@{p.username}</div>}</div>
          </Link>
          <div className="acts tight"><ReportButton type="profile" id={p.id} label="Report this person" /></div>
        </div>
      )}
      {!msgs && !err && <Spinner />}
      <div className="chat" aria-live="polite">
        {msgs?.length === 0 && <p className="sub">Say hello. Other members cannot see this conversation. Messages are not end-to-end encrypted, so avoid sharing details that could put anyone at risk.</p>}
        {msgs?.map((m) => (
          <div key={m.id} className={'b ' + (m.sender_id === me?.id ? 'me' : 'them') + (m.attachment_path ? ' has-file' : '')}>
            {m.attachment_path && m.attachment_kind && (
              <div className="b-file">
                {m.attachment_kind === 'document'
                  ? <MediaView path={m.attachment_path} kind="document" label={m.attachment_name ?? 'Document'} />
                  : <MediaView path={m.attachment_path} kind={m.attachment_kind} label={m.attachment_name ?? 'Shared file'} />}
                {m.attachment_kind === 'document' && m.attachment_name && <span className="note">{m.attachment_name}</span>}
              </div>
            )}
            {m.body && <span>{m.body}</span>}
            <small>{clock(m.created_at)}</small>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="send composer-bar" onSubmit={send}>
        {emojiOpen && <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />}
        {file && (
          <div className="attach-chip">
            <span>📎 {file.name}</span>
            <button type="button" className="linkbtn" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>Remove</button>
          </div>
        )}
        <ErrorNote error={err} />
        <div className="send-row">
          <button type="button" className="icon-btn" aria-label="Add emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((o) => !o)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1.3 2 3.5 2 3.5-2 3.5-2" /><circle cx="9" cy="10" r=".8" fill="currentColor" /><circle cx="15" cy="10" r=".8" fill="currentColor" /></svg>
          </button>
          <button type="button" className="icon-btn" aria-label="Attach a file" onClick={() => fileRef.current?.click()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4l7.5-7.5" /></svg>
          </button>
          <input ref={fileRef} type="file" hidden accept="image/*,audio/*,video/*,application/pdf" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          <label htmlFor="mi" className="sr">Message</label>
          <textarea id="mi" ref={input} rows={1} value={text} maxLength={2000} placeholder="Write a message"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="btn" type="submit" aria-label="Send" disabled={sending || (!text.trim() && !file)}>{sending ? '…' : Icon.send()}</button>
        </div>
        {file && (kindOf(file) === 'video' || kindOf(file) === 'document') && <p className="note">Videos and PDFs can contain hidden details such as location or author name. Photos are cleaned automatically.</p>}
      </form>
    </div>
  );
}
