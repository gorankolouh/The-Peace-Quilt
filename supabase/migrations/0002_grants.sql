-- Explicit table access for the app's API roles.
-- Newer Supabase projects do not grant these automatically. Row level security still decides which rows each person sees.

grant usage on schema public to anon, authenticated;

-- Public reading (also for visitors who are not logged in)
grant select on public.themes, public.regions, public.profiles, public.posts, public.likes,
  public.comments, public.follows, public.stories_v, public.posts_v to anon, authenticated;

-- Logged-in members
grant select, insert, delete on public.stories, public.posts, public.likes, public.comments,
  public.follows, public.blocks to authenticated;
grant select on public.conversations, public.conversation_members to authenticated;
grant select, insert on public.messages, public.reports to authenticated;
grant usage on all sequences in schema public to authenticated;

-- Column-limited updates (repeated here so they apply even if run on its own)
grant update (username, display_name, role, bio) on public.profiles to authenticated;
grant update (title, body, consent, hidden) on public.stories to authenticated;
grant update (title, body, hidden) on public.posts to authenticated;
grant update (status, decision, decided_at) on public.reports to authenticated;

-- Functions used by security rules, views and the app
grant execute on function public.is_researcher(), public.is_moderator(), public.media_visible(text)
  to anon, authenticated;
grant execute on function public.is_member(uuid), public.my_conversations(), public.mark_read(uuid),
  public.start_conversation(uuid), public.delete_my_account() to authenticated;
