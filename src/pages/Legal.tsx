// Draft legal pages. Replace every [TO COMPLETE] before public launch.

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="read legal">
      <h1>{title}</h1>
      <p className="draft">Draft: to be completed before public launch.</p>
      {children}
    </article>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy Policy">
      <h2>Who is responsible</h2>
      <p>[TO COMPLETE: controller name, address and contact email under Art. 13 GDPR.]</p>
      <h2>What we store</h2>
      <p>Your email address and login data; your profile (username, display name, role, bio); the stories, posts, articles, comments and files you share; likes, follows, blocks, reports and private messages.</p>
      <h2>Why</h2>
      <p>To run your account and the platform (Art. 6(1)(b) GDPR), and to keep it safe, including handling reports of illegal content (Art. 6(1)(c) and (f) GDPR). A story can reveal sensitive information about you, such as political opinions or religious beliefs. We process it only because you chose to publish it (Art. 9(2)(a) and (e) GDPR), and you can withdraw it at any time.</p>
      <h2>Safety measures</h2>
      <p>Photos are re-drawn on your device before upload, which removes location and camera data. Pieces can be shared without your name or for researchers only. Regions are deliberately broad.</p>
      <h2>Where data is stored</h2>
      <p>Hosting: Supabase, EU region (Frankfurt, Germany). Website delivery: Vercel. [TO COMPLETE: processors, data processing agreements, any transfers outside the EU and their safeguards.]</p>
      <h2>Cookies</h2>
      <p>We use no tracking or advertising cookies. Your browser stores a login token so you stay signed in. This is strictly necessary for the service.</p>
      <h2>Your rights</h2>
      <p>You can download your data and delete your account at any time in Settings. You also have the right to access, rectification, restriction, objection and to lodge a complaint with a supervisory authority. [TO COMPLETE: contact for requests and the competent supervisory authority.]</p>
      <h2>How long we keep data</h2>
      <p>Until you delete it or your account. Reports are kept as long as needed to handle them and to meet legal obligations. [TO COMPLETE: retention periods.]</p>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms and community rules">
      <h2>What this place is for</h2>
      <p>Verum Agora connects people through information and public-interest subjects. Share what you know, cite your sources, and separate facts from opinions. Peace stories in the Peace Quilt collection should be first-hand.</p>
      <h2>Rules</h2>
      <p>Do not post anything that could put a person in danger, including exact locations, full names of people at risk or identifying photos. No hate, harassment, incitement to violence, illegal content or invented stories presented as true. Respect other people's consent: only share someone else's story with their permission.</p>
      <h2>Reporting and moderation</h2>
      <p>Anyone can report content with the flag button. Moderators review reports, may hide content and will tell you why when your content is restricted. You can contest a decision. [TO COMPLETE: DSA single point of contact, statement-of-reasons process, internal complaint handling and out-of-court dispute settlement.]</p>
      <h2>Your content</h2>
      <p>You keep the rights to what you share. You allow the platform to display it as you chose (public, without your name, or researchers only) until you withdraw it. [TO COMPLETE: licence wording, minimum age, liability, governing law.]</p>
    </Page>
  );
}

export function Imprint() {
  return (
    <Page title="Imprint">
      <p>[TO COMPLETE: provider name, address, contact email and phone, register entry and VAT number if applicable, person responsible for content.]</p>
    </Page>
  );
}
