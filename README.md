# Verum Agora

**Where Reality Connects.** An independent, European, ad-free social information network: subjects over personalities, information over influence. (Formerly The Peace Quilt, which lives on as a collection inside *Peace & International Affairs*.)

Stack: React + TypeScript (Vite), Supabase (Postgres, Auth, Storage, Realtime) in the EU region, deployed on Vercel. The database is plain Postgres with migrations in `supabase/migrations/`, so it can move to any European Postgres host.

## Phase 1 (this version)

- **12 subjects with subtopics.** Each subject has its own page. A contribution can carry 1 to 4 subjects, plus subtopics and free topic/event tags. Subjects and subtopics live in tables, so adding more needs no code change.
- **Publishing:** post, question, article, research & analysis, plus peace stories. Every contribution has a language, an optional country/region, source links and media, and can be edited or deleted by its author.
- **Feed modes:** My Interests (chosen at sign-up and changeable in Settings), Following, Latest and Explore. Each mode explains why you see what you see. Nothing is ranked by follower counts or likes.
- **Related Discussions** on every contribution, from a transparent rule-based score: shared subtopic +3, shared topic tag +3, shared subject +1, same country +2, similar wording up to +2, small freshness bonus. Each result says what connects it. This lives in the `related_posts()` SQL function and can be swapped for semantic search later.
- **Search the archive:** full-text search with subject, country, language, type and topic filters. Old contributions stay findable.
- **Kept from before:** accounts (email and Google), profiles, follows, comments, likes, private messages, blocking, reporting, GDPR export and account deletion, private media with signed links, and photo metadata removal.

## Phase 2: information transparency layer

- **Nature label** on every contribution: mainly factual, opinion or interpretation, or mixed. Opinions are not fact-checked.
- **Factual claims:** authors list the key facts (statement, event, what is counted, number, unit, date, place) when publishing or later. Anyone signed in can attach evidence that **supports**, **contradicts** or **adds context**.
- **Independent sources** are counted by distinct website, so repeating one source never counts as confirmation. Likes and repetition never count as evidence.
- **Signals:** BLUE means additional context is available. AMBER is set automatically when the same event and metric is reported more than 50% apart, or with dates more than two days apart; it is not a verdict. RED means a documented correction, which only a human reviewer can set, always with a public written explanation.
- **Comparison view** (`/compare/<event>`) shows all reported figures for one event side by side, with the range and the evidence for each.
- **Question a claim:** any member can send a factual statement for human review, with evidence. The requester's identity is not shown publicly.
- **Review desk** (`/review`, moderators only) covers fact reviews, appeals and content reports. Every decision needs a public explanation. Reports can hide content.
- **Appeals:** the author can request reconsideration once per decision. An overturned decision removes the signal and the reversal is recorded.
- **"How this works"** public page (`/transparency`).

Conflict detection is a rule-based demonstration in SQL (`claim_conflicts`, `event_claims`). It can later be extended with AI-assisted and cross-language matching.

## Phase 3: platform operations

- **Notifications** (`/notifications`, bell with unread count, live updates): new followers, comments, replies, appreciation, evidence added to your claims, fact reviews requested and decided, appeal outcomes.
- **DSA notices:** when a moderator restricts content after a report, the author gets a statement of reasons and the reporter gets the outcome, both automatically.
- **Comment replies**, one level deep, so discussions stay readable.
- **Rate limiting and spam protection in the database:** hourly limits per account for posts, stories, comments, messages, reports, reviews, evidence, follows and likes, plus a block on posting the same text twice within 10 minutes.
- **Interface languages:** English, Deutsch, Français, Nederlands, Español, Italiano, Hrvatski, Polski (Settings → Interface language; the browser language is used by default). Contributions are never machine-translated; untranslated interface text falls back to English. Translations are in `src/lib/i18n.tsx`.
- **European infrastructure assessment:** see `SOVEREIGNTY.md`.

## Phase 4: moderation records, archive and privacy

- **Moderation records:** every decision on reports, fact reviews, appeals and hidden content is written to an append-only log by the database itself. Moderators can read it and download it as CSV (Review desk → Records); nobody can edit or delete entries.
- **Public figures:** the Transparency page shows live, aggregated moderation figures for the last 12 months (reports by category and outcome, fact reviews, appeals, median time to a decision). No personal data.
- **Community rules** page (`/rules`), linked in the footer and from the Transparency page.
- **Report categories** now include child sexual abuse material, threats, illegal hate speech, impersonation and coordinated fake activity. Child-safety and threat reports are shown to moderators first.
- **Archive search:** date range, browse by year, sort (newest, oldest, most discussed, most documented), and people search by name. Follower counts are never shown in results.
- **Share** button on every contribution (phone share sheet or copy link, no tracking parameters).
- **Messaging privacy:** choose who can start a new conversation with you (everyone, only people you follow, nobody). Enforced in the database.
- **Acknowledgments without popularity:** profiles show what someone added to the shared record (evidence, documented claims, sourced contributions, research, answers), not likes or rankings.

## Phase 5: multilingual connections

- **Automatic translation, always labelled.** When a contribution is in another language than your interface, a Translate button appears. The translation is marked "Automatic translation · original: German", shown with a blue edge, and "Show original" is one click away. Nothing is ever replaced in the database.
- **Three sources, most private first:** a cached server translation if one exists; on-device translation in Chrome on a computer (the text never leaves the device); otherwise the `translate` Edge Function using DeepL (DeepL SE, Germany), if you deploy it and add a key.
- **Stale translations are deleted** automatically when the author edits the text.
- **Cross-language topics:** signed-in people can link equivalent topic names ("schulfinanzierung" = "school funding"). Related discussions, conflict detection (amber signal), the comparison view and topic search then work across languages. Links are flattened into groups; moderators can remove wrong ones.
- Related discussions say "written in German" and can be filtered to other languages only.

### Turning on server translation (optional)

1. Create a DeepL API account (the free plan allows 500,000 characters a month; for production use a paid plan, which deletes texts after translation).
2. Deploy the function: `supabase functions deploy translate` (or create a function named `translate` in the Supabase dashboard and paste `supabase/functions/translate/index.ts`).
3. Add the key as a secret named `DEEPL_API_KEY` (Dashboard → Edge Functions → Secrets). Never put it in the front end.

## Phase 6: reader controls, people, connections, open notices, hardening

- **Feed controls you own** ("Adjust feed"): choose which languages to see, show only contributions with sources or documented claims, and hide subjects. Saved with your profile (or in the browser when logged out). Active filters are always shown under "Why you see this".
- **People contributing here** on every subject page: most recent contributors first, never ranked by followers.
- **Connected discussions** (`/connections`): topics and events that link several contributions, across languages and countries, with a filter for cross-language connections only.
- **Notice of illegal content without an account** (`/notice`, DSA Art. 16): link, category, explanation, optional name and email, good-faith confirmation; the database enforces the explanation and caps anonymous notices against flooding. The flag button sends logged-out visitors here.
- **Self-hosted fonts:** Google Fonts removed, so no visitor IP addresses go to Google.
- **Security headers:** Content-Security-Policy (only our own scripts; connections only to our Supabase project), HSTS, cross-origin isolation for popups, long-term caching of built assets.

## Planned next (not built yet)

- Suggested topic links (detecting likely equivalents automatically, confirmed by people)
- Email and push notifications
- Moving to a fully EU-operated stack (see `SOVEREIGNTY.md`)

## 1. Set up the database (once)

1. Supabase → your project → **SQL Editor** → New query.
2. Paste the whole of `supabase/migrations/0001_init.sql` and click **Run**. Then run `0002_grants.sql`, `0003_verum_agora.sql`, `0004_avatars_chat_files.sql`, `0005_transparency.sql`, `0006_notifications_replies_limits.sql`, `0007_moderation_records_privacy.sql`, `0008_translation_cross_language.sql` and `0009_feed_controls_people_notices.sql`, in that order. Each one is additive and keeps existing data.

This creates the tables, the security rules (row level security), the private `media` storage bucket, messaging and the account-deletion function.

**Before launch:** replace the five placeholder regions in the `regions` table with the real, deliberately broad regions (Table Editor → regions).

## 2. Configure login

Supabase → **Authentication → URL Configuration**
- Site URL: your live address, e.g. `https://peacequilt.org`
- Redirect URLs: add `https://YOUR-DOMAIN/**` and `http://localhost:5173/**`

Supabase → **Authentication → Providers**
- **Email:** enabled, with "Confirm email" on.
- **Google:**
  1. Go to console.cloud.google.com → create a project → **APIs & Services → OAuth consent screen**. Set it to External, then fill in the app name, support email and your domain.
  2. **Credentials → Create credentials → OAuth client ID** → Web application.
  3. Authorized redirect URI: the callback URL shown in Supabase's Google provider panel (`https://YOUR-PROJECT.supabase.co/auth/v1/callback`).
  4. Copy the Client ID and Client Secret into Supabase's Google provider and save.

Optional: Authentication → Emails, to brand the confirmation and reset emails.

## 3. Deploy on Vercel

1. Vercel → Add New → Project → import this GitHub repo. Vercel detects the framework (Vite).
2. Environment variables:
   - `VITE_SUPABASE_URL` = Project URL (Supabase → Project Settings → API)
   - `VITE_SUPABASE_ANON_KEY` = the anon public key
3. Deploy, then add your domain under Settings → Domains.

## 4. Moderators and researchers

Users cannot give themselves these roles. In Supabase → Table Editor → `profiles`, set `is_moderator` or `is_researcher` to `true` for the right people.
- Moderators can see open reports in the `reports` table and hide content by setting `hidden = true` on a story, post or comment.
- Researchers can also see stories shared as "Researchers only".

## Run locally

```bash
cp .env.example .env   # fill in the two values
npm install
npm run dev
```

## Privacy and safety built in

- **Consent per story:** public with name, public without name (the author is hidden from everyone else), or researchers only. Authors can change this or withdraw a piece at any time.
- **Photos:** re-drawn on the device before upload, which removes EXIF data such as GPS location and camera serial numbers.
- **Stories:** can carry only a photo or audio. Video and PDF are allowed in posts, with a warning, because their metadata is not cleaned yet.
- **Media files:** live in a private bucket and are served through short-lived signed links, only when the story or post they belong to is visible.
- **Reports and blocks:** report buttons (DSA notice-and-action) on every story, post, comment and profile, plus blocking.
- **GDPR:** Settings → download all your data (JSON) or delete your account and every file.
- **Cookies:** no tracking cookies. Only the login token is stored.

## Not built yet

- Moderator dashboard (moderation runs through the Supabase table editor for now)
- Server-side metadata removal for video and PDF
- Notifications by email or push (in-app notifications are built)
- End-to-end encrypted messages
- Final legal texts: the Privacy, Terms and Imprint pages are drafts marked [TO COMPLETE]
