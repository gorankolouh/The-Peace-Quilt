import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorNote } from '../components/ui';
import { useAuth } from '../lib/auth';
import { PROFILE_ROLES } from '../lib/constants';
import { deleteMyAccount, exportMyData, updateMyProfile } from '../lib/data';
import { supabase } from '../lib/supabase';

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
  if (!me) return null;

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
        <h2 className="h2" style={{ margin: 0 }}>Your data</h2>
        <p className="sub">Download everything you have shared: profile, pieces, posts, comments, likes, follows and the messages you sent.</p>
        <div className="row">
          <button className="btn ghost" onClick={doExport}>Prepare my data</button>
          {exportUrl && <a className="btn" href={exportUrl} download="peace-quilt-my-data.json">Download file</a>}
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
