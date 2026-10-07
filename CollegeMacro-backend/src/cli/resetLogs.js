// Clears each user's food log at midnight in their school's time zone.
// Scheduled hourly by .github/workflows/reset-daily-logs.yml; see
// public.reset_daily_logs() in src/db/migrations/002_multi_school_social.sql.
const supabaseClient = require('../../supabaseClient');

async function main() {
  const { data, error } = await supabaseClient().rpc('reset_daily_logs');
  if (error) throw error;
  console.log(`Cleared food logs for ${data} user(s) whose local day rolled over.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
