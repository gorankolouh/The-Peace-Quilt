import { Link } from 'react-router-dom';

export default function Rules() {
  return (
    <article className="read legal">
      <span className="eyebrow">Community rules</span>
      <h1>How we share information here</h1>
      <p>Verum Agora is for public-interest information and honest discussion. Disagreement, criticism of governments, companies and public figures, and controversial views are welcome. Disagreement is never treated as misinformation.</p>

      <h2>What we ask of everyone</h2>
      <ul>
        <li>Separate facts from opinions, and label your contribution honestly.</li>
        <li>Link sources for factual claims where you can. Say when you are not sure.</li>
        <li>Argue with ideas, not with people. Assume good faith until shown otherwise.</li>
        <li>Correct your own mistakes openly. Editing is allowed; corrections stay visible.</li>
        <li>Share someone else's story or photo only with their consent.</li>
      </ul>

      <h2>What is not allowed</h2>
      <ul>
        <li>Child sexual abuse material or any sexualisation of minors. This is removed immediately and reported to the authorities.</li>
        <li>Credible threats of violence, and incitement to violence.</li>
        <li>Illegal hate speech against people because of who they are.</li>
        <li>Harassment, bullying and coordinated pile-ons against a person.</li>
        <li>Publishing private information (addresses, phone numbers, identity documents, exact locations of people at risk) without consent.</li>
        <li>Pretending to be another person or organisation.</li>
        <li>Spam, fake accounts and coordinated campaigns that fake support or opposition.</li>
        <li>Invented events or stories presented as true.</li>
        <li>Other content that is illegal under EU or applicable national law.</li>
      </ul>

      <h2>How moderation works</h2>
      <ul>
        <li>Anyone with an account can report content with the flag button and choose a category. Reports about child safety and threats are reviewed first.</li>
        <li>Moderators are people, not algorithms. Every decision needs a written reason.</li>
        <li>If your content is restricted, you are told why and which rule applies (a statement of reasons).</li>
        <li>If you reported something, you are told the outcome.</li>
        <li>Fact reviews can add context or document a correction, but never delete an opinion. Authors can appeal, and a different decision can be reached.</li>
        <li>Every decision is recorded in a log that moderators cannot edit or delete. Overall figures are published on the <Link to="/transparency">Transparency</Link> page.</li>
      </ul>

      <h2>What we never do</h2>
      <ul>
        <li>No ads, no paid reach, no paid verification badges.</li>
        <li>No popularity rankings or influencer leaderboards.</li>
        <li>No ranking of posts by follower count. Engagement is never treated as proof of truth.</li>
        <li>No selling or sharing of your data.</li>
      </ul>

      <p className="note">These rules complement the <Link to="/terms">Terms</Link> and the <Link to="/privacy">Privacy policy</Link>.</p>
    </article>
  );
}
