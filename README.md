# FLOCKOFF FLAPPY

A complete retro 16-bit HTML5 arcade game: one paranoid dove in a fake
Groucho disguise vs. an endless wall of **FLOUK** roadside surveillance
cameras. Tap to flap, dodge the scanner beams, outfly the hunter drones,
and escape through the glowing **TURNFLOCKOFF.COM** portal.

All art and music are generated procedurally in code — pixel sprites are
rasterized at boot and the chiptune soundtrack is synthesized with
WebAudio. No binary game assets, no external dependencies at runtime.

## Features

- **Flappy-style core loop** — gravity, tap to flap, infinite scrolling,
  procedural obstacles, gradually rising difficulty
- **Three levels** — sunny small town → rainy dusk city → night-time
  California, introduced by a glitching robot-voice cutscene
- **FLOUK cameras** — glowing red Terminator eyes, sweeping scanner
  beams, blinking LEDs, solar panels, battery boxes, capture flashes
- **FLOUK hunter drones** — track, charge, dash; swarms late game
- **Meta game** — coins, shop (disguises, feather trails, coin magnet,
  revive), 12 achievements, lifetime statistics, localStorage saves
- **Full menu suite** — splash, main menu, pause, settings, shop,
  credits, achievements, statistics, game over, victory
- **Atmosphere** — parallax skyline, clouds, rain, fog, day/night,
  feather trails, sparks, explosions, screen shake, hit stop
- **Ending** — survive to the final stage and fly into the portal:
  *MISSION COMPLETE — YOU TURNED FLOCK OFF*

## Site pages

Beyond the app itself (`index.html`, the Capacitor/PWA entry point that
boots straight into the game), the repo also hosts a small marketing
site so more games can be added later without disturbing the app:

- `arcade.html` — the game index / hub, one card per game
- `games/flockoff-flappy/index.html` — FlockOff Flappy's own promo page
  (dossiers, mission log, zone breakdown, a playable teaser demo, and a
  link into the full game)

## Controls

| Action | Input |
| --- | --- |
| Flap | Tap / click / `Space` / `↑` / `W` |
| Pause | `Esc` / `P` / tap the top-right corner |
| Menus | Tap / click, or arrow keys + `Enter` |

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # production build in dist/
npm run preview   # serve the production build
```

Regenerate the PWA icons (pure Node, no dependencies):

```bash
node scripts/gen-icons.mjs
```

## Exports

- **HTML5** — `npm run build`, deploy `dist/` to any static host
- **PWA** — installable and fully offline (manifest + service worker)
- **Android** — `npx cap add android && npm run cap:android`
- **iOS** — `npx cap add ios && npm run cap:ios`

Capacitor is preconfigured in `capacitor.config.json`
(`com.turnflockoff.flappy`); the native platform folders are generated
locally and are not checked in.

## Project layout

```
src/
  core/    font, input, save, audio (chiptune synth + SFX)
  gfx/     pixel rasterizer + all procedural sprite art
  game/    world, entities, particles, data, game state machine
public/    PWA manifest, service worker, generated icons
scripts/   icon generator (zero-dependency PNG encoder)
arcade.html              game index / hub page
games/flockoff-flappy/   FlockOff Flappy's promo page
```
