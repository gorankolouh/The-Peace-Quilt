-- Profile photos and message attachments. Additive only.

-- ============================================================
-- Profile photos (public bucket: avatars are meant to be seen)
-- ============================================================
alter table public.profiles
  add column if not exists avatar_url text check (avatar_url is null or avatar_url ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$');
grant update (avatar_url) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replace own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars readable" on storage.objects for select
  using (bucket_id = 'avatars');

-- ============================================================
-- Message attachments (stored in the private media bucket)
-- ============================================================
alter table public.messages
  add column if not exists attachment_path text,
  add column if not exists attachment_kind public.media_kind,
  add column if not exists attachment_name text check (attachment_name is null or char_length(attachment_name) <= 200);

-- Allow a message that is only an attachment (no text).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.messages'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%body%'
  loop
    execute format('alter table public.messages drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.messages add constraint messages_body_rules
  check (char_length(body) <= 2000 and (char_length(body) >= 1 or attachment_path is not null));

-- Attachments may only point at the sender's own uploads.
alter table public.messages add constraint messages_attachment_owner
  check (attachment_path is null or split_part(attachment_path, '/', 1) = sender_id::text);

-- Conversation members may open files shared in their conversation.
create or replace function public.media_visible(path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.stories s
      where s.media_path = path and not s.hidden
        and (s.consent <> 'researchers' or public.is_researcher())
    )
    or exists (select 1 from public.posts p where p.media_path = path and not p.hidden)
    or exists (
      select 1 from public.messages m
      where m.attachment_path = path and public.is_member(m.conversation_id)
    );
$$;
