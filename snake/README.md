# SNAKE! SNAKE!

*a game by Turnflockoff.com*

A slither.io-style snake game. Eat glowing pellets, grow, boost, and cut off other
snakes to turn them into food. Don't get flocked off.

> **This is a self-contained game in the `/snake` subfolder.** It is completely separate
> from the FLOCKOFF FLAPPY project at the repo root — different files, different runtime,
> nothing shared. You can host, embed, or deploy it on its own page/URL without affecting
> Flappy at all.

It comes in **two versions**:

| Version | File | Needs a server? | Best for |
|---|---|---|---|
| **Single-player** | `index.html` | No — just open the file | Offline play, quick embed, phones |
| **Multiplayer** | `server/` + `public/` | Yes — a Node server | Real people sharing one arena |

---

## Single-player (offline)

Open `index.html` in any browser — no build step, no server, no dependencies. Double-click
works on a PC; it also runs great on iOS/Android in the mobile browser. You play against 14 AI bots.

### Controls

| Input | Action |
|---|---|
| Mouse / touch drag | Steer |
| Click / hold Space / second finger | Boost (burns length, drops crumbs) |
| Enter | Start / respawn |
| M / 🔊 button | Mute / unmute sound |

### Put the single-player game on its own page

`snake/index.html` is one standalone file. To make it a page on your website, pick whichever fits:

- **A page on the Flappy Vite site** (e.g. `turnflockoff.com/snake`): copy `snake/index.html`
  into the root project's `public/` folder as `public/snake.html`. Vite copies `public/` into the
  build as-is, so it ships to `/snake.html` on the same site — without changing any Flappy code.
- **Its own static host**: drop `snake/index.html` on Netlify/Vercel/Cloudflare Pages (drag-and-drop
  the file) for an instant separate URL.
- **Embed anywhere** (WordPress/Wix/Squarespace) once it has a URL:

```html
<iframe src="https://YOUR-SNAKE-URL/"
        style="width:100%; height:80vh; border:0; border-radius:12px;"
        allow="fullscreen" title="SNAKE! SNAKE! — game by Turnflockoff.com"></iframe>
```

---

## Multiplayer (real players, shared arena)

Multiplayer needs an **always-on Node server** — it can't run as a plain static file, because one
authoritative server holds the shared world and syncs every player over WebSockets. AI bots fill
the arena so it's never empty.

### Run it locally

```bash
cd snake         # everything for this game lives in the /snake subfolder
npm install      # installs the one dependency (ws)
npm start        # starts the server on http://localhost:3000
```

Open `http://localhost:3000` in two browser tabs (or on your phone using your computer's LAN IP)
and you're both in the same world. Set the port with `PORT=8080 npm start`.

### Deploy it

The server is portable. Deploy files are included:

- **Render (free tier)** — Render → New → Web Service → pick this repo → set **Root Directory =
  `snake`**, Build `npm install`, Start `npm start`. You get an `https://` URL with WebSockets.
  (Free instances sleep after ~15 min idle and take a few seconds to wake.) See `render.yaml` for a
  blueprint alternative.
- **Fly.io / Railway / any Docker host** — use the included `Dockerfile` (build from the `snake/` dir):
  ```bash
  cd snake && docker build -t snake . && docker run -p 8080:8080 -e PORT=8080 snake
  ```
- **Your own VPS** — `npm install && npm start` behind nginx. Make sure your reverse proxy
  forwards WebSocket upgrade headers (`Upgrade` / `Connection`).

### Embed multiplayer on your website

Same iframe as above, but point `src` at your deployed server URL (e.g. your Render URL or your
own domain), not the static GitHub Pages URL.

---

## Features (both versions)

- Smooth mouse-follow movement with a camera that zooms out as you grow
- Named opponents with distinct skins that seek food, dodge walls/bodies, and boost
- Boost mechanic that trades length for speed and leaves edible crumbs behind
- Head-to-body kills and head-to-head resolution (smaller snake dies); dead snakes burst into food
- Live leaderboard, rank/kill/length HUD, and a minimap
- Circular world with a lethal glowing border
- Procedural sound effects (eat / boost / death) via WebAudio — no audio files, mutable with **M**
- Persistent high score and best-length tracking; new-best celebration on death
- Mobile support (touch steer, two-finger boost), name saved in localStorage

The multiplayer version adds an authoritative Node server, client-side interpolation for smooth
movement, per-player area-of-interest streaming, and a live human-player count on the leaderboard.

## Project layout (everything under `/snake`)

```
snake/
  index.html         single-player game (standalone, offline)
  public/index.html  multiplayer client (served by the server)
  server/server.js   authoritative multiplayer game server
  package.json       server dependency (ws) + start script
  render.yaml        Render deploy (rootDir: snake)
  Dockerfile         portable container for any host
```

> Note: `.xz` isn't a real domain ending — for a custom domain use `.xyz`, `.gg`, `.wtf`, or `.io`.
