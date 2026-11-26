import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { REPORT_REASONS } from '../lib/constants';
import { transparencyStats } from '../lib/data';
import type { TransparencyStats } from '../lib/types';

const REVIEW_LABEL: Record<string, string> = { open: 'Waiting', no_action: 'No action needed', context: 'Context added', correction: 'Correction documented', overturned: 'Overturned' };
const REPORT_STATUS: Record<string, string> = { open: 'Waiting', actioned: 'Rule broken, content restricted', dismissed: 'No rule broken' };
const APPEAL_LABEL: Record<string, string> = { open: 'Waiting', upheld: 'Decision kept', overturned: 'Decision reversed' };

function Figures() {
  const [s, setS] = useState<TransparencyStats | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { transparencyStats().then(setS).catch(() => setFailed(true)); }, []);
  if (failed) return null;
  if (!s) return <div className="card"><span className="note">Loading figures…</span></div>;
  const table = (title: string, data: Record<string, number>, labels: Record<string, string>) => {
    const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
    return (
      <div className="fig">
        <b>{title}</b>
        {rows.length ? <table><tbody>{rows.map(([k, n]) => <tr key={k}><td>{labels[k] ?? k}</td><td>{n}</td></tr>)}</tbody></table> : <span className="note">None yet</span>}
      </div>
    );
  };
  const reasons = Object.fromEntries(REPORT_REASONS);
  return (
    <section className="card figures" aria-labelledby="figs">
      <h2 id="figs">Moderation in figures</h2>
      <p className="note">The last 12 months, counted live from the database. No personal data is shown.</p>
      <div className="fig-top">
        <div><b>{s.contributions}</b><span>contributions</span></div>
        <div><b>{s.contributors}</b><span>contributors</span></div>
        <div><b>{Object.values(s.reports_by_reason).reduce((a, b) => a + b, 0)}</b><span>reports</span></div>
        <div><b>{s.content_hidden}</b><span>items hidden by moderators</span></div>
        <div><b>{s.median_hours_to_decision ?? '–'}</b><span>median hours to a decision</span></div>
      </div>
      <div className="fig-grid">
        {table('Reports by category', s.reports_by_reason, reasons)}
        {table('Report outcomes', s.reports_by_status, REPORT_STATUS)}
        {table('Fact reviews', s.reviews_by_status, REVIEW_LABEL)}
        {table('Appeals', s.appeals_by_status, APPEAL_LABEL)}
      </div>
    </section>
  );
}

export default function Transparency() {
  return (
    <article className="read legal">
      <span className="eyebrow">Information transparency</span>
      <h1>How Verum Agora shows facts, conflicts and corrections</h1>
      <p>Verum Agora does not decide which opinions are right. It helps you see where factual statements disagree, and what evidence each one rests on.</p>

      <Figures />
      <p>Read the <Link to="/rules">community rules</Link> to see what is and is not allowed.</p>

      <h2>What a contribution is</h2>
      <p>Authors label each contribution as a mainly factual report, an opinion or interpretation, or a mix of both. Opinions are protected. They are not fact-checked, but you can question any factual statement inside them.</p>

      <h2>Claims and evidence</h2>
      <p>Authors can list the key factual claims in their contribution: what is counted, the number, the date and the place, linked to a named event. Anyone signed in can attach evidence to a claim, marked as supporting, contradicting or adding context.</p>
      <p>Evidence is counted by <b>independent sources</b>, meaning different websites or publishers. Ten links to the same original report count as one source. Likes and repetition never count as evidence.</p>

      <h2>The three signals</h2>
      <p><span className="signal blue"><i />Additional context</span> Further sources, explanations or a reviewer's context note are available.</p>
      <p><span className="signal amber"><i />Conflicting information</span> Set automatically when another contribution about the same event reports a number more than 50% different, or a date more than two days apart. It does not mean either contribution is false. It invites you to compare them.</p>
      <p><span className="signal red"><i />Documented correction</span> Only a human reviewer can set this, after a review request, and only with a public written explanation. It is never the result of a vote or an algorithm. The author can request reconsideration, and an overturned decision removes the signal.</p>

      <h2>Comparing reports</h2>
      <p>Every event has a comparison page that lists all reported figures side by side with their evidence. A popular claim is not necessarily true, and a minority figure is not necessarily false.</p>

      <h2>What is not fact-checked</h2>
      <p>Political opinions, predictions and interpretations. Illegal content is handled separately through content reports and the <Link to="/terms">community rules</Link>.</p>

      <h2>Limits of this prototype</h2>
      <p>Conflict detection is rule-based and only works when claims use the same event name and the same thing counted. AI-assisted detection and cross-language matching are planned for later. Reviewers are volunteers appointed by the platform.</p>
    </article>
  );
}
