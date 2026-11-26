import { Link } from 'react-router-dom';

export default function Transparency() {
  return (
    <article className="read legal">
      <span className="eyebrow">Information transparency</span>
      <h1>How Verum Agora shows facts, conflicts and corrections</h1>
      <p>Verum Agora does not decide which opinions are right. It helps you see where factual statements disagree, and what evidence each one rests on.</p>

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
