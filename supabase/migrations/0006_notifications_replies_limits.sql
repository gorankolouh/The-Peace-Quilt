-- Verum Agora, Phase 3: notifications, comment replies, rate limits. Additive only.

-- ============================================================
-- Comment replies (one level of threading)
-- ============================================================
alter table public.comments add column if not exists parent_id bigint references public.comments (id) on delete cascade;
create index if not exists comments_parent_idx on public.comments (parent_id);

create or replace function public.check_reply()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  if new.parent_id is null then return new; end if;
  select target_type, target_id, parent_id into p from public.comments where id = new.parent_id;
  if not found then raise exception 'The comment you reply to no longer exists'; end if;
  if p.target_type <> new.target_type or p.target_id <> new.target_id then
    raise exception 'A reply must belong to the same discussion';
  end if;
  if p.parent_id is not null then new.parent_id := p.parent_id; end if; -- keep threads one level deep
  return new;
end;
$$;
create trigger comments_check_reply before insert on public.comments
  for each row execute function public.check_reply();

-- ============================================================
-- Rate limits and duplicate protection
-- ============================================================
create or replace function public.rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  who uuid;
  n int;
  lim int;
  win interval;
  col text;
begin
  col := tg_argv[0];
  lim := tg_argv[1]::int;
  win := tg_argv[2]::interval;
  execute format('select ($1).%I', col) using new into who;
  if who is null then return new; end if;
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2',
                 tg_table_schema, tg_table_name, col) using who, win into n;
  if n >= lim then
    raise exception 'Slow down: you have reached the limit for this action. Please try again later.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger rl_posts before insert on public.posts for each row execute function public.rate_limit('author_id', '20', '1 hour');
create trigger rl_stories before insert on public.stories for each row execute function public.rate_limit('author_id', '10', '1 hour');
create trigger rl_comments before insert on public.comments for each row execute function public.rate_limit('author_id', '60', '1 hour');
create trigger rl_messages before insert on public.messages for each row execute function public.rate_limit('sender_id', '120', '1 hour');
create trigger rl_reports before insert on public.reports for each row execute function public.rate_limit('reporter_id', '20', '1 hour');
create trigger rl_reviews before insert on public.fact_reviews for each row execute function public.rate_limit('requested_by', '10', '1 hour');
create trigger rl_evidence before insert on public.claim_evidence for each row execute function public.rate_limit('added_by', '60', '1 hour');
create trigger rl_follows before insert on public.follows for each row execute function public.rate_limit('follower_id', '200', '1 hour');
create trigger rl_likes before insert on public.likes for each row execute function public.rate_limit('user_id', '300', '1 hour');

create or replace function public.no_duplicate_post()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.posts where author_id = new.author_id and body = new.body
             and created_at > now() - interval '10 minutes') then
    raise exception 'You just published the same text. Duplicate posts are not allowed.';
  end if;
  return new;
end;
$$;
create trigger posts_no_duplicate before insert on public.posts for each row execute function public.no_duplicate_post();

create index if not exists comments_author_time_idx on public.comments (author_id, created_at);
create index if not exists messages_sender_time_idx on public.messages (sender_id, created_at);
create index if not exists likes_user_time_idx on public.likes (user_id, created_at);
create index if not exists follows_follower_time_idx on public.follows (follower_id, created_at);
create index if not exists posts_author_time_idx on public.posts (author_id, created_at);

-- ============================================================
-- Notifications
-- ============================================================
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'follow', 'comment', 'reply', 'like', 'evidence', 'review_requested', 'review_decided',
    'appeal_decided', 'report_decided', 'content_restricted')),
  actor_id uuid references public.profiles (id) on delete set null,
  target_type text check (target_type in ('post', 'story', 'profile')),
  target_id bigint,
  text text check (text is null or char_length(text) <= 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "mark own read" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own" on public.notifications for delete using (user_id = auth.uid());
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify(uid uuid, k text, actor uuid, ttype text, tid bigint, msg text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if uid is null or uid = actor then return; end if;
  if exists (select 1 from public.blocks where blocker_id = uid and blocked_id = actor) then return; end if;
  insert into public.notifications (user_id, kind, actor_id, target_type, target_id, text)
  values (uid, k, actor, ttype, tid, left(msg, 500));
end;
$$;
revoke execute on function public.notify(uuid, text, uuid, text, bigint, text) from public, anon, authenticated;

create or replace function public.target_author(ttype text, tid bigint)
returns uuid language sql stable security definer set search_path = '' as $$
  select case ttype
    when 'post' then (select author_id from public.posts where id = tid)
    when 'story' then (select author_id from public.stories where id = tid)
  end;
$$;

create or replace function public.on_follow() returns trigger language plpgsql security definer set search_path = '' as $$
begin perform public.notify(new.followee_id, 'follow', new.follower_id, 'profile', null, null); return new; end; $$;
create trigger notify_follow after insert on public.follows for each row execute function public.on_follow();

create or replace function public.on_comment() returns trigger language plpgsql security definer set search_path = '' as $$
declare parent_author uuid;
begin
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    perform public.notify(parent_author, 'reply', new.author_id, new.target_type, new.target_id, new.body);
  end if;
  if public.target_author(new.target_type, new.target_id) is distinct from parent_author then
    perform public.notify(public.target_author(new.target_type, new.target_id), 'comment', new.author_id, new.target_type, new.target_id, new.body);
  end if;
  return new;
end; $$;
create trigger notify_comment after insert on public.comments for each row execute function public.on_comment();

create or replace function public.on_like() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- one like notification per person per item
  if not exists (select 1 from public.notifications where kind = 'like' and actor_id = new.user_id
                 and target_type = new.target_type and target_id = new.target_id) then
    perform public.notify(public.target_author(new.target_type, new.target_id), 'like', new.user_id, new.target_type, new.target_id, null);
  end if;
  return new;
end; $$;
create trigger notify_like after insert on public.likes for each row execute function public.on_like();

create or replace function public.on_evidence() returns trigger language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select cl.post_id, p.author_id, cl.statement into c from public.claims cl join public.posts p on p.id = cl.post_id where cl.id = new.claim_id;
  perform public.notify(c.author_id, 'evidence', new.added_by, 'post', c.post_id,
    case new.stance when 'contradicts' then 'Contradicting evidence on: ' when 'supports' then 'Supporting evidence on: ' else 'Context added to: ' end || c.statement);
  return new;
end; $$;
create trigger notify_evidence after insert on public.claim_evidence for each row execute function public.on_evidence();

create or replace function public.on_review() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(public.target_author('post', new.post_id), 'review_requested', null, 'post', new.post_id,
      'A factual claim in your contribution was sent for review. You can add evidence while it is open.');
  elsif new.status is distinct from old.status then
    perform public.notify(public.target_author('post', new.post_id), 'review_decided', null, 'post', new.post_id, new.decision_text);
    perform public.notify(new.requested_by, 'review_decided', null, 'post', new.post_id, new.decision_text);
  end if;
  return new;
end; $$;
create trigger notify_review after insert or update on public.fact_reviews for each row execute function public.on_review();

create or replace function public.on_appeal() returns trigger language plpgsql security definer set search_path = '' as $$
declare pid bigint;
begin
  if new.status is distinct from old.status then
    select post_id into pid from public.fact_reviews where id = new.review_id;
    perform public.notify(new.author_id, 'appeal_decided', null, 'post', pid,
      case new.status when 'overturned' then 'Your appeal was successful: ' else 'Your appeal was not successful: ' end || new.decision_text);
  end if;
  return new;
end; $$;
create trigger notify_appeal after update on public.appeals for each row execute function public.on_appeal();

-- DSA: tell the reporter the outcome, and give the author a statement of reasons when content is restricted.
create or replace function public.on_report() returns trigger language plpgsql security definer set search_path = '' as $$
declare author uuid;
begin
  if new.status is distinct from old.status and new.status <> 'open' then
    perform public.notify(new.reporter_id, 'report_decided', null, null, null,
      case new.status when 'actioned' then 'We acted on your report: ' else 'We reviewed your report and found no violation: ' end || coalesce(new.decision, ''));
    if new.status = 'actioned' and new.target_type in ('post', 'story') then
      author := public.target_author(new.target_type, new.target_id::bigint);
      perform public.notify(author, 'content_restricted', null, new.target_type, new.target_id::bigint,
        'Your content was hidden after a report. Reason: ' || coalesce(new.decision, '') ||
        ' You can contest this decision by replying through the contact address in the Terms.');
    elsif new.status = 'actioned' and new.target_type = 'comment' then
      select author_id into author from public.comments where id = new.target_id::bigint;
      perform public.notify(author, 'content_restricted', null, null, null,
        'Your comment was hidden after a report. Reason: ' || coalesce(new.decision, ''));
    end if;
  end if;
  return new;
end; $$;
create trigger notify_report after update on public.reports for each row execute function public.on_report();

alter publication supabase_realtime add table public.notifications;
