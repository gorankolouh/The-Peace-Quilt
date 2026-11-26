// Verum Agora: Web Push delivery.
//  - POST { action: "public_key" }  → returns the VAPID public key (created on first use, kept in push_config).
//  - POST { token, type, id }        → called by the database (push_hook trigger) for a new message or notification.
// Messages are announced without their content, so nothing private appears on a lock screen.
// Push payloads are encrypted end to end; the browser's push service cannot read them.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function envKey(legacy: string, modern: string): string {
  const direct = Deno.env.get(legacy);
  if (direct) return direct;
  const raw = Deno.env.get(modern);
  if (!raw) return '';
  try { const v = JSON.parse(raw); return typeof v === 'string' ? v : (v.default ?? Object.values(v)[0] ?? '') as string; }
  catch { return raw; }
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'));

type Config = { hook_token: string; vapid_public: string | null; vapid_private: string | null };
async function config(): Promise<Config> {
  const { data, error } = await admin.from('push_config').select('hook_token, vapid_public, vapid_private').eq('id', true).single();
  if (error || !data) throw new Error('push_config missing');
  if (!data.vapid_public || !data.vapid_private) {
    const keys = webpush.generateVAPIDKeys();
    await admin.from('push_config').update({ vapid_public: keys.publicKey, vapid_private: keys.privateKey }).eq('id', true).is('vapid_public', null);
    const again = await admin.from('push_config').select('hook_token, vapid_public, vapid_private').eq('id', true).single();
    return again.data as Config;
  }
  return data as Config;
}

const NOTIF: Record<string, string> = {
  follow: 'started following you', comment: 'commented on your contribution', reply: 'replied to your comment',
  like: 'appreciated your contribution', evidence: 'added evidence to one of your claims',
};
const NOTIF_PLAIN: Record<string, string> = {
  review_requested: 'A factual claim in your contribution was sent for review.',
  review_decided: 'A fact review was decided.', appeal_decided: 'Your appeal was decided.',
  report_decided: 'Your report was reviewed.', content_restricted: 'Your content was restricted after a report. Tap to read why.',
};

async function nameOf(id: string | null): Promise<string> {
  if (!id) return 'Someone';
  const { data } = await admin.from('profiles').select('display_name, username').eq('id', id).maybeSingle();
  return data?.display_name || (data?.username ? '@' + data.username : 'Someone');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return reply({ error: 'Bad request' }, 400); }

  const cfg = await config();
  if (b.action === 'public_key') return reply({ key: cfg.vapid_public });

  // Only the database knows the hook token.
  if (typeof b.token !== 'string' || b.token !== cfg.hook_token) return reply({ error: 'Forbidden' }, 403);
  webpush.setVapidDetails('mailto:privacy@lexoradigital.com', cfg.vapid_public!, cfg.vapid_private!);

  let recipients: string[] = [];
  let payload: { title: string; body: string; url: string; tag: string };
  if (b.type === 'messages') {
    const { data: m } = await admin.from('messages').select('id, conversation_id, sender_id').eq('id', b.id).maybeSingle();
    if (!m) return reply({ ok: true });
    const { data: members } = await admin.from('conversation_members').select('user_id').eq('conversation_id', m.conversation_id);
    recipients = (members ?? []).map((x) => x.user_id).filter((u) => u !== m.sender_id);
    payload = { title: await nameOf(m.sender_id), body: 'sent you a message', url: `/messages/${m.conversation_id}`, tag: 'msg-' + m.conversation_id };
  } else if (b.type === 'notifications') {
    const { data: n } = await admin.from('notifications').select('id, user_id, kind, actor_id, target_type, target_id').eq('id', b.id).maybeSingle();
    if (!n) return reply({ ok: true });
    recipients = [n.user_id];
    const body = NOTIF_PLAIN[n.kind] ?? `${await nameOf(n.actor_id)} ${NOTIF[n.kind] ?? 'has a new update for you'}`;
    const url = n.target_type === 'post' ? `/post/${n.target_id}` : n.target_type === 'story' ? `/story/${n.target_id}` : '/notifications';
    payload = { title: 'Verum Agora', body, url, tag: 'n-' + n.id };
  } else return reply({ error: 'Bad request' }, 400);

  if (!recipients.length) return reply({ ok: true, sent: 0 });
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', recipients);
  let sent = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id); // device unsubscribed
    }
  }));
  return reply({ ok: true, sent });
});
