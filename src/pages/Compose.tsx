import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorNote, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { CONSENT_LABEL, COUNTRIES, LANGUAGES, POST_KINDS, STORY_ROLES } from '../lib/constants';
import { createPost, createStory, getPost, getRegions, getThemes, updatePost } from '../lib/data';
import { kindOf, removeMedia, uploadMedia } from '../lib/media';
import type { PostKind, Region, Source, Theme } from '../lib/types';
import { SUBJECT_COLORS, useSubjects } from '../lib/useSubjects';

type Kind = PostKind | 'story';
const MAX: Record<Kind, number> = { post: 3000, question: 3000, article: 20000, research: 20000, story: 2000 };
const HELP: Record<Kind, string> = {
  post: 'A short contribution: information, an observation or a link with context.',
  question: 'Ask something the community can help answer with knowledge or sources.',
  article: 'A longer piece of writing: reporting, explanation or opinion.',
  research: 'Analysis built on data or documents. Link your sources so others can check them.',
  story: 'A short, true peace story from your own life. It becomes a piece of the Peace Quilt.',
};

function cleanTag(t: string) {
  return t.toLowerCase().replace(/^#/, '').replace(/[^\p{L}\p{N} \-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

export default function Compose() {
  const editId = useParams().id ? Number(useParams().id) : null;
  const { me } = useAuth();
  const nav = useNavigate();
  const subjects = useSubjects();
  const [loaded, setLoaded] = useState(!editId);
  const [kind, setKind] = useState<Kind>('post');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [subj, setSubj] = useState<number[]>([]);
  const [topics, setTopics] = useState<number[]>([]);
  const [tagText, setTagText] = useState('');
  const [language, setLanguage] = useState('en');
  const [country, setCountry] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [file, setFile] = useState<File | null>(null);
  // Peace story fields
  const [themes, setThemes] = useState<Theme[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [role, setRole] = useState<string>(STORY_ROLES.includes(me?.role as never) ? me!.role : 'Mediator');
  const [theme, setTheme] = useState(1);
  const [region, setRegion] = useState(1);
  const [consent, setConsent] = useState('public');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { Promise.all([getThemes(), getRegions()]).then(([t, r]) => { setThemes(t); setRegions(r); }).catch(() => {}); }, []);
  useEffect(() => {
    if (!editId) return;
    getPost(editId).then((p) => {
      if (!p || !p.is_mine) { setErr('You can only edit your own contributions.'); setLoaded(true); return; }
      setKind(p.kind); setTitle(p.title ?? ''); setBody(p.body); setSubj(p.subject_ids || []); setTopics(p.subtopic_ids || []);
      setTagText((p.tags || []).join(', ')); setLanguage(p.language || 'en'); setCountry(p.country ?? ''); setSources(p.sources || []);
      setLoaded(true);
    }).catch((e) => { setErr(e.message); setLoaded(true); });
  }, [editId]);

  const isStory = kind === 'story';
  const needsTitle = kind === 'article' || kind === 'research' || isStory;
  const accept = isStory ? 'image/*,audio/*' : 'image/*,video/*,audio/*,application/pdf';
  const tags = [...new Set(tagText.split(',').map(cleanTag).filter((t) => t.length >= 2))].slice(0, 8);

  function toggleSubject(id: number) {
    setSubj((s) => {
      if (s.includes(id)) {
        const subject = subjects.find((x) => x.id === id);
        setTopics((t) => t.filter((tid) => !subject?.subtopics.some((st) => st.id === tid)));
        return s.filter((x) => x !== id);
      }
      return s.length >= 4 ? s : [...s, id];
    });
  }

  function pick(f: File | null) {
    setErr(null);
    if (!f) { setFile(null); return; }
    const k = kindOf(f);
    if (!k) { setErr('This file type is not supported.'); return; }
    if (isStory && !(k === 'photo' || k === 'audio')) { setErr('Peace stories can include a photo or a voice recording.'); return; }
    if (f.size > 50 * 1024 * 1024) { setErr('Files can be up to 50 MB.'); return; }
    setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    if (!isStory && subj.length === 0) { setErr('Choose at least one subject.'); return; }
    const cleanSources = sources.filter((s) => s.url.trim()).map((s) => ({ url: s.url.trim(), title: s.title?.trim() || undefined }));
    if (cleanSources.some((s) => !/^https?:\/\//i.test(s.url))) { setErr('Source links must start with http:// or https://'); return; }
    setBusy(true); setErr(null);
    let media: { path: string; kind: string } | null = null;
    try {
      if (editId) {
        await updatePost(editId, { title: needsTitle || title.trim() ? title.trim() || null : null, body: body.trim(), language, country: country || null, sources: cleanSources, subjects: subj, subtopics: topics, tags });
        nav(`/post/${editId}`);
        return;
      }
      if (file) media = await uploadMedia(me.id, file);
      if (isStory) {
        const id = await createStory({ author_id: me.id, title: title.trim(), body: body.trim(), role, theme_id: theme, region_id: region, consent, media_path: media?.path ?? null, media_kind: media?.kind ?? null });
        nav(`/story/${id}`);
      } else {
        const id = await createPost(me.id, {
          kind, title: title.trim() || null, body: body.trim(), language, country: country || null, sources: cleanSources,
          media_path: media?.path ?? null, media_kind: media?.kind ?? null, subjects: subj, subtopics: topics, tags,
        });
        nav(`/post/${id}`);
      }
    } catch (x) {
      if (media) await removeMedia(media.path);
      const m = (x as Error).message;
      setErr(m.includes('check') ? 'Please check the length of your title and text.' : m);
      setBusy(false);
    }
  }

  if (!loaded) return <div className="col"><Spinner /></div>;

  return (
    <div className="col">
      <div className="pagehead">
        <h1 className="h1">{editId ? 'Edit contribution' : 'Contribute'}</h1>
        {!editId && (
          <div className="tabs" role="tablist">
            {(['post', 'question', 'article', 'research', 'story'] as Kind[]).map((k) => (
              <button key={k} role="tab" aria-selected={kind === k} className={'tab' + (kind === k ? ' on' : '')} onClick={() => { setKind(k); setFile(null); }}>
                {k === 'story' ? 'Peace story' : POST_KINDS[k]}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="sub">{HELP[kind]}</p>
      <form className="cmp card" onSubmit={submit}>
        {(needsTitle || kind === 'question' || kind === 'post') && (
          <label htmlFor="t">{needsTitle ? 'Title' : kind === 'question' ? 'Your question' : 'Title (optional)'}
            <input id="t" required={needsTitle || kind === 'question'} minLength={3} maxLength={isStory ? 90 : 140} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === 'question' ? 'e.g. How is public school funding decided in the Netherlands?' : kind === 'research' ? 'e.g. Teacher shortages in 12 EU countries, 2020–2026' : ''} />
          </label>
        )}
        <label htmlFor="b">{kind === 'question' ? 'Details' : isStory ? 'Your story' : 'Text'}
          <textarea id="b" required minLength={isStory ? 10 : 1} maxLength={MAX[kind]} value={body} onChange={(e) => setBody(e.target.value)} className={kind === 'article' || kind === 'research' ? 'tall' : ''}
            placeholder={kind === 'article' || kind === 'research' ? 'Separate paragraphs with an empty line.' : ''} />
          <span className="note right">{body.length} / {MAX[kind]}</span>
        </label>

        {!isStory && (
          <>
            <fieldset className="radios">
              <legend>Subjects (choose 1 to 4)</legend>
              <div className="row subj-row">
                {subjects.map((s) => {
                  const on = subj.includes(s.id);
                  const c = SUBJECT_COLORS[s.id];
                  return (
                    <button type="button" key={s.id} aria-pressed={on} className={'rc' + (on ? ' on' : '')} onClick={() => toggleSubject(s.id)}
                      style={on ? { borderColor: c, background: c + '22' } : undefined}>
                      <i style={{ background: c }} />{s.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {subj.length > 0 && (
              <fieldset className="radios">
                <legend>Subtopics (optional)</legend>
                <div className="row subj-row">
                  {subjects.filter((s) => subj.includes(s.id)).flatMap((s) => s.subtopics).map((t) => {
                    const on = topics.includes(t.id);
                    return <button type="button" key={t.id} aria-pressed={on} className={'rc' + (on ? ' on' : '')} onClick={() => setTopics((x) => (on ? x.filter((y) => y !== t.id) : [...x, t.id]))}>{t.name}</button>;
                  })}
                </div>
              </fieldset>
            )}
            <label htmlFor="tg">Topics and events (optional, comma separated)
              <input id="tg" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="e.g. school funding, teacher shortage, berlin strike 2026" />
              <span className="note">Shared topics connect your contribution to related discussions.{tags.length > 0 && ` Will be saved as: ${tags.map((t) => '#' + t).join(' ')}`}</span>
            </label>
            <div className="two">
              <label htmlFor="lg">Language<select id="lg" value={language} onChange={(e) => setLanguage(e.target.value)}>{LANGUAGES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
              <label htmlFor="ct">Country or region it concerns (optional)<select id="ct" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">Not specific</option>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select></label>
            </div>
            <fieldset className="radios">
              <legend>Sources and references (optional)</legend>
              {sources.map((s, i) => (
                <div key={i} className="source-row">
                  <label className="sr" htmlFor={`su${i}`}>Source link</label>
                  <input id={`su${i}`} type="url" placeholder="https://" value={s.url} onChange={(e) => setSources((x) => x.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))} />
                  <label className="sr" htmlFor={`st${i}`}>Source title</label>
                  <input id={`st${i}`} placeholder="Title (optional)" maxLength={140} value={s.title ?? ''} onChange={(e) => setSources((x) => x.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} />
                  <button type="button" className="btn ghost sm" onClick={() => setSources((x) => x.filter((_, j) => j !== i))}>Remove</button>
                </div>
              ))}
              {sources.length < 10 && <button type="button" className="btn ghost sm" onClick={() => setSources((x) => [...x, { url: '', title: '' }])}>Add a source</button>}
            </fieldset>
          </>
        )}

        {isStory && (
          <div className="two">
            <label htmlFor="r">Your role in this story<select id="r" value={role} onChange={(e) => setRole(e.target.value)}>{STORY_ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label htmlFor="th">Theme<select id="th" value={theme} onChange={(e) => setTheme(Number(e.target.value))}>{themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label htmlFor="rg">Region<select id="rg" value={region} onChange={(e) => setRegion(Number(e.target.value))}>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
            <label htmlFor="c">Who can see it<select id="c" value={consent} onChange={(e) => setConsent(e.target.value)}>{Object.entries(CONSENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>
        )}

        {!editId && (
          <label htmlFor="f">{isStory ? 'Photo or voice recording (optional)' : 'Photo, video, audio or PDF (optional)'}
            <input id="f" type="file" accept={accept} onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          </label>
        )}
        {file && <p className="note">Attached: {file.name}</p>}
        {isStory ? (
          <div className="safe"><b>Your safety</b><span>Photos are re-drawn on your device before upload, which removes GPS location and camera details. Avoid naming streets, villages or people who could be put at risk.</span></div>
        ) : file && (kindOf(file) === 'video' || kindOf(file) === 'document') ? (
          <div className="safe warn"><b>Check this file</b><span>Videos and PDFs can contain hidden details such as location or author name. Only upload them if they are safe to share publicly.</span></div>
        ) : null}
        <ErrorNote error={err} />
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : editId ? 'Save changes' : isStory ? 'Sew it into the quilt' : 'Publish'}</button>
      </form>
    </div>
  );
}
