-- Verum Agora: photos inside articles.
-- An article body can hold photo lines of the form  [photo:<user-id>/<file>.jpg]  or  [photo:<path>|caption].
-- Readers may see such a photo when a visible post by the same person includes it in its text.
-- Additive; safe to run more than once.

create or replace function public.media_visible(path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.stories s
      where s.media_path = path and not s.hidden
        and (s.consent <> 'researchers' or public.is_researcher())
    )
    or exists (select 1 from public.posts p where p.media_path = path and not p.hidden)
    or exists (
      select 1 from public.posts p
      where p.author_id::text = split_part(path, '/', 1)   -- only the owner's own files, uses posts_author_idx
        and not p.hidden
        and strpos(p.body, '[photo:' || path) > 0
    )
    or exists (
      select 1 from public.messages m
      where m.attachment_path = path and public.is_member(m.conversation_id)
    );
$$;
grant execute on function public.media_visible(text) to anon, authenticated;
