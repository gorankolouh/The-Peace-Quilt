-- Verum Agora, Phase 2: the information transparency layer.
-- Claims, evidence, conflict detection, human review, appeals.
-- Principles: popularity is not proof; repeated use of one source is not independent confirmation;
-- RED can only come from a documented human review, and authors can always appeal.

-- ============================================================
-- What a contribution mainly is
-- ============================================================
alter table public.posts add column if not exists nature text not null default 'mixed'
  check (nature in ('factual', 'opinion', 'mixed'));
grant update (nature) on public.posts to authenticated;

-- ============================================================
-- Factual claims inside a contribution
-- ============================================================
create table public.claims (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  statement text not null check (char_length(statement) between 5 and 300),
  event_tag text check (event_tag is null or (event_tag = lower(event_tag) and char_length(event_tag) between 2 and 60)),
  metric text check (metric is null or (metric = lower(metric) and char_length(metric) between 2 and 40)),
  value numeric check (value is null or value >= 0),
  unit text check (unit is null or char_length(unit) <= 20),
  occurred_on date,
  location text check (location is null or char_length(location) <= 80),
  created_at timestamptz not null default now()
);
create index claims_post_idx on public.claims (post_id);
create index claims_event_idx on public.claims (event_tag, metric);

-- Evidence attached to a claim. Anyone may add evidence, for or against.
create table public.claim_evidence (
  id bigint generated always as identity primary key,
  claim_id bigint not null references public.claims (id) on delete cascade,
  added_by uuid not null references public.profiles (id) on delete cascade,
  url text not null check (url ~* '^https?://' and char_length(url) <= 500),
  title text check (title is null or char_length(title) <= 200),
  stance text not null check (stance in ('supports', 'contradicts', 'context')),
  note text check (note is null or char_length(note) <= 500),
  -- The source's site, used to count independent sources (www. removed).
  domain text generated always as (regexp_replace(lower(substring(url from '^https?://([^/:?#]+)')), '^www\.', '')) stored,
  created_at timestamptz not null default now(),
  unique (claim_id, url)
);
create index claim_evidence_claim_idx on public.claim_evidence (claim_id);

create or replace function public.owns_claim_post(pid bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.posts where id = pid and author_id = auth.uid());
$$;

-- ============================================================
-- Human review of disputed facts, with a public record
-- ============================================================
create table public.fact_reviews (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  claim_id bigint references public.claims (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  request_text text not null check (char_length(request_text) between 10 and 2000),
  status text not null default 'open'
    check (status in ('open', 'no_action', 'context', 'correction', 'overturned')),
  decision_text text check (decision_text is null or char_length(decision_text) <= 4000),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  -- A decision always needs a written explanation.
  check (status = 'open' or (decision_text is not null and char_length(decision_text) >= 20 and decided_at is not null))
);
create index fact_reviews_post_idx on public.fact_reviews (post_id);

create table public.appeals (
  id bigint generated always as identity primary key,
  review_id bigint not null references public.fact_reviews (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  appeal_text text not null check (char_length(appeal_text) between 20 and 4000),
  status text not null default 'open' check (status in ('open', 'upheld', 'overturned')),
  decision_text text check (decision_text is null or char_length(decision_text) <= 4000),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (status = 'open' or (decision_text is not null and char_length(decision_text) >= 20 and decided_at is not null))
);

-- Only moderators may decide; the decider and time are filled in by the database.
create or replace function public.guard_decisions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status or new.decision_text is distinct from old.decision_text then
    if not public.is_moderator() then
      raise exception 'Only reviewers can record decisions';
    end if;
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end;
$$;
create trigger fact_reviews_guard before update on public.fact_reviews
  for each row execute function public.guard_decisions();
create trigger appeals_guard before update on public.appeals
  for each row execute function public.guard_decisions();

-- An appeal that is upheld for the author reverses the review.
create or replace function public.apply_appeal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'overturned' and old.status <> 'overturned' then
    update public.fact_reviews
      set status = 'overturned',
          decision_text = coalesce(decision_text, '') || E'\n\nOverturned on appeal: ' || new.decision_text
      where id = new.review_id;
  end if;
  return new;
end;
$$;
create trigger appeals_apply after update on public.appeals
  for each row execute function public.apply_appeal();

-- Only the author of the reviewed contribution may appeal, once per review, and only after a decision.
create or replace function public.can_appeal(rid bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.fact_reviews r join public.posts p on p.id = r.post_id
    where r.id = rid and p.author_id = auth.uid() and r.status in ('context', 'correction')
  ) and not exists (select 1 from public.appeals a where a.review_id = rid);
$$;

-- ============================================================
-- Conflict detection (a limited, rule-based demonstration)
--   number: same event + metric, values differ by more than 50 %
--   date:   same event, dates more than 2 days apart
--   place:  same event, different locations
-- ============================================================
create or replace function public.claim_conflicts(pid bigint)
returns table (claim_id bigint, other_claim_id bigint, other_post_id bigint, kind text,
               mine_value numeric, other_value numeric, ratio numeric)
language sql stable security definer set search_path = '' as $$
  select a.id, b.id, b.post_id,
    case
      when a.metric is not null and a.metric = b.metric and a.value is not null and b.value is not null
           and greatest(a.value, b.value) > 1.5 * nullif(least(a.value, b.value), 0) then 'number'
      when a.occurred_on is not null and b.occurred_on is not null and abs(a.occurred_on - b.occurred_on) > 2 then 'date'
      else 'place'
    end,
    a.value, b.value,
    round(greatest(a.value, b.value) / nullif(least(a.value, b.value), 0), 2)
  from public.claims a
  join public.claims b on b.event_tag = a.event_tag and b.id <> a.id and b.post_id <> a.post_id
  join public.posts pa on pa.id = a.post_id
  join public.posts pb on pb.id = b.post_id
  where a.post_id = pid and a.event_tag is not null and not pb.hidden
    and (not pa.hidden or pa.author_id = auth.uid())
    and (
      (a.metric is not null and a.metric = b.metric and a.value is not null and b.value is not null
        and (least(a.value, b.value) = 0 and greatest(a.value, b.value) > 0
             or greatest(a.value, b.value) > 1.5 * nullif(least(a.value, b.value), 0)))
      or (a.occurred_on is not null and b.occurred_on is not null and abs(a.occurred_on - b.occurred_on) > 2)
      or (a.location is not null and b.location is not null and lower(a.location) <> lower(b.location)
          and a.metric is not distinct from b.metric)
    );
$$;

-- Everything known about one event, for the comparison view.
create or replace function public.event_claims(tag text)
returns table (claim_id bigint, post_id bigint, statement text, metric text, value numeric, unit text,
               occurred_on date, location text, created_at timestamptz,
               supports int, contradicts int, context int, independent_sources int)
language sql stable security definer set search_path = '' as $$
  select c.id, c.post_id, c.statement, c.metric, c.value, c.unit, c.occurred_on, c.location, c.created_at,
    (select count(*) from public.claim_evidence e where e.claim_id = c.id and e.stance = 'supports')::int,
    (select count(*) from public.claim_evidence e where e.claim_id = c.id and e.stance = 'contradicts')::int,
    (select count(*) from public.claim_evidence e where e.claim_id = c.id and e.stance = 'context')::int,
    (select count(distinct e.domain) from public.claim_evidence e where e.claim_id = c.id and e.stance = 'supports')::int
  from public.claims c join public.posts p on p.id = c.post_id
  where c.event_tag = lower(tag) and not p.hidden
  order by c.metric nulls last, c.value nulls last, c.created_at;
$$;

-- ============================================================
-- Public read models
-- ============================================================
-- Review record without the identity of the person who asked for it.
create view public.fact_reviews_v with (security_invoker = false) as
select r.id, r.post_id, r.claim_id, r.request_text, r.status, r.decision_text, r.decided_at, r.created_at,
  (r.requested_by = auth.uid()) as requested_by_me,
  (select a.status from public.appeals a where a.review_id = r.id order by a.created_at desc limit 1) as appeal_status,
  (select a.decision_text from public.appeals a where a.review_id = r.id order by a.created_at desc limit 1) as appeal_decision,
  exists (select 1 from public.posts p where p.id = r.post_id and p.author_id = auth.uid()) as on_my_post
from public.fact_reviews r
join public.posts p2 on p2.id = r.post_id
where not p2.hidden or p2.author_id = auth.uid() or public.is_moderator();

-- Posts read model, now with transparency signals (columns appended).
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
  p.search,
  p.nature,
  (select count(*) from public.claims cl where cl.post_id = p.id)::int as claim_count,
  -- BLUE: extra context exists (context evidence, or a review that added context)
  (exists (select 1 from public.claim_evidence e join public.claims cl on cl.id = e.claim_id
           where cl.post_id = p.id and e.stance = 'context')
   or exists (select 1 from public.fact_reviews r where r.post_id = p.id and r.status = 'context')) as signal_context,
  -- AMBER: a conflicting claim exists elsewhere (automatic, not a verdict)
  exists (select 1 from public.claims a join public.claims b
            on b.event_tag = a.event_tag and b.post_id <> a.post_id
          join public.posts pb on pb.id = b.post_id and not pb.hidden
          where a.post_id = p.id and a.event_tag is not null and (
            (a.metric = b.metric and a.value is not null and b.value is not null
              and greatest(a.value, b.value) > 1.5 * nullif(least(a.value, b.value), 0))
            or (a.occurred_on is not null and b.occurred_on is not null and abs(a.occurred_on - b.occurred_on) > 2))) as signal_conflict,
  -- RED: a documented correction from a human review that was not overturned
  exists (select 1 from public.fact_reviews r where r.post_id = p.id and r.status = 'correction') as signal_correction
from public.posts p
where p.author_id = auth.uid() or not p.hidden;

-- ============================================================
-- Security
-- ============================================================
alter table public.claims enable row level security;
alter table public.claim_evidence enable row level security;
alter table public.fact_reviews enable row level security;
alter table public.appeals enable row level security;

create policy "claims readable" on public.claims for select using (true);
create policy "authors add claims" on public.claims for insert
  with check (created_by = auth.uid() and public.owns_claim_post(post_id));
create policy "authors remove claims" on public.claims for delete using (public.owns_claim_post(post_id));

create policy "evidence readable" on public.claim_evidence for select using (true);
create policy "anyone signed in adds evidence" on public.claim_evidence for insert with check (added_by = auth.uid());
create policy "remove own evidence" on public.claim_evidence for delete using (added_by = auth.uid() or public.is_moderator());

create policy "request a review" on public.fact_reviews for insert
  with check (requested_by = auth.uid() and status = 'open' and decision_text is null);
create policy "requester and reviewers read" on public.fact_reviews for select
  using (requested_by = auth.uid() or public.is_moderator());
create policy "reviewers decide" on public.fact_reviews for update using (public.is_moderator());

create policy "author appeals" on public.appeals for insert
  with check (author_id = auth.uid() and status = 'open' and decision_text is null and public.can_appeal(review_id));
create policy "appellant and reviewers read" on public.appeals for select
  using (author_id = auth.uid() or public.is_moderator());
create policy "reviewers decide appeals" on public.appeals for update using (public.is_moderator());

grant select on public.claims, public.claim_evidence, public.fact_reviews_v, public.posts_v to anon, authenticated;
grant insert, delete on public.claims, public.claim_evidence to authenticated;
grant select, insert on public.fact_reviews, public.appeals to authenticated;
grant update (status, decision_text) on public.fact_reviews, public.appeals to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on function public.claim_conflicts(bigint), public.event_claims(text) to anon, authenticated;
grant execute on function public.owns_claim_post(bigint), public.can_appeal(bigint) to authenticated;

-- Reviewers also need to see content reports and resolve them.
grant update (status, decision, decided_at) on public.reports to authenticated;
create policy "moderators hide comments" on public.comments for update using (public.is_moderator());
grant update (hidden) on public.comments to authenticated;
