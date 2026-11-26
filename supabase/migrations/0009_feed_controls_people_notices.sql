-- Verum Agora, Phase 6: feed controls, people by subject, connected discussions,
-- notices of illegal content without an account (DSA Art. 16). Additive; safe to run more than once.

-- ============================================================
-- Feed controls the user chooses (stored with the profile)
-- ============================================================
alter table public.profiles add column if not exists feed_languages text[] not null default '{}';
alter table public.profiles add column if not exists feed_sourced_only boolean not null default false;
alter table public.profiles add column if not exists muted_subjects smallint[] not null default '{}';
grant update (feed_languages, feed_sourced_only, muted_subjects) on public.profiles to authenticated;

-- ============================================================
-- People contributing to a subject: ordered by their latest contribution, never by followers
-- ============================================================
create or replace function public.subject_people(sid smallint, max_results int default 12)
returns table (user_id uuid, contributions int, last_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.author_id, count(*)::int, max(p.created_at)
  from public.posts p
  join public.post_subjects s on s.post_id = p.id and s.subject_id = sid
  join public.profiles pr on pr.id = p.author_id and pr.username is not null
  where not p.hidden and p.created_at > now() - interval '180 days'
    and (auth.uid() is null or p.author_id <> auth.uid())
    and not exists (select 1 from public.blocks b where (b.blocker_id = auth.uid() and b.blocked_id = p.author_id)
                                                    or (b.blocker_id = p.author_id and b.blocked_id = auth.uid()))
  group by p.author_id
  order by max(p.created_at) desc
  limit greatest(1, least(max_results, 30));
$$;
grant execute on function public.subject_people(smallint, int) to anon, authenticated;

-- ============================================================
-- Connected discussions: topics and events that link several contributions,
-- grouped across languages through term_links
-- ============================================================
create or replace function public.connected_topics(max_results int default 60)
returns table (kind text, topic text, contributions int, languages text[], countries text[], last_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with t as (
    select 'topic'::text as kind, public.canon(pt.tag) as topic, p.id, p.language, p.country, p.created_at
    from public.post_tags pt join public.posts p on p.id = pt.post_id and not p.hidden
    union all
    select 'event', public.canon(c.event_tag), p.id, p.language, p.country, p.created_at
    from public.claims c join public.posts p on p.id = c.post_id and not p.hidden
    where c.event_tag is not null
  )
  select kind, topic, count(distinct id)::int,
    array_agg(distinct language) filter (where language is not null),
    coalesce(array_agg(distinct country) filter (where country is not null), '{}'),
    max(created_at)
  from t
  group by kind, topic
  having count(distinct id) >= 2
  order by max(created_at) desc
  limit greatest(1, least(max_results, 200));
$$;
grant execute on function public.connected_topics(int) to anon, authenticated;

-- ============================================================
-- Notices from people without an account (DSA Art. 16)
-- ============================================================
alter table public.reports add column if not exists notifier_name text check (notifier_name is null or char_length(notifier_name) <= 120);
alter table public.reports add column if not exists notifier_email text check (notifier_email is null or (char_length(notifier_email) <= 200 and notifier_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
alter table public.reports add column if not exists content_url text check (content_url is null or char_length(content_url) <= 500);
alter table public.reports add column if not exists good_faith boolean not null default false;

grant insert (reporter_id, target_type, target_id, reason, details, notifier_name, notifier_email, content_url, good_faith)
  on public.reports to anon;
grant insert (notifier_name, notifier_email, content_url, good_faith) on public.reports to authenticated;

drop policy if exists "file a report" on public.reports;
create policy "file a report" on public.reports for insert
  with check (reporter_id = auth.uid() or (reporter_id is null and auth.uid() is null));

-- Anonymous notices must confirm good faith, and are capped platform-wide to stop flooding.
create or replace function public.guard_anonymous_notice() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.reporter_id is null then
    if not new.good_faith then raise exception 'Please confirm that your notice is accurate and made in good faith'; end if;
    if char_length(coalesce(new.details, '')) < 20 and new.reason <> 'child_safety' then
      raise exception 'Please explain in a few sentences why the content is illegal';
    end if;
    if (select count(*) from public.reports where reporter_id is null and created_at > now() - interval '1 hour') >= 30 then
      raise exception 'Too many notices right now. Please try again later.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_anon_notice on public.reports;
create trigger guard_anon_notice before insert on public.reports for each row execute function public.guard_anonymous_notice();
