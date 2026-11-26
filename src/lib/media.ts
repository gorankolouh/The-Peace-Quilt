import { supabase } from './supabase';
import type { MediaKind } from './types';

export function kindOf(file: File): MediaKind | null {
  if (file.type.startsWith('image/')) return 'photo';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type === 'application/pdf') return 'document';
  return null;
}

/**
 * Re-draws a photo onto a canvas and exports a fresh JPEG.
 * The new file carries no EXIF data, so GPS location, camera serial
 * numbers and timestamps are removed before anything leaves the device.
 */
export async function cleanPhoto(file: File, maxSide = 2000): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the photo');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the photo'))), 'image/jpeg', 0.86),
  );
}

export async function uploadMedia(me: string, file: File): Promise<{ path: string; kind: MediaKind }> {
  const kind = kindOf(file);
  if (!kind) throw new Error('This file type is not supported');
  if (file.size > 50 * 1024 * 1024) throw new Error('Files can be up to 50 MB');
  let body: Blob = file;
  let ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  let contentType = file.type;
  if (kind === 'photo') {
    body = await cleanPhoto(file);
    ext = 'jpg';
    contentType = 'image/jpeg';
  }
  const path = `${me}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, body, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  return { path, kind };
}

const urlCache = new Map<string, { url: string; until: number }>();
export async function mediaUrl(path: string): Promise<string | null> {
  const hit = urlCache.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from('media').createSignedUrl(path, 3600);
  if (error || !data) return null;
  urlCache.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export async function removeMedia(path: string) {
  await supabase.storage.from('media').remove([path]);
}

export function avatarUrl(path: string): string {
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

/** Crops a photo to a centred square, scales it to 400 px and re-encodes it (drops EXIF/GPS). */
export async function uploadAvatar(me: string, file: File, oldPath: string | null): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Photos can be up to 15 MB.');
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 400;
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 400, 400);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not process the photo'))), 'image/jpeg', 0.86));
  const path = `${me}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error(/bucket/i.test(error.message) ? 'Profile photos are not switched on yet: the database update (0004) still needs to be run.' : error.message);
  const { error: e2 } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', me);
  if (e2) { await supabase.storage.from('avatars').remove([path]); throw new Error(e2.message); }
  if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
  return path;
}

export async function removeAvatar(me: string, oldPath: string) {
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', me);
  if (error) throw new Error(error.message);
  await supabase.storage.from('avatars').remove([oldPath]);
}
