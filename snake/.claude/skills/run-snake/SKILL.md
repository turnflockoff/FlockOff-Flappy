---
name: run-snake
description: Build, run, and drive SNAKE! SNAKE! (both the single-player static file and the multiplayer Node/WebSocket server) in /snake. Use when asked to start the snake game, run the multiplayer server, take a screenshot of it, or interact with the running game (steer, click Play, pick a skin, trigger a Special Skill).
---

SNAKE! SNAKE! is two things sharing one codebase: a dependency-free single-player
`index.html` and a real-time multiplayer version (`server/` + `public/`) driven by
a Node/WebSocket server. There is no `chromium-cli` in this environment, so both
are driven via the plain-Playwright REPL at
`.claude/skills/run-snake/driver.mjs` — launch it, then send it commands
(`launch-sp` or `launch-mp`, then `click`/`move`/`ss`/...). Run it under tmux so
you can `send-keys` one command at a time and `capture-pane` the result.

All paths below are relative to `snake/` (this skill's grandparent directory).

## Prerequisites

Node ≥18 and tmux (already present in this environment; if not: `apt-get install -y tmux`).

## Setup

The driver has its own tiny, isolated `package.json` inside the skill directory —
deliberately **not** added to `snake/package.json`, so this tooling never ships
with a real deploy of the game server (Render just runs `npm install` with no
`--production` flag, so anything in the game's own `devDependencies` would
install there too).

```bash
cd .claude/skills/run-snake && npm install
```

This installs `playwright-core` only (no bundled browser download). The driver
points it at this environment's pre-installed Chromium via the stable symlink
`/opt/pw-browsers/chromium`; override with `CHROMIUM_PATH=/path/to/chromium` if
that symlink doesn't exist elsewhere.

The multiplayer server's own dependency (`ws`) is separate — `npm install` in
`snake/` itself if you haven't already:

```bash
npm install
```

## Run (agent path)

Launch the driver in tmux:

```bash
tmux new-session -d -s snakedrv -x 200 -y 50
tmux send-keys -t snakedrv 'node .claude/skills/run-snake/driver.mjs' Enter
timeout 15 bash -c 'until tmux capture-pane -t snakedrv -p | grep -q "driver>"; do sleep 0.2; done'
```

Then either mode:

```bash
# Single-player: opens index.html directly, no server needed
tmux send-keys -t snakedrv 'launch-sp' Enter
timeout 15 bash -c 'until tmux capture-pane -t snakedrv -p | grep -q "launched single-player"; do sleep 0.3; done'

# Multiplayer: spawns `node server/server.js`, polls /healthz, then opens the browser
tmux send-keys -t snakedrv 'launch-mp 3000' Enter
timeout 20 bash -c 'until tmux capture-pane -t snakedrv -p | grep -qE "launched multiplayer|ERROR"; do sleep 0.3; done'
```

Then drive it — this exact sequence was run in this container and works for
either mode once launched:

```bash
tmux send-keys -t snakedrv 'wait #playBtn:not([disabled])' Enter   # multiplayer only — waits for the WS connection; skip for launch-sp
timeout 10 bash -c 'until tmux capture-pane -t snakedrv -p | grep -q "found:"; do sleep 0.3; done'
tmux send-keys -t snakedrv 'click #playBtn' Enter
sleep 2
tmux send-keys -t snakedrv 'move 900 300' Enter    # steers the snake toward that screen point
sleep 3
tmux send-keys -t snakedrv 'text #hudLen' Enter    # should be > 10 — proves it's actually eating, not frozen
sleep 1
tmux send-keys -t snakedrv 'ss playing' Enter
timeout 10 bash -c 'until tmux capture-pane -t snakedrv -p | grep -q "screenshot:"; do sleep 0.3; done'
tmux send-keys -t snakedrv 'console' Enter         # dumps any captured page errors — check this before declaring success
tmux capture-pane -t snakedrv -p
```

Screenshots land in `/tmp/snake-shots/` (override with `SCREENSHOT_DIR`). The
multiplayer server's stdout/stderr go to `/tmp/snake-server.log`.

Stop everything (closes the browser and kills the spawned server if one is running):

```bash
tmux send-keys -t snakedrv 'quit' Enter
tmux kill-session -t snakedrv
```

### Driver commands

| command | what it does |
|---|---|
| `launch-sp` | opens `index.html` directly via `file://` — no server |
| `launch-mp [port]` | spawns `node server/server.js` (default port 3000), waits for `/healthz`, opens the browser to it |
| `stop-server` | kills the spawned multiplayer server without closing the browser |
| `ss [name]` | screenshot → `/tmp/snake-shots/<name-or-timestamp>.png` |
| `click <sel>` | CSS-selector click |
| `move <x> <y>` | mouse move in page coordinates — this is how you steer the snake |
| `key <code>` | keyboard press, e.g. `key KeyE` to trigger an equipped Special Skill |
| `wait <sel>` | wait up to 10s for a selector to appear |
| `text <sel>` | print an element's `innerText` |
| `eval <expr>` | `page.evaluate` an arbitrary expression, prints the JSON result |
| `sleep <ms>` | pause |
| `console` | print captured `pageerror`/console-error output since launch |
| `quit` | close the browser and kill the spawned server, if any |

## Run (human path)

```bash
open snake/index.html                 # single-player — just a file, any browser
cd snake && npm install && npm start  # multiplayer — http://localhost:3000
```

## Test

No test suite exists in this project (`snake/package.json` has no `test`
script). This skill's driver *is* the closest thing to one.

---

## Gotchas

- **Clicking a locked skin or Special Skill opens its shop modal instead of
  selecting it.** This is real app behavior, not a driver bug: in multiplayer
  with no PayPal/Supabase credentials configured, none of the 5 premium skins
  or 4 Special Skills are "owned," so `selectSkin`/`selectAbility` redirect to
  `openShop()`/`openSkillShop()`. The shop modal then visually covers
  `#playBtn`, so a queued `click #playBtn` will sit retrying for its full
  5s timeout before failing. For a reliable driven flow, stick to the 12 free
  skins (indices 0–11), the always-free custom-color swatch (index 16, opens
  a hue-slider row instead of a shop), or "No skill" — don't click a locked
  premium swatch/chip unless you're deliberately testing the shop-open path.
- **readline does not serialize async command handlers by default.** The
  driver's `rl.on('line', async ...)` handler must `rl.pause()`/`rl.resume()`
  around each command (already done in `driver.mjs`) — without it, commands
  sent in quick succession (the normal `send-keys` pattern) race: a slow
  `click` retry can still be pending while a later `move`/`text` command runs
  against a page that hasn't reached the state those commands assume, and the
  slow command's output prints out of order, appearing to belong to a later
  command. Caught this live: an initial version produced `text #hudLen` → `0`
  even though the game was clearly running in the screenshot, because the
  click that actually started the game hadn't finished yet.
- **`npm install` at the repo's `snake/server/server.js` module resolution.**
  The driver spawns the server with `cwd: SNAKE_DIR`, so `require('ws')`
  resolves from `snake/node_modules` — run `npm install` in `snake/` itself
  (not inside the skill directory) for the multiplayer path, separately from
  the skill's own `npm install` for `playwright-core`.
- **Don't add `playwright`/`playwright-core` to `snake/package.json`.** Render's
  build command is plain `npm install` (see `snake/render.yaml`), which
  installs `devDependencies` too — the driver's dependency is kept in its own
  `package.json` inside the skill directory specifically so it never rides
  along on a real deploy.

## Troubleshooting

- **`Cannot find module 'ws'` when `launch-mp` reports an error and
  `/tmp/snake-server.log` shows a `MODULE_NOT_FOUND`**: `npm install` hasn't
  been run in `snake/` (the game server's own deps, separate from the driver's).
- **`launch-mp` hangs then prints "server did not come up"**: something is
  already listening on that port. Check `curl -m2 http://localhost:3000/healthz`
  before launching; if it responds, either reuse that server (skip `launch-mp`,
  just `launch-sp`'s browser step against the existing port manually) or pick
  a different port: `launch-mp 3001`.
- **A `click` on a swatch/chip silently does nothing (no `.sel` class after)**:
  see the locked-item Gotcha above — it opened a modal instead. `ss` and look.
