import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorNote } from '../components/ui';
import { useAuth } from '../lib/auth';
import { CONSENT_LABEL, STORY_ROLES } from '../lib/constants';
import { createPost, createStory, getRegions, getThemes } from '../lib/data';
import { kindOf, removeMedia, uploadMedia } from '../lib/media';
import type { Region, Theme } from '../lib/types';

type Kind = 'story' | 'post' | 'article';

export default function Compose() {
  const { me } = useAuth();
  const nav = useNavigate();
  const [kind, setKind] = useState<Kind>('story');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [role, setRole] = useState<string>(STORY_ROLES.includes(me?.role as never) ? me!.role : 'Mediator');
  const [theme, setTheme] = useState(1);
  const [region, setRegion] = useState(1);
  const [consent, setConsent] = useState('public');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { Promise.all([getThemes(), getRegions()]).then(([t, r]) => { setThemes(t); setRegions(r); }); }, []);

  const accept = kind === 'story' ? 'image/*,audio/*' : 'image/*,video/*,audio/*,application/pdf';
  function pick(f: File | null) {
    setErr(null);
    if (!f) { setFile(null); return; }
    const k = kindOf(f);
    if (!k) { setErr('This file type is not supported.'); return; }
    if (kind === 'story' && !(k === 'photo' || k === 'audio')) { setErr('Stories can include a photo or a voice recording.'); return; }
    if (f.size > 50 * 1024 * 1024) { setErr('Files can be up to 50 MB.'); return; }
    setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setBusy(true); setErr(null);
    let media: { path: string; kind: string } | null = null;
    try {
      if (file) media = await uploadMedia(me.id, file);
      if (kind === 'story') {
        const id = await createStory({
          author_id: me.id, title: title.trim(), body: body.trim(), role, theme_id: theme, region_id: region, consent,
          media_path: media?.path ?? null, media_kind: media?.kind ?? null,
        });
        nav(`/story/${id}`);
      } else {
        const id = await createPost({
          author_id: me.id, kind, title: kind === 'article' ? title.trim() : null, body: body.trim(),
          media_path: media?.path ?? null, media_kind: media?.kind ?? null,
        });
        nav(`/post/${id}`);
      }
    } catch (x) {
      if (media) await removeMedia(media.path);
      setErr((x as Error).message.includes('check') ? 'Please check the length of your title and text.' : (x as Error).message);
      setBusy(false);
    }
  }

  const maxBody = kind === 'story' ? 2000 : kind === 'post' ? 1000 : 20000;

  return (
    <div className="col">
      <div className="pagehead">
        <h1 className="h1">Add your piece</h1>
        <div className="tabs" role="tablist">
          {(['story', 'post', 'article'] as Kind[]).map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} className={'tab' + (kind === k ? ' on' : '')} onClick={() => { setKind(k); setFile(null); }}>
              {k === 'story' ? 'Story' : k === 'post' ? 'Post' : 'Article'}
            </button>
          ))}
        </div>
      </div>
      <p className="sub">
        {kind === 'story' && 'A short, true story about peace from your own life. It becomes a piece in the quilt and connects to others.'}
        {kind === 'post' && 'A short update for the people who follow you.'}
        {kind === 'article' && 'A longer piece of writing, like research, analysis or a reflection.'}
      </p>
      <form className="cmp card" onSubmit={submit}>
        {kind !== 'post' && (
          <label htmlFor="t">Title<input id="t" required minLength={3} maxLength={kind === 'story' ? 90 : 140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'story' ? 'e.g. Tea on both ends of the bridge' : 'e.g. What 40 local truces have in common'} /></label>
        )}
        <label htmlFor="b">{kind === 'story' ? 'Your story' : kind === 'post' ? 'Your post' : 'Your article'}
          <textarea id="b" required minLength={kind === 'story' ? 10 : 1} maxLength={maxBody} value={body} onChange={(e) => setBody(e.target.value)} className={kind === 'article' ? 'tall' : ''}
            placeholder={kind === 'story' ? 'What happened? Who made peace possible? Two or three sentences are enough.' : kind === 'article' ? 'Separate paragraphs with an empty line.' : 'What do you want to share?'} />
          <span className="note right">{body.length} / {maxBody}</span>
        </label>
        {kind === 'story' && (
          <div className="two">
            <label htmlFor="r">Your role in this story<select id="r" value={role} onChange={(e) => setRole(e.target.value)}>{STORY_ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label htmlFor="th">Theme<select id="th" value={theme} onChange={(e) => setTheme(Number(e.target.value))}>{themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label htmlFor="rg">Region<select id="rg" value={region} onChange={(e) => setRegion(Number(e.target.value))}>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
            <label htmlFor="c">Who can see it<select id="c" value={consent} onChange={(e) => setConsent(e.target.value)}>{Object.entries(CONSENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>
        )}
        <label htmlFor="f">{kind === 'story' ? 'Photo or voice recording (optional)' : 'Photo, video, audio or PDF (optional)'}
          <input id="f" type="file" accept={accept} onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        </label>
        {file && <p className="note">Attached: {file.name}</p>}
        {kind === 'story' ? (
          <div className="safe">
            <b>Your safety</b>
            <span>Photos are re-drawn on your device before upload, which removes GPS location and camera details. Regions are deliberately broad, so avoid naming streets, villages or people who could be put at risk. You can change who sees your piece, or withdraw it, at any time.</span>
          </div>
        ) : file && (kindOf(file) === 'video' || kindOf(file) === 'document') ? (
          <div className="safe warn">
            <b>Check this file</b>
            <span>Videos and PDFs can contain hidden details such as location or author name. Only upload them if they are safe to share publicly.</span>
          </div>
        ) : null}
        <ErrorNote error={err} />
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : kind === 'story' ? 'Sew it into the quilt' : 'Publish'}</button>
      </form>
    </div>
  );
}
