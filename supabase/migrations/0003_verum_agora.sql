-- Verum Agora, Phase 1: subjects, subtopics, interests, topic tags, sources, language,
-- country, editing and search. Additive only: existing data and the existing app keep working.

-- ============================================================
-- Subjects and subtopics (expandable without schema changes)
-- ============================================================
create table public.subjects (
  id smallint primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text not null default '',
  sort smallint not null default 0
);

create table public.subtopics (
  id serial primary key,
  subject_id smallint not null references public.subjects (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  unique (subject_id, slug)
);

insert into public.subjects (id, slug, name, description, sort) values
  (1, 'politics-democracy', 'Politics & Democracy', 'Elections, governments, democratic institutions, public policy, corruption, transparency and civic participation.', 1),
  (2, 'peace-international', 'Peace & International Affairs', 'Wars, diplomacy, international relations, conflict prevention, humanitarian affairs and peacebuilding.', 2),
  (3, 'human-rights-justice', 'Human Rights & Justice', 'Equality, discrimination, international law, civil liberties, migration, access to justice and human rights violations.', 3),
  (4, 'business-entrepreneurship', 'Business & Entrepreneurship', 'Small businesses, startups, entrepreneurship, employment, international trade and business development.', 4),
  (5, 'economy-finance', 'Economy & Finance', 'Inflation, banking, taxation, public spending, economic policies, financial systems and inequality.', 5),
  (6, 'education-knowledge', 'Education & Knowledge', 'Schools, universities, scientific research, educational policy, professional training and lifelong learning.', 6),
  (7, 'children-family-society', 'Children, Family & Society', 'Children''s rights, parenting, families, aging populations, social welfare and social development.', 7),
  (8, 'technology-digital', 'Technology & Digital Life', 'Artificial intelligence, cybersecurity, digital sovereignty, online platforms, data protection and emerging technologies.', 8),
  (9, 'health-wellbeing', 'Health & Wellbeing', 'Healthcare, public health, medical research, mental health, healthcare policy and wellbeing.', 9),
  (10, 'environment-sustainability', 'Environment & Sustainability', 'Climate change, biodiversity, pollution, energy, environmental protection and sustainable development.', 10),
  (11, 'culture-media-identity', 'Culture, Media & Identity', 'Journalism, media freedom, cultural heritage, arts, languages, religion, identity and media literacy.', 11),
  (12, 'communities-everyday', 'Communities & Everyday Life', 'Housing, transport, accessibility, local issues, public services, infrastructure and community development.', 12);

insert into public.subtopics (subject_id, slug, name) values
  (1, 'elections', 'Elections'), (1, 'public-policy', 'Public policy'), (1, 'corruption-transparency', 'Corruption & transparency'), (1, 'civic-participation', 'Civic participation'),
  (2, 'conflicts', 'Wars & conflicts'), (2, 'diplomacy', 'Diplomacy'), (2, 'humanitarian', 'Humanitarian affairs'), (2, 'peacebuilding', 'Peacebuilding'),
  (3, 'equality-discrimination', 'Equality & discrimination'), (3, 'international-law', 'International law'), (3, 'civil-liberties', 'Civil liberties'), (3, 'migration', 'Migration'), (3, 'access-to-justice', 'Access to justice'),
  (4, 'small-business', 'Small businesses'), (4, 'startups', 'Startups'), (4, 'employment', 'Employment'), (4, 'trade', 'International trade'),
  (5, 'inflation', 'Inflation & prices'), (5, 'taxation', 'Taxation & public spending'), (5, 'banking', 'Banking & finance'), (5, 'inequality', 'Inequality'),
  (6, 'schools', 'Schools'), (6, 'universities-research', 'Universities & research'), (6, 'education-policy', 'Education policy'), (6, 'lifelong-learning', 'Training & lifelong learning'),
  (7, 'childrens-rights', 'Children''s rights'), (7, 'parenting-families', 'Parenting & families'), (7, 'ageing', 'Ageing population'), (7, 'social-welfare', 'Social welfare'),
  (8, 'artificial-intelligence', 'Artificial intelligence'), (8, 'cybersecurity', 'Cybersecurity'), (8, 'digital-sovereignty', 'Digital sovereignty'), (8, 'data-protection', 'Data protection'), (8, 'online-platforms', 'Online platforms'),
  (9, 'healthcare-systems', 'Healthcare systems'), (9, 'public-health', 'Public health'), (9, 'mental-health', 'Mental health'), (9, 'medical-research', 'Medical research'),
  (10, 'climate', 'Climate change'), (10, 'energy', 'Energy'), (10, 'biodiversity', 'Biodiversity'), (10, 'pollution', 'Pollution'),
  (11, 'journalism-media-freedom', 'Journalism & media freedom'), (11, 'cultural-heritage', 'Cultural heritage & arts'), (11, 'religion-identity', 'Religion & identity'), (11, 'media-literacy', 'Media literacy'),
  (12, 'housing', 'Housing'), (12, 'transport', 'Transport'), (12, 'accessibility', 'Accessibility'), (12, 'local-issues', 'Local issues & public services');

-- ============================================================
-- Posts: new kinds and fields
-- ============================================================
alter type public.post_kind add value if not exists 'question';
alter type public.post_kind add value if not exists 'research';

alter table public.posts
  add column if not exists language text not null default 'en' check (language ~ '^[a-z]{2}$'),
  add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$'),
  add column if not exists sources jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz;

alter table public.posts add constraint posts_sources_is_array
  check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) <= 20);

-- Replace the old length/title rules so questions and research fit.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.posts'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%kind%'
  loop
    execute format('alter table public.posts drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.posts add constraint posts_title_rules
  check (kind::text in ('post', 'question') or title is not null);
alter table public.posts add constraint posts_length_rules
  check (kind::text in ('article', 'research') or char_length(body) <= 3000);

alter table public.posts add column if not exists search tsvector
  generated always as (to_tsvector('simple', coalesce(title, '') || ' ' || body)) stored;
create index if not exists posts_search_idx on public.posts using gin (search);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  if new.title is distinct from old.title or new.body is distinct from old.body
     or new.sources is distinct from old.sources then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger posts_touch_updated before update on public.posts
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Post relationships: subjects, subtopics, topic tags
-- ============================================================
create table public.post_subjects (
  post_id bigint not null references public.posts (id) on delete cascade,
  subject_id smallint not null references public.subjects (id),
  primary key (post_id, subject_id)
);
create index post_subjects_subject_idx on public.post_subjects (subject_id);

create table public.post_subtopics (
  post_id bigint not null references public.posts (id) on delete cascade,
  subtopic_id int not null references public.subtopics (id),
  primary key (post_id, subtopic_id)
);
create index post_subtopics_subtopic_idx on public.post_subtopics (subtopic_id);

-- Free topic and event tags, stored lower-case (e.g. "school funding", "berlin 2026 strike").
create table public.post_tags (
  post_id bigint not null references public.posts (id) on delete cascade,
  tag text not null check (tag = lower(tag) and char_length(tag) between 2 and 40),
  primary key (post_id, tag)
);
create index post_tags_tag_idx on public.post_tags (tag);

-- Subjects a member wants in "My Interests"
create table public.user_interests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id smallint not null references public.subjects (id) on delete cascade,
  primary key (user_id, subject_id)
);

create or replace function public.owns_post(pid bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.posts where id = pid and author_id = auth.uid());
$$;

alter table public.subjects enable row level security;
alter table public.subtopics enable row level security;
alter table public.post_subjects enable row level security;
alter table public.post_subtopics enable row level security;
alter table public.post_tags enable row level security;
alter table public.user_interests enable row level security;

create policy "subjects readable" on public.subjects for select using (true);
create policy "subtopics readable" on public.subtopics for select using (true);
create policy "post subjects readable" on public.post_subjects for select using (true);
create policy "post subjects by author" on public.post_subjects for insert with check (public.owns_post(post_id));
create policy "post subjects removed by author" on public.post_subjects for delete using (public.owns_post(post_id));
create policy "post subtopics readable" on public.post_subtopics for select using (true);
create policy "post subtopics by author" on public.post_subtopics for insert with check (public.owns_post(post_id));
create policy "post subtopics removed by author" on public.post_subtopics for delete using (public.owns_post(post_id));
create policy "post tags readable" on public.post_tags for select using (true);
create policy "post tags by author" on public.post_tags for insert with check (public.owns_post(post_id));
create policy "post tags removed by author" on public.post_tags for delete using (public.owns_post(post_id));
create policy "own interests" on public.user_interests for select using (user_id = auth.uid());
create policy "add own interests" on public.user_interests for insert with check (user_id = auth.uid());
create policy "remove own interests" on public.user_interests for delete using (user_id = auth.uid());

-- ============================================================
-- Read model for posts (columns appended to keep the old app working)
-- ============================================================
create or replace view public.posts_v with (security_invoker = false) as
select
  p.id, p.author_id, p.kind, p.title, p.body, p.media_path, p.media_kind, p.created_at,
  (p.author_id = auth.uid()) as is_mine,
  (select count(*) from public.likes l where l.target_type = 'post' and l.target_id = p.id)::int as like_count,
  (select count(*) from public.comments c where c.target_type = 'post' and c.target_id = p.id and not c.hidden)::int as comment_count,
  exists (select 1 from public.likes l where l.target_type = 'post' and l.target_id = p.id and l.user_id = auth.uid()) as liked,
  p.language, p.country, p.sources, p.updated_at,
  coalesce(array(select ps.subject_id from public.post_subjects ps where ps.post_id = p.id order by ps.subject_id), '{}')::smallint[] as subject_ids,
  coalesce(array(select pt.subtopic_id from public.post_subtopics pt where pt.post_id = p.id order by pt.subtopic_id), '{}')::int[] as subtopic_ids,
  coalesce(array(select tg.tag from public.post_tags tg where tg.post_id = p.id order by tg.tag), '{}')::text[] as tags,
  p.search
from public.posts p
where p.author_id = auth.uid() or not p.hidden;

-- ============================================================
-- Related discussions: transparent, rule-based scoring
--   shared subtopic +3, shared topic tag +3, shared subject +1,
--   same country +2, text similarity up to +2, small freshness bonus.
-- ============================================================
create or replace function public.related_posts(pid bigint, max_results int default 8)
returns table (post_id bigint, score numeric, shared_subjects int, shared_subtopics int,
               shared_tags text[], same_country boolean)
language sql stable security definer set search_path = '' as $$
  with me as (
    select p.id, p.country, p.search,
      array(select subject_id from public.post_subjects where post_id = p.id) as subj,
      array(select subtopic_id from public.post_subtopics where post_id = p.id) as subt,
      array(select tag from public.post_tags where post_id = p.id) as tg
    from public.posts p
    where p.id = pid and (not p.hidden or p.author_id = auth.uid())
  ),
  cand as (
    select o.id, o.country, o.created_at,
      (select count(*) from public.post_subjects s, me where s.post_id = o.id and s.subject_id = any (me.subj))::int as ss,
      (select count(*) from public.post_subtopics s, me where s.post_id = o.id and s.subtopic_id = any (me.subt))::int as st,
      array(select t.tag from public.post_tags t, me where t.post_id = o.id and t.tag = any (me.tg)) as tg,
      ts_rank(o.search, to_tsquery('simple', coalesce(nullif(
        (select string_agg(quote_literal(w), ' | ') from (
           select word as w from ts_stat(format('select %L::tsvector', (select search from me)))
           where length(word) > 4 order by nentry desc, word limit 12) x), ''), 'zzzznone'))) as tr
    from public.posts o, me
    where o.id <> me.id and not o.hidden
  )
  select c.id,
    round((c.st * 3 + coalesce(array_length(c.tg, 1), 0) * 3 + c.ss
      + case when c.country is not null and c.country = (select country from me) then 2 else 0 end
      + least(c.tr * 20, 2)
      + case when c.created_at > now() - interval '30 days' then 0.5 else 0 end)::numeric, 2),
    c.ss, c.st, c.tg,
    (c.country is not null and c.country = (select country from me))
  from cand c
  where c.ss + c.st > 0 or coalesce(array_length(c.tg, 1), 0) > 0 or c.tr > 0.05
  order by 2 desc, c.created_at desc
  limit greatest(1, least(max_results, 30));
$$;

-- ============================================================
-- Access for the API roles
-- ============================================================
grant select on public.subjects, public.subtopics, public.post_subjects, public.post_subtopics,
  public.post_tags, public.posts_v to anon, authenticated;
grant insert, delete on public.post_subjects, public.post_subtopics, public.post_tags to authenticated;
grant select, insert, delete on public.user_interests to authenticated;
grant update (title, body, language, country, sources, hidden) on public.posts to authenticated;
grant execute on function public.owns_post(bigint) to authenticated;
grant execute on function public.related_posts(bigint, int) to anon, authenticated;
