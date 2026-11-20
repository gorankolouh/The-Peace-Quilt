# The Peace Quilt

A living archive of small, true peace stories. People share pieces: a story, a photo or a voice note. Each piece is tagged by role, theme and region. The pieces are sewn into a quilt that rises into a constellation, and threads connect separate voices. The platform also has posts, long articles, a following feed, comments, likes and private messages.

Stack: React + TypeScript (Vite), Supabase (Postgres, Auth, Storage, Realtime) in the EU region, deployed on Vercel.

## 1. Set up the database (once)

1. Supabase → your project → **SQL Editor** → New query.
2. Paste the whole of `supabase/migrations/0001_init.sql` and click **Run**.

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
