require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
// The backend writes menus and reads across users, so it needs the service role
// key. The anon key ships inside the mobile app and must not be able to write
// menu tables once row level security is on (see src/db/migrations).
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase credentials. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env file.');
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const supabaseClient = () => client;

module.exports = supabaseClient;
