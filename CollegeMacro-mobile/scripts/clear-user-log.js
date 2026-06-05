#!/usr/bin/env node

/**
 * Standalone script to clear ALL users' food logs and reset their nutrition data.
 * 
 * This script is independent of the React Native application and can be run
 * from the command line using Node.js.
 * 
 * WARNING: This will clear the food log for ALL users in the database!
 * 
 * Usage:
 *   From project root: node scripts/clear-user-log.js
 *   From scripts directory: node clear-user-log.js
 *
 * The script expects Supabase credentials via environment variables.
 */

const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});
const { createClient } = require('@supabase/supabase-js');

/**
 * Main function to clear all users' logs and reset nutrition data
 */
async function clearAllUserLogs() {
  try {
    // Pull secrets from environment variables
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing Supabase environment variables.');
      process.exit(1);
    }
    
    // Initialize Supabase client with service role key (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('🔍 Fetching all users...');
    
    // Fetch all users (for stats only)
    const { data: allUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, log');
    
    if (fetchError) {
      console.error('❌ Error fetching users:', fetchError.message);
      process.exit(1);
    }
    
    if (!allUsers || allUsers.length === 0) {
      console.log('⚠️  No users found in database.');
      return;
    }

    // Count how many have logs
    const usersWithLogs = allUsers.filter(u => Array.isArray(u.log) && u.log.length > 0);
    if (usersWithLogs.length === 0) {
      console.log('ℹ️  All user logs are already empty.');
      return;
    }
    console.log(`✅ Found ${allUsers.length} user(s) total`);
    console.log(`📦 ${usersWithLogs.length} user(s) have non-empty logs\n`);

    // Single bulk update: clear all logs in one query
    console.log('🧹 Clearing all logs...');
    const idsToClear = usersWithLogs.map(u => u.id);
    const { error: updateError } = await supabase
      .from('users')
      .update({ log: [] })
      .in('id', idsToClear);  // explicitly target users that currently have logs

    if (updateError) {
      console.error('❌ Error clearing logs:', updateError.message);
      process.exit(1);
    }

    // Summary
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`   Total users processed: ${allUsers.length}`);
    console.log(`   Logs cleared: ${usersWithLogs.length}`);
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('✅ Successfully cleared logs for all users!');
    console.log('   - Nutrition totals will now be 0 for all users');
    console.log('');
    console.log('📝 Note: Daily calorie goals and macro targets (dailyValues) are preserved.');
    console.log('   Only the food log entries have been cleared.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
clearAllUserLogs();
