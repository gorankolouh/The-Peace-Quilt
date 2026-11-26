import { useEffect, useState } from 'react';
import { InterestsPicker } from '../components/InterestsPicker';
import { askBrowserNotify, browserNotifyState, chime, setSound, soundOn } from '../lib/notify';
import { removeAvatar, uploadAvatar } from '../lib/media';
import { Avatar } from '../components/ui';
import { nameOf } from '../lib/format';
import { useNavigate } from 'react-router-dom';
import { ErrorNote } from '../components/ui';
import { useAuth } from '../lib/auth';
import { PROFILE_ROLES } from '../lib/constants';
import { deleteMyAccount, exportMyData, getInterests, setInterests, updateMyProfile } from '../lib/data';
import { supabase } from '../lib/supabase';
import { LANGS, useI18n, useT as useT2 } from '../lib/i18n';

export default function Settings() {
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState(me?.display_name ?? '');
  const [role, setRole] = useState(me?.role ?? 'Member');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const [interests, setInt] = useState<number[]>([]);
  const [intSaved, setIntSaved] = useState(false);
  const [notif, setNotif] = useState(browserNotifyState());
  const [sound, setSoundState] = useState(soundOn());
  const [photoBusy, setPhotoBusy] = useState(false);
  useEffect(() => { if (me) getInterests(me.id).then(setInt).catch(() => {}); }, [me]);
  if (!me) return null;
  async function saveInterests() {
    try { await setInterests(me!.id, interests); setIntSaved(true); setTimeout(() => setIntSaved(false), 2000); } catch (x) { setErr((x as Error).message); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try { await updateMyProfile(me!.id, { display_name: name.trim(), role, bio: bio.trim() }); await refresh(); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (x) { setErr((x as Error).message); }
  }
  async function doExport() {
    try {
      const data = await exportMyData(me!.id);
      setExportUrl(URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })));
    } catch (x) { setErr((x as Error).message); }
  }
  async function doDelete() {
    try { await deleteMyAccount(me!.id); nav('/'); } catch (x) { setErr((x as Error).message); }
  }

  return (
    <div className="col">
      <h1 className="h1">Settings</h1>
      <form className="cmp card" onSubmit={save}>
        <h2 className="h2" style={{ margin: 0 }}>Profile</h2>
        <label htmlFor="dn">Display name<input id="dn" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label htmlFor="rl">How do you take part?<select id="rl" value={role} onChange={(e) => setRole(e.target.value)}>{PROFILE_ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label htmlFor="bi">Bio<textarea id="bi" maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} /></label>
        <div className="row"><button className="btn">Save</button>{saved && <span className="ok">Saved</span>}</div>
      </form>

      <section className="card">
        <h2 className="h2" style={{ margin: 0 }}>Profile photo</h2>
        <div className="row">
          <Avatar name={nameOf(me)} role={me.role} size={64} src={me.avatar_url} />
          <label className="btn ghost sm file-btn">{photoBusy ? 'Uploading…' : me.avatar_url ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={photoBusy} onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              setPhotoBusy(true);
              try { await uploadAvatar(me.id, f, me.avatar_url ?? null); await refresh(); } catch (x) { setErr((x as Error).message); }
              setPhotoBusy(false); e.target.value = '';
            }} />
          </label>
          {me.avatar_url && <button className="linkbtn" onClick={async () => { try { await removeAvatar(me.id, me.avatar_url!); await refresh(); } catch (x) { setErr((x as Error).message); } }}>Remove</button>}
        </div>
        <p className="note">Your photo is cropped to a square and re-saved on your device, which removes location and camera details. Profile photos are public.</p>
      </section>

      <LanguageCard />

      <PrivacyCard />

      <section className="card">
        <h2 className="h2" style={{ margin: 0 }}>Notifications</h2>
        <p className="sub">When a new message arrives, you see a pop-up and the unread count in the tab title.</p>
        <label className="check"><input type="checkbox" checked={sound} onChange={(e) => { setSound(e.target.checked); setSoundState(e.target.checked); if (e.target.checked) chime(); }} /><span>Play a soft sound for new messages</span></label>
        {notif === 'granted' && <p className="ok">Browser notifications are on. You get them while Verum Agora is open in another tab.</p>}
        {notif === 'default' && <button className="btn ghost sm" onClick={async () => setNotif(await askBrowserNotify())}>Turn on browser notifications</button>}
        {notif === 'denied' && <p className="note">Browser notifications are blocked. You can allow them in your browser's site settings.</p>}
        {notif === 'unsupported' && <p className="note">This browser does not support notifications.</p>}
        <p className="note">Follows, comments, replies, evidence and moderation decisions about your content appear under Notifications. Email and phone push notifications are planned for a later version.</p>
      </section>

      <section className="card" id="interests">
        <h2 className="h2" style={{ margin: 0 }}>My interests</h2>
        <p className="sub">Your home feed shows contributions from these subjects, from anyone.</p>
        <InterestsPicker value={interests} onChange={setInt} />
        <div className="row"><button className="btn" onClick={saveInterests}>Save interests</button>{intSaved && <span className="ok">Saved</span>}</div>
      </section>

      <section className="card">
        <h2 className="h2" style={{ margin: 0 }}>Your data</h2>
        <p className="sub">Download everything you have shared: profile, pieces, posts, comments, likes, follows and the messages you sent.</p>
        <div className="row">
          <button className="btn ghost" onClick={doExport}>Prepare my data</button>
          {exportUrl && <a className="btn" href={exportUrl} download="verum-agora-my-data.json">Download file</a>}
        </div>
      </section>

      <section className="card">
        <h2 className="h2" style={{ margin: 0 }}>Delete account</h2>
        <p className="sub">This permanently deletes your account, all your pieces, posts, comments, messages and uploaded files. It cannot be undone.</p>
        <label htmlFor="del">Type DELETE to confirm<input id="del" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></label>
        <button className="btn danger" disabled={confirm !== 'DELETE'} onClick={doDelete}>Delete my account</button>
      </section>

      <ErrorNote error={err} />
      <button className="btn ghost" onClick={async () => { await supabase.auth.signOut(); nav('/'); }}>Log out</button>
    </div>
  );
}

function LanguageCard() {
  const { lang, setLang, t } = useI18n();
  return (
    <section className="card">
      <h2 className="h2" style={{ margin: 0 }}>{t('settings.language')}</h2>
      <p className="sub">{t('settings.languageHelp')}</p>
      <div className="lang-pick" role="radiogroup" aria-label={t('settings.language')}>
        {LANGS.map(([code, name]) => (
          <button key={code} type="button" role="radio" aria-checked={lang === code} className={'lang-opt' + (lang === code ? ' on' : '')} onClick={() => setLang(code)} lang={code}>{name}</button>
        ))}
      </div>
    </section>
  );
}

function PrivacyCard() {
  const { me, refresh } = useAuth();
  const t = useT2();
  const [val, setVal] = useState(me?.message_privacy ?? 'everyone');
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!me) return null;
  async function pick(v: 'everyone' | 'following' | 'nobody') {
    setVal(v); setErr(null);
    try { await updateMyProfile(me!.id, { message_privacy: v }); await refresh(); setOk(true); setTimeout(() => setOk(false), 2000); }
    catch (x) { setErr((x as Error).message); }
  }
  return (
    <section className="card">
      <h2 className="h2" style={{ margin: 0 }}>{t('privacy.title')}</h2>
      <p className="sub">{t('privacy.help')}</p>
      {(['everyone', 'following', 'nobody'] as const).map((v) => (
        <label key={v} className="radio"><input type="radio" name="msgp" checked={val === v} onChange={() => pick(v)} />{t('privacy.' + v)}</label>
      ))}
      {ok && <p className="ok">{t('privacy.saved')}</p>}
      <ErrorNote error={err} />
      <p className="note">{t('privacy.note')}</p>
    </section>
  );
}
