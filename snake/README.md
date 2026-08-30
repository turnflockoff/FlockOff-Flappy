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
works on a PC; it also runs great on iOS/Android in the mobile browser. You play against 20 AI bots
in a large arena (world radius 3400). No purchase flow here — a static file can't verify a real
payment, so premium skins only exist in the multiplayer version, which has a server to check them.

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

## Customization

Both versions now have a skin picker on the start screen: the 12 free presets, plus a **🎨 Custom**
swatch that opens a hue slider — drag it to pick literally any color, live preview, no purchase or
account needed. It's saved in `localStorage` so it's remembered next time. In multiplayer, other
players see your exact chosen color (the server relays your hue to everyone, so it's consistent for
all viewers, not just you).

## Monetization

Two independent ways to make money, both off by default so nothing looks broken until you turn
them on:

### 1. Premium skins via PayPal (multiplayer only)

Five paid skins, each with a distinct visual flourish (not just a flat color swap) plus — except the
purely cosmetic one — a small, balanced gameplay perk (not pay-to-win — no invincibility, no bigger
hitbox advantage):

| Skin | Price | Look | Perk |
|---|---|---|---|
| Golden Cobra | $1.99 | Gold with a shimmering highlight that sweeps down the body | +10 starting length |
| Magnetite | $2.49 | Deep purple with a pulsing magnetic aura ring around the head | +30% food pull radius |
| Speed Demon | $2.99 | Red/orange with a flickering flame trail while boosting | +8% boost speed |
| Iron Scale | $1.99 | Metallic silver with a fine scale-plate outline | Boost burns 15% less length |
| Rainbow Serpent | $1.49 | Continuously hue-shifting rainbow scales, head to tail | Cosmetic only — no perk |

**How it works:** the browser generates a random id (`ownerId`, no login) the first time you play
and remembers it in `localStorage`. When you buy a skin, the client asks the server to create a
PayPal order; PayPal handles the actual checkout; then the server **captures and verifies the
payment itself** (never trusts the browser) before recording the sale and unlocking the skin. Money
settles straight into the PayPal account tied to your PayPal app — no extra payout step.

Purchases and unlocks are stored in your **TurnFlockOFF Supabase project**, in two new tables
(`snake_skin_orders`, `snake_entitlements`) with Row Level Security on and no public policies — only
the game server (using the secret service-role key) can read or write them, so a player can't grant
themselves a skin by calling the API directly.

**Turning it on** — the shop is fully wired but ships *disabled* until you provide real credentials
(there's nothing I can invent here — these have to come from your own accounts):

1. Copy `snake/.env.example` to `.env` (or set these as environment variables on your host, e.g.
   Render's "Environment" tab).
2. **PayPal**: developer.paypal.com → Apps & Credentials → create an app → copy the Client ID and
   Secret into `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`. Start with `PAYPAL_ENV=sandbox` and a
   sandbox app so you can test a full fake purchase before touching real money; switch to a live
   app + `PAYPAL_ENV=live` once you've confirmed the flow end-to-end.
3. **Supabase**: your project's URL is already filled in. Get `SUPABASE_SERVICE_ROLE_KEY` from
   Supabase Dashboard → Project Settings → API → `service_role` secret. Keep this out of git and
   out of any client-side code — it bypasses the database's security rules.
4. Restart the server. The shop button on the start screen will switch from "not configured" to
   real PayPal buttons automatically — no code changes needed.

**Known limitation:** entitlements are tied to a browser, not a real account (no login system
exists yet). Clearing site data or switching devices loses access to purchased skins. Adding proper
accounts (e.g. Supabase Auth) would fix this — ask if you want that built next.

### 2. Ad slot (both versions)

A clearly-labeled placeholder ad box (`#adSlot`) sits under the start-screen hint in both the
single-player and multiplayer clients, `display:none` by default. To turn it on:

1. Get a publisher ID from an ad network (Google AdSense, etc.) or line up a direct sponsor.
2. In each `index.html`, set `const AD_SLOT_ENABLED = true;` and replace the placeholder text
   inside `<div id="adSlot">` with your network's real embed snippet.

Left off until you have a real ID — an empty ad box looks broken to players.

---

## Features (both versions)

- Smooth mouse-follow movement with a camera that zooms out as you grow, in a large arena
- Named opponents with distinct skins that lock onto and pursue food every tick (continuous
  pursuit, not stop-and-recalculate — the fix for bots that used to visibly circle their target),
  dodge walls/bodies, and boost
- Boost mechanic that trades length for speed and leaves edible crumbs behind
- Head-to-body kills and head-to-head resolution (smaller snake dies); dead snakes burst into food
- Live leaderboard, rank/kill/length HUD, and a minimap
- Circular world with a lethal glowing border
- Procedural sound effects (eat / boost / death / purchase) via WebAudio — no audio files, mutable
  with **M**
- Persistent high score and best-length tracking; new-best celebration on death
- Mobile support (touch steer, two-finger boost), name saved in localStorage
- 12 free skins in both versions, plus a free custom color picker (any hue) and 5 paid skins with
  distinct visual effects and small perks in multiplayer (see
  Monetization below)

The multiplayer version adds an authoritative Node server, client-side interpolation for smooth
movement, per-player area-of-interest streaming, and a live human-player count on the leaderboard.

## Project layout (everything under `/snake`)

```
snake/
  index.html         single-player game (standalone, offline)
  public/index.html  multiplayer client (served by the server)
  server/server.js   authoritative multiplayer game server + shop API
  package.json        server dependency (ws) + start script
  render.yaml         Render deploy (rootDir: snake)
  Dockerfile          portable container for any host
  .env.example        PayPal + Supabase config template for the skins shop
```

> Note: `.xz` isn't a real domain ending — for a custom domain use `.xyz`, `.gg`, `.wtf`, or `.io`.
