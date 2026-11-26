-- Verum Agora: push notifications on phones and computers (Web Push).
-- The push Edge Function creates its own VAPID keys on first use and keeps them in push_config,
-- which no app user can read. The database calls that function when a message or notification arrives.
-- Additive; safe to run more than once.

create extension if not exists pg_net with schema extensions;

-- ============================================================
-- Private configuration (service role only)
-- ============================================================
create table if not exists public.push_config (
  id boolean primary key default true check (id),
  function_url text,
  hook_token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  vapid_public text,
  vapid_private text
);
insert into public.push_config (id) values (true) on conflict (id) do nothing;
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
grant select, insert, update on public.push_config to service_role;

-- ============================================================
-- One row per device that asked for notifications
-- ============================================================
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions for select using (user_id = auth.uid());
drop policy if exists "remove own push subscriptions" on public.push_subscriptions;
create policy "remove own push subscriptions" on public.push_subscriptions for delete using (user_id = auth.uid());
grant select, delete on public.push_subscriptions to authenticated;
grant select, delete on public.push_subscriptions to service_role;

-- Save (or move) this device's subscription to the signed-in user.
create or replace function public.save_push_subscription(endpoint text, p256dh text, auth text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from public.push_subscriptions s where s.endpoint = save_push_subscription.endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), save_push_subscription.endpoint, save_push_subscription.p256dh, save_push_subscription.auth);
  -- At most 10 devices per person.
  delete from public.push_subscriptions where id in (
    select id from public.push_subscriptions where user_id = auth.uid() order by created_at desc offset 10);
end $$;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- ============================================================
-- Ask the push function to deliver; never blocks or breaks the original insert
-- ============================================================
create or replace function public.push_hook() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  cfg public.push_config;
  wanted boolean;
begin
  select * into cfg from public.push_config where id;
  if cfg.function_url is null then return new; end if;
  if tg_table_name = 'messages' then
    select exists (select 1 from public.conversation_members m join public.push_subscriptions s on s.user_id = m.user_id
                   where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id) into wanted;
  else
    select exists (select 1 from public.push_subscriptions s where s.user_id = new.user_id) into wanted;
  end if;
  if wanted then
    perform net.http_post(
      url := cfg.function_url,
      body := jsonb_build_object('token', cfg.hook_token, 'type', tg_table_name, 'id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb);
  end if;
  return new;
exception when others then
  return new; -- a push problem must never stop a message from being sent
end $$;

drop trigger if exists push_messages on public.messages;
create trigger push_messages after insert on public.messages for each row execute function public.push_hook();
drop trigger if exists push_notifications on public.notifications;
create trigger push_notifications after insert on public.notifications for each row execute function public.push_hook();

-- The push Edge Function reads these with the service role; newer projects need explicit grants.
grant select on public.messages, public.conversation_members, public.notifications, public.profiles, public.push_subscriptions to service_role;
grant delete on public.push_subscriptions to service_role;
