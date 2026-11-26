-- Verum Agora, Phase 4: moderation records, public transparency figures, messaging privacy,
-- archive search support. Additive only; existing data is kept.

-- ============================================================
-- Moderation records (append-only log of every moderation decision)
-- ============================================================
create table if not exists public.moderation_log (
  id bigint generated always as identity primary key,
  moderator_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in (
    'report_actioned', 'report_dismissed',
    'review_no_action', 'review_context', 'review_correction', 'review_overturned',
    'appeal_upheld', 'appeal_overturned',
    'content_hidden', 'content_restored')),
  target_type text not null,
  target_id text not null,
  category text,
  statement text,
  created_at timestamptz not null default now()
);
create index if not exists moderation_log_time_idx on public.moderation_log (created_at desc);

alter table public.moderation_log enable row level security;
drop policy if exists "moderators read the log" on public.moderation_log;
create policy "moderators read the log" on public.moderation_log for select using (public.is_moderator());
-- No insert, update or delete policies: rows are written only by the triggers below.
revoke insert, update, delete on public.moderation_log from anon, authenticated;
grant select on public.moderation_log to authenticated;

create or replace function public.log_moderation(a text, ttype text, tid text, cat text, stmt text)
returns void language sql security definer set search_path = '' as $$
  insert into public.moderation_log (moderator_id, action, target_type, target_id, category, statement)
  values (auth.uid(), a, ttype, tid, cat, stmt);
$$;
revoke execute on function public.log_moderation(text, text, text, text, text) from public, anon, authenticated;

create or replace function public.log_report_decision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('actioned', 'dismissed') then
    perform public.log_moderation('report_' || new.status, new.target_type, new.target_id, new.reason, new.decision);
  end if;
  return new;
end $$;
drop trigger if exists log_reports on public.reports;
create trigger log_reports after update on public.reports for each row execute function public.log_report_decision();

create or replace function public.log_review_decision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status <> 'open' then
    perform public.log_moderation('review_' || new.status, 'post', new.post_id::text, 'fact_review', new.decision_text);
  end if;
  return new;
end $$;
drop trigger if exists log_reviews on public.fact_reviews;
create trigger log_reviews after update on public.fact_reviews for each row execute function public.log_review_decision();

create or replace function public.log_appeal_decision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status <> 'open' then
    perform public.log_moderation('appeal_' || new.status, 'review', new.review_id::text, 'appeal', new.decision_text);
  end if;
  return new;
end $$;
drop trigger if exists log_appeals on public.appeals;
create trigger log_appeals after update on public.appeals for each row execute function public.log_appeal_decision();

-- Hiding or restoring content by a moderator (authors deleting their own content is not logged).
create or replace function public.log_hidden_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.hidden is distinct from old.hidden and public.is_moderator() and auth.uid() is distinct from new.author_id then
    perform public.log_moderation(case when new.hidden then 'content_hidden' else 'content_restored' end,
      tg_argv[0], new.id::text, null, null);
  end if;
  return new;
end $$;
drop trigger if exists log_hidden_posts on public.posts;
create trigger log_hidden_posts after update of hidden on public.posts for each row execute function public.log_hidden_change('post');
drop trigger if exists log_hidden_stories on public.stories;
create trigger log_hidden_stories after update of hidden on public.stories for each row execute function public.log_hidden_change('story');
drop trigger if exists log_hidden_comments on public.comments;
create trigger log_hidden_comments after update of hidden on public.comments for each row execute function public.log_hidden_change('comment');

-- ============================================================
-- Public transparency figures (aggregated, no personal data)
-- ============================================================
create or replace function public.transparency_stats(since timestamptz default now() - interval '365 days')
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'since', since,
    'reports_by_reason', coalesce((select jsonb_object_agg(reason, n) from (
      select reason, count(*) n from public.reports where created_at >= since group by reason) x), '{}'::jsonb),
    'reports_by_status', coalesce((select jsonb_object_agg(status, n) from (
      select status, count(*) n from public.reports where created_at >= since group by status) x), '{}'::jsonb),
    'reviews_by_status', coalesce((select jsonb_object_agg(status, n) from (
      select status, count(*) n from public.fact_reviews where created_at >= since group by status) x), '{}'::jsonb),
    'appeals_by_status', coalesce((select jsonb_object_agg(status, n) from (
      select status, count(*) n from public.appeals where created_at >= since group by status) x), '{}'::jsonb),
    'median_hours_to_decision', (select round((percentile_cont(0.5) within group (order by extract(epoch from decided_at - created_at) / 3600))::numeric, 1)
      from public.reports where decided_at is not null and created_at >= since),
    'content_hidden', (select count(*) from public.moderation_log where action = 'content_hidden' and created_at >= since),
    'contributions', (select count(*) from public.posts where created_at >= since),
    'contributors', (select count(distinct author_id) from public.posts where created_at >= since)
  );
$$;
grant execute on function public.transparency_stats(timestamptz) to anon, authenticated;

-- ============================================================
-- Messaging privacy: who may start a conversation with me
-- ============================================================
alter table public.profiles add column if not exists message_privacy text not null default 'everyone'
  check (message_privacy in ('everyone', 'following', 'nobody'));
grant update (message_privacy) on public.profiles to authenticated;

create or replace function public.start_conversation(other uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  conv uuid;
  pref text;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if other = me then raise exception 'Cannot message yourself'; end if;
  select message_privacy into pref from public.profiles where id = other;
  if not found then raise exception 'User not found'; end if;
  if exists (select 1 from public.blocks where (blocker_id = other and blocked_id = me)
                                         or (blocker_id = me and blocked_id = other)) then
    raise exception 'Messaging is not possible with this person';
  end if;

  select a.conversation_id into conv
  from public.conversation_members a
  join public.conversation_members b on b.conversation_id = a.conversation_id
  where a.user_id = me and b.user_id = other
  limit 1;

  -- Existing conversations continue; the setting governs new ones.
  if conv is null then
    if pref = 'nobody' then raise exception 'This person does not accept new messages'; end if;
    if pref = 'following' and not exists (select 1 from public.follows where follower_id = other and followee_id = me) then
      raise exception 'This person only accepts messages from people they follow';
    end if;
    insert into public.conversations default values returning id into conv;
    insert into public.conversation_members (conversation_id, user_id) values (conv, me), (conv, other);
  end if;
  return conv;
end $$;
revoke execute on function public.start_conversation(uuid) from anon, public;
grant execute on function public.start_conversation(uuid) to authenticated;

-- ============================================================
-- Acknowledgments: what someone has added to the shared record (no popularity figures)
-- ============================================================
create or replace function public.contribution_record(uid uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'evidence', (select count(*) from public.claim_evidence where added_by = uid),
    'claims', (select count(*) from public.claims c join public.posts p on p.id = c.post_id where p.author_id = uid and not p.hidden),
    'research', (select count(*) from public.posts where author_id = uid and kind = 'research' and not hidden),
    'articles', (select count(*) from public.posts where author_id = uid and kind = 'article' and not hidden),
    'sourced', (select count(*) from public.posts where author_id = uid and not hidden and jsonb_array_length(sources) > 0),
    'answers', (select count(*) from public.comments c join public.posts p on p.id = c.target_id
                where c.target_type = 'post' and p.kind = 'question' and c.author_id = uid and not c.hidden and p.author_id <> uid)
  );
$$;
grant execute on function public.contribution_record(uuid) to anon, authenticated;

-- Archive: index for date-range browsing.
create index if not exists posts_created_idx on public.posts (created_at desc);

-- ============================================================
-- More precise report categories (DSA-relevant), existing reports keep their category
-- ============================================================
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check check (reason in (
  'illegal', 'harassment', 'danger', 'privacy', 'false', 'spam', 'other',
  'child_safety', 'threat', 'hate', 'impersonation', 'manipulation'));
