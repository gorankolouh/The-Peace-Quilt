// Verum Agora: copy a photo from Medium into the caller's own media folder.
// Used to bring a moderator's own Medium articles over, photos included.
//  POST { url }  (with the user's normal Authorization header)  →  { path }
// Limits: moderators only, Medium image hosts only, images only, up to 10 MB.
// Hidden metadata (EXIF/GPS, XMP, text chunks) is removed before the file is stored.
import { createClient } from 'npm:@supabase/supabase-js@2';

const HOSTS = ['miro.medium.com', 'cdn-images-1.medium.com'];
const MAX = 10 * 1024 * 1024;
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

/** JPEG: keep everything except APP1–APP15 and comment segments (EXIF, XMP, GPS, ICC is APP2 – dropped too, browsers assume sRGB). */
function cleanJpeg(b: Uint8Array): Uint8Array {
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error('bad jpeg');
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new Error('bad jpeg');
    const m = b[i + 1];
    if (m === 0xda) { parts.push(b.subarray(i)); return join(parts); } // start of scan: keep the rest as is
    const len = (b[i + 2] << 8) | b[i + 3];
    const drop = (m >= 0xe1 && m <= 0xef) || m === 0xfe;
    if (!drop) parts.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  throw new Error('bad jpeg');
}
function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
/** PNG: drop text and EXIF chunks. */
function cleanPng(b: Uint8Array): Uint8Array {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((v, k) => b[k] === v)) throw new Error('bad png');
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    const end = i + 12 + len;
    if (!['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME'].includes(type)) parts.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return join(parts);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(url, envKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS'), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: u } = await asCaller.auth.getUser();
  if (!u?.user) return reply({ error: 'Not signed in' }, 401);
  const admin = createClient(url, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'));
  const { data: prof } = await admin.from('profiles').select('is_moderator').eq('id', u.user.id).maybeSingle();
  if (!prof?.is_moderator) return reply({ error: 'Only moderators can import photos' }, 403);

  let src: URL;
  try { src = new URL(String((await req.json()).url)); } catch { return reply({ error: 'Bad request' }, 400); }
  if (src.protocol !== 'https:' || !HOSTS.includes(src.hostname)) return reply({ error: 'Only Medium image links are allowed' }, 400);

  const r = await fetch(src, { redirect: 'error', headers: { Accept: 'image/jpeg,image/png,image/gif;q=0.8' } });
  if (!r.ok) return reply({ error: 'Could not fetch the photo' }, 502);
  const type = (r.headers.get('content-type') || '').split(';')[0].trim();
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX) return reply({ error: 'Photo is empty or larger than 10 MB' }, 400);

  let bytes: Uint8Array, ext: string, contentType: string;
  try {
    if (type === 'image/jpeg') { bytes = cleanJpeg(buf); ext = 'jpg'; contentType = type; }
    else if (type === 'image/png') { bytes = cleanPng(buf); ext = 'png'; contentType = type; }
    else if (type === 'image/gif') { bytes = buf; ext = 'gif'; contentType = type; }
    else return reply({ error: `Unsupported image type ${type}` }, 400);
  } catch { return reply({ error: 'The photo file looks damaged' }, 400); }

  const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from('media').upload(path, bytes, { contentType, upsert: false });
  if (error) return reply({ error: error.message }, 500);
  return reply({ path });
});
