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

## Planned next (not built yet)

- **Phase 2, information transparency layer:** claims and evidence, BLUE/AMBER/RED notices, a contradiction-detection demo, a human review workflow and appeals.
- **Phase 3, platform operations:** notifications, comment replies, a moderator dashboard with documented decisions and user notices, rate limiting, interface translations (DE, FR, NL, ES, IT, HR, PL), translated-content labels, cross-language connections, and a European infrastructure assessment.

## 1. Set up the database (once)

1. Supabase → your project → **SQL Editor** → New query.
2. Paste the whole of `supabase/migrations/0001_init.sql` and click **Run**. Then run `0002_grants.sql`, `0003_verum_agora.sql` and `0004_avatars_chat_files.sql`, in that order. Each one is additive and keeps existing data.

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
- Notifications (new follower, comment, message by email or push)
- End-to-end encrypted messages
- Final legal texts: the Privacy, Terms and Imprint pages are drafts marked [TO COMPLETE]
