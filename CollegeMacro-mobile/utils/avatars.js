import { supabase } from './config';

const BUCKET = 'avatars';
const MAX_BYTES = 2 * 1024 * 1024; // matches the bucket's file_size_limit
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Public URL for a stored profile photo path ("<user id>/<file>"), or null.
export function avatarUrl(path) {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl ?? null;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(base64) {
  const clean = base64.replace(/^data:[^,]*,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let byte = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const [a, b, c, d] = [0, 1, 2, 3].map((k) => B64.indexOf(clean[i + k] ?? 'A'));
    const chunk = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63);
    bytes[byte++] = (chunk >> 16) & 255;
    if (clean[i + 2] !== undefined) bytes[byte++] = (chunk >> 8) & 255;
    if (clean[i + 3] !== undefined) bytes[byte++] = chunk & 255;
  }
  return bytes.slice(0, byte);
}

const randomName = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/**
 * Uploads a picked photo, points the profile at it, and removes the previous
 * one. Returns the new path.
 * @param {{ userId: string, base64: string, mimeType?: string, previousPath?: string | null }} photo
 */
export async function uploadAvatar({ userId, base64, mimeType = 'image/jpeg', previousPath = null }) {
  const extension = EXTENSIONS[mimeType];
  if (!extension) throw new Error('Use a JPEG, PNG or WebP photo.');
  const bytes = base64ToBytes(base64);
  if (bytes.length > MAX_BYTES) throw new Error('That photo is too large. Pick one under 2 MB.');

  const path = `${userId}/${randomName()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw error;

  const { error: profileError } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
  if (profileError) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw profileError;
  }
  if (previousPath && previousPath !== path) await supabase.storage.from(BUCKET).remove([previousPath]);
  return path;
}

export async function removeAvatar({ userId, path }) {
  const { error } = await supabase.from('profiles').update({ avatar_path: null }).eq('id', userId);
  if (error) throw error;
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}
