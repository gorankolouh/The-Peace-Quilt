import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, ErrorNote, Spinner } from '../components/ui';
import { countryName } from '../lib/constants';
import { connectedTopics, type ConnectedTopic } from '../lib/data';
import { timeAgo } from '../lib/format';
import { useI18n } from '../lib/i18n';

/** Topics and events that link several contributions, across languages and countries. */
export default function Connections() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<ConnectedTopic[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [onlyCross, setOnlyCross] = useState(false);
  useEffect(() => { connectedTopics().then(setRows).catch((e) => setErr(e.message)); }, []);
  const langName = (c: string) => { try { return new Intl.DisplayNames([lang], { type: 'language' }).of(c) ?? c; } catch { return c; } };
  const shown = (rows ?? []).filter((r) => !onlyCross || r.languages.length > 1 || r.countries.length > 1);
  return (
    <div className="col">
      <h1 className="h1">{t('conn.title')}</h1>
      <p className="sub">{t('conn.sub')}</p>
      <label className="check"><input type="checkbox" checked={onlyCross} onChange={(e) => setOnlyCross(e.target.checked)} /><span>{t('conn.cross')}</span></label>
      <ErrorNote error={err} />
      {!rows && !err && <Spinner />}
      {rows && shown.length === 0 && <Empty title={t('conn.empty')}><p className="sub">{t('conn.emptyHelp')}</p></Empty>}
      {shown.map((r) => (
        <Link key={r.kind + r.topic} className="card conn" to={r.kind === 'event' ? `/compare/${encodeURIComponent(r.topic)}` : `/search?tag=${encodeURIComponent(r.topic)}`}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
            <b>{r.kind === 'event' ? '◆ ' : '#'}{r.topic}</b>
            <span className="chip muted">{r.kind === 'event' ? t('conn.event') : t('conn.topic')}</span>
          </div>
          <span className="note">
            {r.contributions} {t('conn.contributions')}
            {r.languages.length > 0 && <> · {r.languages.map(langName).join(', ')}</>}
            {r.countries.length > 0 && <> · {r.countries.map((c) => countryName(c)).join(', ')}</>}
            {' · '}{timeAgo(r.last_at)}
          </span>
        </Link>
      ))}
    </div>
  );
}
