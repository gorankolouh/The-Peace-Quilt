# European infrastructure assessment

Status: November 2026. This is a working assessment for the prototype (100–200 users), not legal advice. Re-check providers' subprocessor lists before each phase.

## Where the prototype runs today

| Layer | Provider | Company / jurisdiction | Where the data sits | Transfer basis |
|---|---|---|---|---|
| Database, auth, file storage, realtime | Supabase (project in an EU AWS region, Frankfurt) | Supabase, Inc. (USA) on Amazon Web Services (USA) | Postgres, Auth users and Storage objects stay in the chosen EU region, including backups | Supabase DPA with EU Standard Contractual Clauses (2021/914) |
| Front end (static files, CDN) | Vercel | Vercel, Inc. (USA) | Global edge network; the site holds no user data, but request logs (IP addresses) are processed | Vercel DPA with SCCs; Vercel is certified under the EU-US Data Privacy Framework |
| Auth emails | Supabase's built-in mailer (Postmark, USA, per Supabase's subprocessor list) | USA | Email addresses and confirmation links | Via the Supabase DPA |
| Automatic translation (optional) | Chrome on-device translator, or DeepL via the `translate` function | On-device: nothing leaves the computer. DeepL SE (Germany) | Server translations are cached in the EU database | DeepL is an EU company; use a paid plan for production |
| Google login (optional) | Google | USA | Only if the user chooses it | Google's own terms |

**What is already sovereign by design:** no ads, no trackers, no third-party analytics, no external fonts or scripts, photos stripped of location data before upload, all personal data in one EU-region database, full export and deletion in Settings.

**The open issue:** the data is stored in the EU, but every operator in the chain is a US company. US companies can be compelled to hand over data under US law (CLOUD Act, FISA 702) regardless of where it is stored. For a platform about information integrity, peace and human rights, this is the main credibility gap.

## Legal position of US providers

- Transfers rely on the EU-US Data Privacy Framework (DPF) and on Standard Contractual Clauses.
- The EU General Court upheld the DPF on 3 September 2025 (Latombe v Commission, T-553/23). Mr Latombe appealed to the Court of Justice, so the framework could still fall, as Safe Harbor (2015) and Privacy Shield (2020) did.
- If the DPF falls, SCCs remain, but each controller must then document a transfer impact assessment. A fully EU-operated stack removes this risk entirely.

## Target: fully European stack

The code needs almost no changes, because Supabase is open source and can be self-hosted, and the front end is plain static files.

| Layer | Option | Notes |
|---|---|---|
| Servers | Hetzner (DE), Scaleway (FR), OVHcloud (FR), IONOS (DE) | EU-headquartered companies, EU data centres |
| Database + auth + storage | Self-hosted Supabase (Docker) on one of the above | Same API; the app only needs a new URL and key |
| Managed alternative | A managed Postgres from an EU provider + self-hosted Supabase services | Less maintenance for backups |
| File storage | S3-compatible object storage from the same EU provider | Supabase Storage can use it as its backend |
| Front end | Static hosting on the same server, or an EU CDN (for example Bunny.net, Slovenia) | Vercel is not needed: `npm run build` produces static files |
| Auth emails | An EU transactional mail provider via custom SMTP in Supabase Auth settings | Removes the US mail subprocessor |
| Login | Email + password (EU). Keep Google optional and clearly labelled | |

Check each candidate's current ownership and subprocessor list before signing: "EU data centre" is not the same as "EU company".

## Migration path

1. **Now (prototype, 100–200 users):** stay on Supabase EU region and Vercel. Sign the Supabase DPA and the Vercel DPA. Switch auth emails to an EU SMTP provider. List all processors in the privacy policy.
2. **Before public launch:** set up self-hosted Supabase on an EU provider in a staging environment. Run migrations 0001–0006 there, copy data with `pg_dump` / `pg_restore`, copy storage buckets, and test login, uploads and realtime.
3. **Switch:** move the domain's DNS to the EU front end, update `VITE_SUPABASE_URL` and the key, and keep the old project read-only for 30 days as a fallback, then delete it.
4. **After:** publish this table as a public "Where your data lives" page, with dates, so users can check it.

## Cost and effort (estimate)

- Prototype on hosted Supabase and Vercel: free tiers are enough.
- Self-hosted EU stack: one mid-size virtual server plus object storage and backups, typically in the range of tens of euros per month at prototype scale.
- Main extra cost is operations: updates, backups, monitoring. Plan for a technical maintainer or a managed EU Postgres.

## Sources

- Supabase: Data Residency and Transfers FAQ; GDPR compliance guide; DPA (June 2026); Subprocessor list (October 2026).
- Vercel: Data Processing Addendum; DPF certification notice.
- EU General Court, Case T-553/23, Latombe v Commission (3 September 2025), and reporting on the appeal to the Court of Justice.
