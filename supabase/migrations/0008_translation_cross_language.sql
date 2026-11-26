-- Verum Agora, Phase 5: labelled automatic translation and cross-language connections.
-- Additive; existing data is kept. Safe to run more than once.

-- ============================================================
-- Cached automatic translations (written only by the translate Edge Function)
-- ============================================================
create table if not exists public.translations (
  post_id bigint not null references public.posts (id) on delete cascade,
  lang text not null check (lang ~ '^[a-z]{2}$'),
  title text,
  body text not null,
  engine text not null check (engine in ('deepl', 'other')),
  created_at timestamptz not null default now(),
  primary key (post_id, lang)
);
alter table public.translations enable row level security;
drop policy if exists "translations follow post visibility" on public.translations;
create policy "translations follow post visibility" on public.translations for select using (
  exists (select 1 from public.posts p where p.id = post_id and (not p.hidden or p.author_id = auth.uid() or public.is_moderator())));
grant select on public.translations to anon, authenticated;
revoke insert, update, delete on public.translations from anon, authenticated;

-- When the author edits the text, old translations are discarded so they never contradict the original.
create or replace function public.drop_stale_translations() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.title is distinct from old.title or new.body is distinct from old.body then
    delete from public.translations where post_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists stale_translations on public.posts;
create trigger stale_translations after update of title, body on public.posts
  for each row execute function public.drop_stale_translations();

-- ============================================================
-- Equivalent terms across languages: topic tags, event tags and metrics
-- e.g. "schulfinanzierung" -> "school funding", "lehrkräfte" -> "teachers"
-- ============================================================
create table if not exists public.term_links (
  term text primary key check (term = lower(term) and char_length(term) between 2 and 60),
  canonical text not null check (canonical = lower(canonical) and char_length(canonical) between 2 and 60),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (term <> canonical)
);
create index if not exists term_links_canonical_idx on public.term_links (canonical);

create or replace function public.canon(t text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select l.canonical from public.term_links l where l.term = lower(btrim(t))), lower(btrim(t)));
$$;
grant execute on function public.canon(text) to anon, authenticated;

-- Keep groups flat: every term points straight at one canonical name.
create or replace function public.flatten_term_link() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.term := lower(btrim(new.term));
  new.canonical := public.canon(new.canonical);
  if new.term = new.canonical then raise exception 'These terms are already linked'; end if;
  new.created_by := auth.uid();
  update public.term_links set canonical = new.canonical where canonical = new.term;
  return new;
end $$;
drop trigger if exists flatten_term_links on public.term_links;
create trigger flatten_term_links before insert on public.term_links for each row execute function public.flatten_term_link();
drop trigger if exists rl_term_links on public.term_links;
create trigger rl_term_links before insert on public.term_links for each row execute function public.rate_limit('created_by', '30', '1 hour');

alter table public.term_links enable row level security;
drop policy if exists "term links readable" on public.term_links;
create policy "term links readable" on public.term_links for select using (true);
drop policy if exists "signed-in users link terms" on public.term_links;
create policy "signed-in users link terms" on public.term_links for insert with check (auth.uid() is not null);
drop policy if exists "moderators unlink terms" on public.term_links;
create policy "moderators unlink terms" on public.term_links for delete using (public.is_moderator());
grant select on public.term_links to anon, authenticated;
grant insert (term, canonical), delete on public.term_links to authenticated;

-- All names that mean the same as t (including t itself).
create or replace function public.equivalent_terms(t text) returns text[]
language sql stable security definer set search_path = '' as $$
  select array(select distinct x from (
    select public.canon(t) as x
    union select l.term from public.term_links l where l.canonical = public.canon(t)
    union select lower(btrim(t))) s order by 1);
$$;
grant execute on function public.equivalent_terms(text) to anon, authenticated;

-- ============================================================
-- Connections now match across languages
-- ============================================================
create or replace function public.related_posts(pid bigint, max_results int default 8)
returns table (post_id bigint, score numeric, shared_subjects int, shared_subtopics int,
               shared_tags text[], same_country boolean)
language sql stable security definer set search_path = '' as $$
  with me as (
    select p.id, p.country, p.search,
      array(select subject_id from public.post_subjects where post_id = p.id) as subj,
      array(select subtopic_id from public.post_subtopics where post_id = p.id) as subt,
      array(select public.canon(tag) from public.post_tags where post_id = p.id) as tg
    from public.posts p
    where p.id = pid and (not p.hidden or p.author_id = auth.uid())
  ),
  cand as (
    select o.id, o.country, o.created_at,
      (select count(*) from public.post_subjects s, me where s.post_id = o.id and s.subject_id = any (me.subj))::int as ss,
      (select count(*) from public.post_subtopics s, me where s.post_id = o.id and s.subtopic_id = any (me.subt))::int as st,
      array(select t.tag from public.post_tags t, me where t.post_id = o.id and public.canon(t.tag) = any (me.tg)) as tg,
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

create or replace function public.claim_conflicts(pid bigint)
returns table (claim_id bigint, other_claim_id bigint, other_post_id bigint, kind text,
               mine_value numeric, other_value numeric, ratio numeric)
language sql stable security definer set search_path = '' as $$
  select a.id, b.id, b.post_id,
    case
      when a.metric is not null and public.canon(a.metric) = public.canon(b.metric) and a.value is not null and b.value is not null
           and greatest(a.value, b.value) > 1.5 * nullif(least(a.value, b.value), 0) then 'number'
      when a.occurred_on is not null and b.occurred_on is not null and abs(a.occurred_on - b.occurred_on) > 2 then 'date'
      else 'place'
    end,
    a.value, b.value,
    round(greatest(a.value, b.value) / nullif(least(a.value, b.value), 0), 2)
  from public.claims a
  join public.claims b on public.canon(b.event_tag) = public.canon(a.event_tag) and b.id <> a.id and b.post_id <> a.post_id
  join public.posts pa on pa.id = a.post_id
  join public.posts pb on pb.id = b.post_id
  where a.post_id = pid and a.event_tag is not null and not pb.hidden
    and (not pa.hidden or pa.author_id = auth.uid())
    and (
      (a.metric is not null and public.canon(a.metric) = public.canon(b.metric) and a.value is not null and b.value is not null
        and (least(a.value, b.value) = 0 and greatest(a.value, b.value) > 0
             or greatest(a.value, b.value) > 1.5 * nullif(least(a.value, b.value), 0)))
      or (a.occurred_on is not null and b.occurred_on is not null and abs(a.occurred_on - b.occurred_on) > 2)
      or (a.location is not null and b.location is not null and lower(a.location) <> lower(b.location)
          and public.canon(a.metric) is not distinct from public.canon(b.metric))
    );
$$;

create or replace function public.event_claims(tag text)
returns table (claim_id bigint, post_id bigint, statement text, metric text, value numeric, unit text,
               occurred_on date, location text, created_at timestamptz,
               supports int, contradicts int, context int, independent_sources int)
language sql stable security definer set search_path = '' as $$
  select c.id, c.post_id, c.statement, public.canon(c.metric), c.value, c.unit, c.occurred_on, c.location, c.created_at,
    (select count(*) from public.claim_evidence e where e.claim_id = c.id and e.stance = 'supports')::int,
    (select count(*) from public.claim_evidence e where e.claim_id = c.id and e.stance = 'contradicts')::int,
    (select count(*) from public.claim_evidence e where e.claim_id = c.id and e.stance = 'context')::int,
    (select count(distinct e.domain) from public.claim_evidence e where e.claim_id = c.id and e.stance = 'supports')::int
  from public.claims c join public.posts p on p.id = c.post_id
  where public.canon(c.event_tag) = public.canon(tag) and not p.hidden
  order by 4 nulls last, c.value nulls last, c.created_at;
$$;

-- Same columns as before; only the conflict signal now matches equivalent terms.
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
  (exists (select 1 from public.claim_evidence e join public.claims cl on cl.id = e.claim_id
           where cl.post_id = p.id and e.stance = 'context')
   or exists (select 1 from public.fact_reviews r where r.post_id = p.id and r.status = 'context')) as signal_context,
  exists (select 1 from public.claims a join public.claims b
            on public.canon(b.event_tag) = public.canon(a.event_tag) and b.post_id <> a.post_id
          join public.posts pb on pb.id = b.post_id and not pb.hidden
          where a.post_id = p.id and a.event_tag is not null and (
            (public.canon(a.metric) = public.canon(b.metric) and a.value is not null and b.value is not null
              and greatest(a.value, b.value) > 1.5 * nullif(least(a.value, b.value), 0))
            or (a.occurred_on is not null and b.occurred_on is not null and abs(a.occurred_on - b.occurred_on) > 2))) as signal_conflict,
  exists (select 1 from public.fact_reviews r where r.post_id = p.id and r.status = 'correction') as signal_correction
from public.posts p
where p.author_id = auth.uid() or not p.hidden;

-- The translate Edge Function writes the cache with the service role; newer projects need an explicit grant.
grant select, insert, update, delete on public.translations to service_role;
