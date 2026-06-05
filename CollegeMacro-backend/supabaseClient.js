require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase credentials. Add SUPABASE_URL and SUPABASE_ANON_KEY to your .env file.');
}

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const supabaseClient = () => client; 

module.exports = supabaseClient;
