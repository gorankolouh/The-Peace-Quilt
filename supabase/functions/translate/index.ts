// Verum Agora: server-side automatic translation through DeepL (DeepL SE, Germany).
// Deploy:  supabase functions deploy translate
// Secret:  supabase secrets set DEEPL_API_KEY=...   (keys ending in ":fx" use the free endpoint)
// The browser never sees the DeepL key. Results are cached in public.translations and are
// always shown with an "automatic translation" label; the original stays available.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED = ['en', 'de', 'fr', 'nl', 'es', 'it', 'hr', 'pl'];
const DEEPL_TARGET: Record<string, string> = { en: 'EN-GB', de: 'DE', fr: 'FR', nl: 'NL', es: 'ES', it: 'IT', hr: 'HR', pl: 'PL' };
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

  const key = Deno.env.get('DEEPL_API_KEY');
  if (!key) return reply({ error: 'not_configured' }, 501);

  let postId: number, target: string;
  try {
    const b = await req.json();
    postId = Number(b.post_id); target = String(b.target || '').toLowerCase();
  } catch { return reply({ error: 'Bad request' }, 400); }
  if (!Number.isInteger(postId) || !ALLOWED.includes(target)) return reply({ error: 'Bad request' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  // Read the post as the caller, so hidden or restricted posts are never translated for someone who cannot see them.
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: post } = await asCaller.from('posts_v').select('id, title, body, language').eq('id', postId).maybeSingle();
  if (!post) return reply({ error: 'Not found' }, 404);
  if (post.language === target) return reply({ title: post.title, body: post.body, engine: 'original' });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: cached } = await admin.from('translations').select('title, body, engine').eq('post_id', postId).eq('lang', target).maybeSingle();
  if (cached) return reply(cached);

  const texts = [post.title ?? '', post.body];
  const endpoint = key.endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texts, target_lang: DEEPL_TARGET[target], preserve_formatting: true }),
  });
  if (!r.ok) return reply({ error: 'Translation service unavailable' }, 502);
  const out = (await r.json()).translations as { text: string }[];
  const row = { post_id: postId, lang: target, title: post.title ? out[0].text : null, body: out[1].text, engine: 'deepl' };
  await admin.from('translations').upsert(row);
  return reply({ title: row.title, body: row.body, engine: 'deepl' });
});
