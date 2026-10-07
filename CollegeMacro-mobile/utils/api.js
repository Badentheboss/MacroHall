import { supabase } from './config';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// POSTs JSON to the MacroHall backend as the signed-in user. Throws an Error
// carrying the server's message (and HTTP status) on failure.
export async function postToBackend(path, body) {
  if (!BACKEND_URL) {
    throw new Error('EXPO_PUBLIC_BACKEND_URL is not set.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Please sign in again.');
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // non-JSON error page
  }

  if (!response.ok) {
    const error = new Error(payload?.message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}
