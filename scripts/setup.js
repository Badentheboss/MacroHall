#!/usr/bin/env node
// One-time project setup, run from the repo root on your own computer:
//
//   npm run setup     walk through Supabase setup step by step
//   npm run env       just create/open the .env files to paste keys into
//
// Each step copies what you need to the clipboard and opens the right
// dashboard page. No keys are ever sent anywhere by this script.
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const BACKEND_ENV = path.join(ROOT, 'CollegeMacro-backend', '.env');
const MOBILE_ENV = path.join(ROOT, 'CollegeMacro-mobile', '.env');
const SETUP_SQL = path.join(ROOT, 'CollegeMacro-backend', 'src', 'db', 'setup.sql');
const GITHUB_SECRETS = 'https://github.com/Badentheboss/MacroHall/settings/secrets/actions';

const CONFIRM_EMAIL_TEMPLATE = `<h2>Your MacroHall code</h2>
<p>Enter this code in the app to confirm your school email:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>`;

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

function commandExists(command) {
  try {
    execSync(isWindows ? `where ${command}` : `command -v ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function copyToClipboard(text) {
  const candidates = isMac
    ? ['pbcopy']
    : isWindows
      ? ['clip']
      : ['wl-copy', 'xclip -selection clipboard', 'xsel --clipboard --input'];
  for (const command of candidates) {
    if (!commandExists(command.split(' ')[0])) continue;
    try {
      execSync(command, { input: text });
      return true;
    } catch {
      // try the next one
    }
  }
  return false;
}

// Starts a GUI program without waiting; failures print a hint instead of crashing.
function launch(command, args, hint) {
  const child = spawn(command, args, { stdio: 'ignore', detached: true, shell: isWindows && command === 'code' });
  child.on('error', () => console.log(`  (couldn't open automatically: ${hint})`));
  child.unref();
}

function openTarget(target) {
  const [command, args] = isMac
    ? ['open', [target]]
    : isWindows
      ? ['cmd', ['/c', 'start', '', target]]
      : ['xdg-open', [target]];
  launch(command, args, target);
}

// Text files open in VS Code when it's installed, else the system editor.
function openFile(file) {
  if (commandExists('code')) {
    launch('code', [file], file);
  } else if (isMac) {
    launch('open', ['-t', file], file);
  } else if (isWindows) {
    launch('notepad', [file], file);
  } else {
    openTarget(file);
  }
}

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, value])
  );
}

// Creates .env from .env.example if missing. A fresh backend .env gets a
// random INGEST_SECRET so there is one less thing to paste.
function ensureEnvFiles() {
  for (const file of [BACKEND_ENV, MOBILE_ENV]) {
    if (fs.existsSync(file)) continue;
    let contents = fs.readFileSync(`${file}.example`, 'utf8');
    if (file === BACKEND_ENV) {
      contents = contents.replace(/^INGEST_SECRET=.*$/m, `INGEST_SECRET=${crypto.randomBytes(24).toString('hex')}`);
    }
    fs.writeFileSync(file, contents);
    console.log(`Created ${path.relative(ROOT, file)}`);
  }
}

function projectRef() {
  const url = readEnv(BACKEND_ENV).SUPABASE_URL || readEnv(MOBILE_ENV).EXPO_PUBLIC_SUPABASE_URL || '';
  const match = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
  return match ? match[1] : '_'; // "_" makes Supabase ask which project
}

function dashboard(pathname) {
  return `https://supabase.com/dashboard/project/${projectRef()}/${pathname}`;
}

async function step(rl, title, lines) {
  console.log(`\n=== ${title} ===`);
  for (const line of lines) console.log(`  ${line}`);
  await new Promise((resolve) => rl.question('\nPress Enter when done (or Ctrl+C to stop)... ', resolve));
}

function openEnvFiles() {
  ensureEnvFiles();
  openFile(BACKEND_ENV);
  openFile(MOBILE_ENV);
  console.log(`
Opened:
  CollegeMacro-backend/.env  -> SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
  CollegeMacro-mobile/.env   -> EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_BACKEND_URL

Supabase keys: ${dashboard('settings/api-keys')}
Anthropic key: https://console.anthropic.com/settings/keys
Both .env files are git-ignored. Never paste the service role key into the mobile .env.`);
}

async function main() {
  if (process.argv.includes('--env-only')) {
    openEnvFiles();
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  openEnvFiles();
  openTarget(dashboard('settings/api-keys'));
  await step(rl, '1/5 Paste your keys', [
    'Both .env files and the Supabase API keys page are open',
    '(Project Settings -> API Keys if the page asks you to pick a project).',
    'Fill in the values and save both files.',
  ]);

  const copiedSql = copyToClipboard(fs.readFileSync(SETUP_SQL, 'utf8'));
  openTarget(dashboard('sql/new'));
  await step(rl, '2/5 Create the database tables', [
    copiedSql ? 'The setup SQL is on your clipboard.' : `Copy the contents of ${path.relative(ROOT, SETUP_SQL)}.`,
    'In the SQL editor that just opened: paste, click Run, and wait for "Success".',
    'It is safe to run again later; every statement is idempotent.',
  ]);

  openTarget(dashboard('auth/providers'));
  await step(rl, '3/5 Require email confirmation', [
    'Authentication -> Sign In / Providers -> Email.',
    'Turn ON "Confirm email" and save. Without it anyone could claim any .edu address.',
  ]);

  const copiedTemplate = copyToClipboard(CONFIRM_EMAIL_TEMPLATE);
  openTarget(dashboard('auth/templates'));
  await step(rl, '4/5 Send a 6-digit code instead of a link', [
    'Authentication -> Emails -> "Confirm signup" template.',
    copiedTemplate ? 'The new template body is on your clipboard: replace the body with it and save.' : 'Replace the body with:',
    ...(copiedTemplate ? [] : CONFIRM_EMAIL_TEMPLATE.split('\n')),
  ]);

  openTarget(GITHUB_SECRETS);
  await step(rl, '5/5 GitHub Actions secrets (scheduled menu ingestion)', [
    'Add three repository secrets with the same values as CollegeMacro-backend/.env:',
    'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY',
  ]);

  rl.close();
  console.log(`
Done. Next:
  cd CollegeMacro-backend && npm install && npm run ingest -- --school=umich --persist=true
  then add dining hall coordinates (docs/EXPANSION_PLAN.md, section 7) for Friends check-ins.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
