-- The Peace Quilt: initial schema
-- Run once in Supabase: SQL Editor -> New query -> paste this file -> Run.

-- ============================================================
-- Reference data
-- ============================================================
create type public.story_consent as enum ('public', 'pseudonymous', 'researchers');
create type public.post_kind as enum ('post', 'article');
create type public.media_kind as enum ('photo', 'video', 'audio', 'document');

create table public.themes (
  id smallint primary key,
  name text not null,
  short text not null
);

create table public.regions (
  id smallint primary key,
  name text not null
);

insert into public.themes (id, name, short) values
  (1, 'Protecting a hospital', 'Hospital'),
  (2, 'A chain of local agreements', 'Local agreements'),
  (3, 'Women''s cross-community mediation', 'Women''s mediation'),
  (4, 'Safe passage', 'Safe passage'),
  (5, 'Reopening schools', 'Schools');

-- Placeholder regions. Replace with the real, deliberately coarse regions before launch.
insert into public.regions (id, name) values
  (1, 'Riverside district'),
  (2, 'Hill villages'),
  (3, 'Old town'),
  (4, 'Border crossing'),
  (5, 'Coastal camp');

-- ============================================================
-- Profiles
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '' check (char_length(display_name) <= 60),
  role text not null default 'Member'
    check (role in ('Doctor', 'Mother', 'Mediator', 'Teacher', 'Youth', 'Elder', 'Researcher', 'Member')),
  bio text not null default '' check (char_length(bio) <= 280),
  is_researcher boolean not null default false,
  is_moderator boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1),
      ''
    ), 60)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_researcher()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_researcher from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_moderator from public.profiles where id = auth.uid()), false);
$$;

-- ============================================================
-- Stories (pieces of the quilt) and posts
-- ============================================================
create table public.stories (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 90),
  body text not null check (char_length(body) between 10 and 2000),
  role text not null check (role in ('Doctor', 'Mother', 'Mediator', 'Teacher', 'Youth', 'Elder')),
  theme_id smallint not null references public.themes (id),
  region_id smallint not null references public.regions (id),
  consent public.story_consent not null default 'public',
  media_path text,
  media_kind public.media_kind check (media_kind is null or media_kind in ('photo', 'audio')),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index stories_created_idx on public.stories (created_at desc);
create index stories_author_idx on public.stories (author_id);

create table public.posts (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind public.post_kind not null default 'post',
  title text check (title is null or char_length(title) between 3 and 140),
  body text not null check (char_length(body) between 1 and 20000),
  media_path text,
  media_kind public.media_kind,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check (kind = 'post' or title is not null),
  check (kind = 'article' or char_length(body) <= 1000)
);
create index posts_created_idx on public.posts (created_at desc);
create index posts_author_idx on public.posts (author_id);

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('story', 'post')),
  target_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index likes_target_idx on public.likes (target_type, target_id);

create table public.comments (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('story', 'post')),
  target_id bigint not null,
  body text not null check (char_length(body) between 1 and 1000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_target_idx on public.comments (target_type, target_id, created_at);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

-- Public read models. They hide the author of pseudonymous stories and
-- researcher-only stories from everyone except the author (and researchers).
create view public.stories_v with (security_invoker = false) as
select
  s.id, s.title, s.body, s.role, s.theme_id, s.region_id, s.consent,
  s.media_path, s.media_kind, s.created_at,
  case when s.consent = 'public' or s.author_id = auth.uid() then s.author_id end as author_id,
  (s.author_id = auth.uid()) as is_mine,
  (select count(*) from public.likes l where l.target_type = 'story' and l.target_id = s.id)::int as like_count,
  (select count(*) from public.comments c where c.target_type = 'story' and c.target_id = s.id and not c.hidden)::int as comment_count,
  exists (select 1 from public.likes l where l.target_type = 'story' and l.target_id = s.id and l.user_id = auth.uid()) as liked
from public.stories s
where s.author_id = auth.uid()
   or (not s.hidden and (s.consent <> 'researchers' or public.is_researcher()));

create view public.posts_v with (security_invoker = false) as
select
  p.id, p.author_id, p.kind, p.title, p.body, p.media_path, p.media_kind, p.created_at,
  (p.author_id = auth.uid()) as is_mine,
  (select count(*) from public.likes l where l.target_type = 'post' and l.target_id = p.id)::int as like_count,
  (select count(*) from public.comments c where c.target_type = 'post' and c.target_id = p.id and not c.hidden)::int as comment_count,
  exists (select 1 from public.likes l where l.target_type = 'post' and l.target_id = p.id and l.user_id = auth.uid()) as liked
from public.posts p
where p.author_id = auth.uid() or not p.hidden;

-- ============================================================
-- Messaging (one-to-one)
-- ============================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, created_at);

create or replace function public.is_member(conv uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

create or replace function public.start_conversation(other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  conv uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if other = me then raise exception 'Cannot message yourself'; end if;
  if not exists (select 1 from public.profiles where id = other) then
    raise exception 'User not found';
  end if;
  if exists (select 1 from public.blocks where (blocker_id = other and blocked_id = me)
                                         or (blocker_id = me and blocked_id = other)) then
    raise exception 'Messaging is not possible with this person';
  end if;

  select a.conversation_id into conv
  from public.conversation_members a
  join public.conversation_members b on b.conversation_id = a.conversation_id
  where a.user_id = me and b.user_id = other
  limit 1;

  if conv is null then
    insert into public.conversations default values returning id into conv;
    insert into public.conversation_members (conversation_id, user_id) values (conv, me), (conv, other);
  end if;
  return conv;
end;
$$;

create or replace function public.my_conversations()
returns table (
  conversation_id uuid,
  other_id uuid,
  last_body text,
  last_at timestamptz,
  last_sender uuid,
  unread int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.conversation_id,
    o.user_id as other_id,
    lm.body, lm.created_at, lm.sender_id,
    (select count(*) from public.messages x
      where x.conversation_id = m.conversation_id
        and x.sender_id <> auth.uid()
        and x.created_at > m.last_read_at)::int
  from public.conversation_members m
  join public.conversation_members o
    on o.conversation_id = m.conversation_id and o.user_id <> m.user_id
  left join lateral (
    select body, created_at, sender_id from public.messages
    where conversation_id = m.conversation_id
    order by created_at desc limit 1
  ) lm on true
  where m.user_id = auth.uid()
  order by coalesce(lm.created_at, now()) desc;
$$;

create or replace function public.mark_read(conv uuid)
returns void language sql security definer set search_path = '' as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = conv and user_id = auth.uid();
$$;

-- ============================================================
-- Safety: blocks and reports (DSA notice-and-action)
-- ============================================================
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('story', 'post', 'comment', 'message', 'profile')),
  target_id text not null,
  reason text not null check (reason in ('illegal', 'harassment', 'danger', 'privacy', 'false', 'spam', 'other')),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  decision text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- ============================================================
-- GDPR: delete my account
-- ============================================================
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ============================================================
-- Row level security
-- ============================================================
alter table public.themes enable row level security;
alter table public.regions enable row level security;
alter table public.profiles enable row level security;
alter table public.stories enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "themes readable" on public.themes for select using (true);
create policy "regions readable" on public.regions for select using (true);

create policy "profiles readable" on public.profiles for select using (true);
create policy "edit own profile" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- Users may only change these columns (not is_researcher / is_moderator).
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, role, bio) on public.profiles to authenticated;

-- Stories: the raw table is readable only by the author (and moderators);
-- everyone else reads through stories_v, which hides pseudonymous authors.
create policy "own stories readable" on public.stories for select
  using (author_id = auth.uid() or public.is_moderator());
create policy "create own story" on public.stories for insert
  with check (author_id = auth.uid());
create policy "edit own story" on public.stories for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "moderators hide stories" on public.stories for update
  using (public.is_moderator());
create policy "withdraw own story" on public.stories for delete
  using (author_id = auth.uid());
revoke update on public.stories from anon, authenticated;
grant update (title, body, consent, hidden) on public.stories to authenticated;

create policy "posts readable" on public.posts for select
  using (not hidden or author_id = auth.uid() or public.is_moderator());
create policy "create own post" on public.posts for insert with check (author_id = auth.uid());
create policy "edit own post" on public.posts for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "moderators hide posts" on public.posts for update using (public.is_moderator());
create policy "delete own post" on public.posts for delete using (author_id = auth.uid());
revoke update on public.posts from anon, authenticated;
grant update (title, body, hidden) on public.posts to authenticated;

-- Authors may not un-hide content a moderator hid.
create or replace function public.guard_hidden()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.hidden is distinct from old.hidden and not public.is_moderator() then
    raise exception 'Only moderators can change visibility';
  end if;
  return new;
end;
$$;
create trigger stories_guard_hidden before update on public.stories
  for each row execute function public.guard_hidden();
create trigger posts_guard_hidden before update on public.posts
  for each row execute function public.guard_hidden();

create policy "likes readable" on public.likes for select using (true);
create policy "like as self" on public.likes for insert with check (user_id = auth.uid());
create policy "unlike as self" on public.likes for delete using (user_id = auth.uid());

create policy "comments readable" on public.comments for select
  using (not hidden or author_id = auth.uid() or public.is_moderator());
create policy "comment as self" on public.comments for insert with check (author_id = auth.uid());
create policy "delete own comment" on public.comments for delete
  using (author_id = auth.uid() or public.is_moderator());

create policy "follows readable" on public.follows for select using (true);
create policy "follow as self" on public.follows for insert with check (follower_id = auth.uid());
create policy "unfollow as self" on public.follows for delete using (follower_id = auth.uid());

create policy "members see conversation" on public.conversations for select
  using (public.is_member(id));
create policy "members see members" on public.conversation_members for select
  using (public.is_member(conversation_id));
create policy "members read messages" on public.messages for select
  using (public.is_member(conversation_id));
create policy "members send messages" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_member(conversation_id)
    and not exists (
      select 1 from public.conversation_members o
      join public.blocks b on (b.blocker_id = o.user_id and b.blocked_id = auth.uid())
      where o.conversation_id = messages.conversation_id and o.user_id <> auth.uid()
    )
  );

create policy "see own blocks" on public.blocks for select using (blocker_id = auth.uid());
create policy "block as self" on public.blocks for insert with check (blocker_id = auth.uid());
create policy "unblock as self" on public.blocks for delete using (blocker_id = auth.uid());

create policy "file a report" on public.reports for insert
  with check (reporter_id = auth.uid() or reporter_id is null);
create policy "see own reports" on public.reports for select
  using (reporter_id = auth.uid() or public.is_moderator());
create policy "moderators decide reports" on public.reports for update using (public.is_moderator());

grant select on public.stories_v, public.posts_v to anon, authenticated;
revoke execute on function public.delete_my_account() from anon, public;
grant execute on function public.delete_my_account() to authenticated;
revoke execute on function public.start_conversation(uuid) from anon, public;
grant execute on function public.start_conversation(uuid) to authenticated;

-- Realtime chat
alter publication supabase_realtime add table public.messages;

-- ============================================================
-- Media storage (private bucket, files served through signed URLs)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', false, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/wav', 'audio/webm',
        'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf']
);

create or replace function public.media_visible(path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.stories s
      where s.media_path = path and not s.hidden
        and (s.consent <> 'researchers' or public.is_researcher())
    )
    or exists (select 1 from public.posts p where p.media_path = path and not p.hidden);
$$;

create policy "upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read visible media" on storage.objects for select
  using (
    bucket_id = 'media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.media_visible(name))
  );
