// REPL driver for SNAKE! SNAKE! (both the single-player static file and the
// multiplayer Node/WebSocket server). No `chromium-cli` in this environment,
// so this is a plain Playwright REPL adapted from the same pattern: stdin
// commands -> browser actions, run under tmux, `send-keys`/`capture-pane`.
//
// Run from anywhere; paths below are resolved relative to this file, which
// lives at <snake>/.claude/skills/run-snake/driver.mjs.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SKILL_DIR = path.dirname(new URL(import.meta.url).pathname);
const SNAKE_DIR = path.resolve(SKILL_DIR, '../../..'); // <repo>/snake
const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/snake-shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

// Stable symlink in this environment; override CHROMIUM_PATH elsewhere.
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

let browser = null, page = null, serverProc = null, serverPort = 3000;
const consoleErrors = [];

async function ensureBrowser() {
  if (browser) return;
  browser = await chromium.launch({
    executablePath: fs.existsSync(CHROMIUM_PATH) ? CHROMIUM_PATH : undefined,
    args: ['--no-sandbox'],
  });
  page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
  page.on('pageerror', e => consoleErrors.push('PAGEERR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push('CONSOLE: ' + m.text()); });
}

function waitOnPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      fetch(`http://localhost:${port}/healthz`).then(r => {
        if (r.ok) resolve(); else retry();
      }).catch(retry);
      function retry() {
        if (Date.now() > deadline) reject(new Error('server did not become healthy in time'));
        else setTimeout(poll, 300);
      }
    })();
  });
}

const COMMANDS = {
  // ---- single-player: no server needed, just open the static file ----
  async 'launch-sp'() {
    await ensureBrowser();
    const url = 'file://' + path.join(SNAKE_DIR, 'index.html');
    await page.goto(url);
    console.log('launched single-player:', url);
  },

  // ---- multiplayer: spawn the Node server, wait for /healthz, then open it ----
  async 'launch-mp'(portArg) {
    if (serverProc) return console.log('server already running (pid ' + serverProc.pid + ')');
    serverPort = parseInt(portArg, 10) || 3000;
    serverProc = spawn('node', [path.join(SNAKE_DIR, 'server/server.js')], {
      cwd: SNAKE_DIR,
      env: { ...process.env, PORT: String(serverPort) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const log = fs.createWriteStream('/tmp/snake-server.log');
    serverProc.stdout.pipe(log); serverProc.stderr.pipe(log);
    try {
      await waitOnPort(serverPort, 10_000);
    } catch (e) {
      console.log('ERROR: server did not come up —', e.message, '(see /tmp/snake-server.log)');
      return;
    }
    await ensureBrowser();
    await page.goto(`http://localhost:${serverPort}/`, { waitUntil: 'domcontentloaded' });
    console.log(`launched multiplayer: http://localhost:${serverPort}/  (server pid ${serverProc.pid}, log /tmp/snake-server.log)`);
  },

  async 'stop-server'() {
    if (!serverProc) return console.log('no server running');
    serverProc.kill();
    serverProc = null;
    console.log('server stopped');
  },

  // ---- generic page interaction (works for either mode once launched) ----
  async ss(name) {
    if (!page) return console.log('ERROR: launch-sp or launch-mp first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f });
    console.log('screenshot:', f);
  },
  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.click(sel, { timeout: 5000 }); console.log('clicked:', sel); }
    catch (e) { console.log('click failed:', sel, '-', e.message.split('\n')[0]); }
  },
  async move(args) {
    if (!page) return console.log('ERROR: launch first');
    const [x, y] = args.split(/\s+/).map(Number);
    await page.mouse.move(x, y);
    console.log('mouse moved to', x, y, '(steers the snake toward that screen point)');
  },
  async key(code) {
    if (!page) return console.log('ERROR: launch first');
    await page.keyboard.press(code);
    console.log('pressed:', code);
  },
  async wait(sel) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.waitForSelector(sel, { timeout: 10_000 }); console.log('found:', sel); }
    catch { console.log('TIMEOUT:', sel); }
  },
  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(await page.evaluate(s => document.querySelector(s)?.innerText ?? '(null)', sel));
  },
  async eval(expr) {
    if (!page) return console.log('ERROR: launch first');
    try { console.log(JSON.stringify(await page.evaluate(expr))); }
    catch (e) { console.log('ERROR:', e.message); }
  },
  async sleep(ms) { await new Promise(r => setTimeout(r, parseInt(ms, 10) || 1000)); console.log('slept', ms + 'ms'); },
  console() {
    console.log(consoleErrors.length ? consoleErrors.join('\n') : '(no console errors captured)');
  },
  async quit() {
    if (browser) await browser.close().catch(() => {});
    if (serverProc) serverProc.kill();
    browser = null; page = null; serverProc = null;
  },
  help() { console.log('commands:', Object.keys(COMMANDS).join(', ')); },
};

const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' });
// IMPORTANT: readline fires 'line' events as input arrives regardless of whether
// the previous handler's promise has resolved — an async handler here does NOT
// serialize commands on its own. Pause while a command runs so commands sent in
// quick succession (the normal `send-keys` pattern) execute strictly in order
// instead of racing (e.g. a slow `click` still pending while `move`/`text` run
// against a page that hasn't reached the state those commands assume).
rl.on('line', async line => {
  rl.pause();
  const [cmd, ...rest] = line.trim().split(/\s+/);
  if (!cmd) { rl.resume(); return rl.prompt(); }
  const fn = COMMANDS[cmd];
  if (!fn) { console.log('unknown:', cmd, '- try: help'); rl.resume(); return rl.prompt(); }
  try { await fn(rest.join(' ')); } catch (e) { console.log('ERROR:', e.message); }
  if (cmd === 'quit') { rl.close(); process.exit(0); }
  rl.resume();
  rl.prompt();
});
rl.on('close', async () => { await COMMANDS.quit(); process.exit(0); });

console.log('SNAKE! SNAKE! driver — "help" for commands, "launch-sp" or "launch-mp [port]" to start');
rl.prompt();
