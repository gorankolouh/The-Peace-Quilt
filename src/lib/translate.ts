// Automatic translation of contributions. Order of preference:
// 1. A translation already cached on the server.
// 2. On-device translation in the browser (Chrome desktop): the text never leaves the device.
// 3. The server translate function (DeepL, EU) if it is deployed and has a key.
// Every result is labelled as automatic; the original is always kept and shown on request.
import { supabase, DEMO } from './supabase';

export type Translation = { title: string | null; body: string; engine: 'device' | 'deepl' | 'other' | 'cached' };
export class TranslationUnavailable extends Error {}

type TranslatorApi = {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: { sourceLanguage: string; targetLanguage: string; monitor?: (m: EventTarget) => void }): Promise<{ translate(t: string): Promise<string> }>;
};

export function deviceTranslationPossible() {
  return typeof self !== 'undefined' && 'Translator' in self;
}

async function onDevice(text: { title: string | null; body: string }, from: string, to: string, onProgress?: (p: number) => void) {
  const T = (self as unknown as { Translator?: TranslatorApi }).Translator;
  if (!T) return null;
  const opts = { sourceLanguage: from, targetLanguage: to };
  const state = await T.availability(opts).catch(() => 'unavailable');
  if (state === 'unavailable') return null;
  const tr = await T.create({ ...opts, monitor(m) { m.addEventListener('downloadprogress', (e) => onProgress?.((e as ProgressEvent).loaded)); } });
  const paras = text.body.split(/\n{2,}/);
  const out: string[] = [];
  for (const p of paras) out.push(p.trim() ? await tr.translate(p) : p); // paragraph by paragraph keeps the structure
  return { title: text.title ? await tr.translate(text.title) : null, body: out.join('\n\n') };
}

export async function translatePost(
  post: { id: number; title: string | null; body: string; language: string },
  to: string,
  onProgress?: (p: number) => void,
): Promise<Translation> {
  const { data: cached } = await supabase.from('translations').select('title, body, engine').eq('post_id', post.id).eq('lang', to).maybeSingle();
  if (cached) return { title: cached.title, body: cached.body, engine: cached.engine === 'deepl' ? 'deepl' : 'other' };

  const device = await onDevice(post, post.language, to, onProgress).catch(() => null);
  if (device) return { ...device, engine: 'device' };

  if (!DEMO) {
    const { data, error } = await supabase.functions.invoke('translate', { body: { post_id: post.id, target: to } });
    if (!error && data?.body) return { title: data.title ?? null, body: data.body, engine: data.engine === 'deepl' ? 'deepl' : 'other' };
  }
  throw new TranslationUnavailable('unavailable');
}
