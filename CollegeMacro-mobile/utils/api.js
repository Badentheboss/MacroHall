import { DEMO_MODE, supabase } from './config';
import { createDemoBackend } from './demo/backend';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const demoBackend = DEMO_MODE ? createDemoBackend(supabase) : null;

// Calls the MacroHall backend as the signed-in user. Throws an Error carrying
// the server's message (and HTTP status) on failure.
export async function postToBackend(path, body) {
  return callBackend('POST', path, body);
}

export async function getFromBackend(path) {
  return callBackend('GET', path);
}

async function callBackend(method, path, body) {
  if (demoBackend) return demoBackend(method, path, body);
  if (!BACKEND_URL) {
    throw new Error('EXPO_PUBLIC_BACKEND_URL is not set.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Please sign in again.');
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
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
