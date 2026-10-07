#!/usr/bin/env node
// Runs MacroHall on localhost.
//
//   npm run demo   the app on sample data at http://localhost:8081, no keys needed
//   npm run dev    the real app: backend on :3001 (when its .env is filled in)
//                  plus the app on http://localhost:8081 against your Supabase
//
// The Expo terminal stays interactive: press w to reopen the browser, r to
// reload, or scan the QR code with Expo Go to open it on your phone.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mobileDir = path.join(root, 'CollegeMacro-mobile');
const backendDir = path.join(root, 'CollegeMacro-backend');
const isWindows = process.platform === 'win32';
const args = process.argv.slice(2);
const portArg = args.find((a) => a.startsWith('--port='));
const webPort = portArg ? portArg.split('=')[1] : '8081';

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

// Placeholders from the .env.example files count as missing.
const isSet = (value) => Boolean(value) && !/your-|example|generate-a-long/i.test(value);

function ensureInstalled(dir, label) {
  if (fs.existsSync(path.join(dir, 'node_modules'))) return;
  console.log(`Installing ${label} dependencies (first run only)...`);
  const result = spawnSync('npm', ['install'], { cwd: dir, stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) {
    console.error(`npm install failed in ${path.relative(root, dir)}.`);
    process.exit(result.status || 1);
  }
}

// Expo inlines EXPO_PUBLIC_* values into the bundle, so switching between demo
// and real mode needs a cache clear.
function modeChanged(mode) {
  const marker = path.join(mobileDir, 'node_modules', '.cache', 'macrohall-mode');
  const previous = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : null;
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, mode);
  return previous !== mode;
}

function prefixed(child, label) {
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) console.log(`[${label}] ${line}`);
    });
  }
}

let demo = args.includes('--demo');
const mobileEnv = readEnv(path.join(mobileDir, '.env'));
const backendEnv = readEnv(path.join(backendDir, '.env'));

if (!demo && !(isSet(mobileEnv.EXPO_PUBLIC_SUPABASE_URL) && isSet(mobileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY))) {
  console.log('No Supabase keys in CollegeMacro-mobile/.env yet, so starting the demo instead.');
  console.log('Run `npm run setup` to connect your Supabase project.\n');
  demo = true;
}

ensureInstalled(mobileDir, 'app');

const children = [];
let backendUrl = null;

if (!demo) {
  if (isSet(backendEnv.SUPABASE_URL) && isSet(backendEnv.SUPABASE_SERVICE_ROLE_KEY)) {
    ensureInstalled(backendDir, 'backend');
    const backend = spawn(process.execPath, ['app.js'], { cwd: backendDir, stdio: ['ignore', 'pipe', 'pipe'] });
    prefixed(backend, 'backend');
    backend.on('exit', (code) => code && console.log(`[backend] exited with code ${code}`));
    children.push(backend);
    backendUrl = `http://localhost:${backendEnv.PORT || 3001}`;
    if (!isSet(backendEnv.ANTHROPIC_API_KEY)) {
      console.log('[backend] ANTHROPIC_API_KEY is not set: the Ask tab and menu photos will return errors.');
    }
  } else {
    console.log('CollegeMacro-backend/.env has no Supabase service key, so the backend is not started.');
    console.log('The app still works; Ask, Hit my macros and live gym counts need the backend.\n');
  }
}

const expoArgs = ['expo', 'start', '--web', '--port', webPort];
if (modeChanged(demo ? 'demo' : 'live')) expoArgs.push('--clear');

const expoEnv = { ...process.env };
if (demo) expoEnv.EXPO_PUBLIC_DEMO_MODE = '1';
else delete expoEnv.EXPO_PUBLIC_DEMO_MODE;
// The web app runs on this computer, so it can reach the backend on localhost.
if (backendUrl && !process.env.EXPO_PUBLIC_BACKEND_URL && !isSet(mobileEnv.EXPO_PUBLIC_BACKEND_URL)) expoEnv.EXPO_PUBLIC_BACKEND_URL = backendUrl;

console.log(demo ? 'Starting MacroHall (demo, sample data)...' : 'Starting MacroHall...');
console.log(`Open http://localhost:${webPort} once the bundle finishes. Press Ctrl+C to stop.\n`);

const expo = spawn('npx', expoArgs, { cwd: mobileDir, stdio: 'inherit', env: expoEnv, shell: isWindows });
children.push(expo);

const stop = () => {
  for (const child of children) if (!child.killed) child.kill();
};
expo.on('exit', (code) => {
  stop();
  process.exit(code ?? 0);
});
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
