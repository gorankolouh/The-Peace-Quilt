// Article bodies are plain paragraphs separated by blank lines.
// A paragraph that is exactly  [photo:<path>]  or  [photo:<path>|caption]  is a photo inside the text.

export type Block = { type: 'text'; text: string } | { type: 'photo'; path: string; caption: string };

const PHOTO = /^\[photo:([0-9a-f-]{36}\/[A-Za-z0-9-]+\.(?:jpg|jpeg|png|gif|webp))(?:\|([^\]]{0,300}))?\]$/;

const LOOSE_PHOTO = /^\[[^\]]*[0-9a-f-]{36}\/[^\]]*\]$/;

export function blocks(body: string): Block[] {
  return body.split(/\n{2,}/).map((p) => {
    const m = PHOTO.exec(p.trim());
    return m ? { type: 'photo', path: m[1], caption: (m[2] || '').trim() } : { type: 'text', text: p };
  });
}

export function photoLine(path: string, caption = ''): string {
  const c = caption.replace(/[\]\n|]/g, ' ').trim().slice(0, 300);
  return c ? `[photo:${path}|${c}]` : `[photo:${path}]`;
}

/** All photo paths used inside a body. */
export function inlinePhotos(body: string): string[] {
  return blocks(body).flatMap((b) => (b.type === 'photo' ? [b.path] : []));
}

/** Body text without photo lines, for previews, cards and reading time. */
export function plainText(body: string): string {
  return blocks(body).filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n\n');
}

/**
 * Show a translation with the photos of the original in their places.
 * If the translation kept the same number of text paragraphs, they are slotted back between the photos;
 * otherwise the translation is shown as returned (photo lines it kept still render).
 */
export function mergeTranslation(original: string, translated: string): Block[] {
  const orig = blocks(original);
  // A translator may alter a photo line; anything that still carries a file path is treated as a photo, not text.
  const trText = blocks(translated).filter((b) => b.type === 'text' && !LOOSE_PHOTO.test(b.text.trim()));
  const origTextCount = orig.filter((b) => b.type === 'text').length;
  if (trText.length !== origTextCount) return blocks(translated);
  let k = 0;
  return orig.map((b) => (b.type === 'photo' ? b : trText[k++]));
}
