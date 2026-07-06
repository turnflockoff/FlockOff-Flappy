// Game orchestration: state machine, run logic, menus/UI, HUD, the
// California cutscene, the portal ending, achievements, shop and stats.

import { drawText, drawTextShadow, textWidth, drawMicro } from '../core/font.js';
import { loadSave, writeSave, resetSave } from '../core/save.js';
import { AudioSys } from '../core/audio.js';
import { makeSprites } from '../gfx/sprites.js';
import { World, blendLevels } from './world.js';
import { Particles } from './particles.js';
import { Player, Obstacle, Drone, Coin, Portal } from './entities.js';
import {
  W, H, GROUND_Y, LEVELS, LEVEL2_AT, LEVEL3_AT, FINAL_AT,
  levelForScore, ACHIEVEMENTS, SHOP, TRAIL_COLORS, CREDITS,
} from './data.js';

const UI = {
  panel: '#1a1e2e',
  panelLight: '#2a3048',
  border: '#8a92b0',
  text: '#e8ecf8',
  dim: '#8a92b0',
  accent: '#ffd040',
  danger: '#ff5060',
  good: '#50e080',
};

export class Game {
  constructor(canvas, input) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.save = loadSave();
    this.audio = new AudioSys(this.save.settings);
    this.spr = makeSprites();
    this.world = new World(this.spr);
    this.particles = new Particles();
    this.player = new Player(this.spr);

    this.state = 'splash';
    this.time = 0;
    this.stateT = 0;

    // effects
    this.shake = 0;
    this.flash = 0;
    this.hitStop = 0;

    // ui
    this.buttons = [];
    this.sel = 0;
    this.wantActivate = false;
    this.toasts = [];
    this.confirmReset = false;
    this.achPage = 0;

    // run state
    this.resetRun();
    this.levelCfg = blendLevels(0, 0, 0);
  }

  // ---------- run lifecycle ----------

  resetRun() {
    this.score = 0;
    this.runCoins = 0;
    this.level = 0;
    this.blendFrom = 0;
    this.blendTo = 0;
    this.blendT = 1;
    this.obstacles = [];
    this.coins = [];
    this.drones = [];
    this.portal = null;
    this.spawnDist = 60;
    this.sinceDrone = 0;
    this.reviveUsed = false;
    this.invuln = 0;
    this.deathT = 0;
    this.levelBanner = 0;
    this.caTriggered = false;
    this.endingPhase = 0;
    this.creditY = H + 10;
    this.runStats = { flaps: 0, coins: 0, drones: 0, startX: this.world.x };
    this.floaters = [];
    this.bestBeaten = false;
    this.scorePop = 0;
    this.player.reset();
  }

  startRun() {
    this.resetRun();
    this.goto('play');
    this.save.stats.games++;
    this.persist();
    this.audio.playSong('main');
  }

  persist() { writeSave(this.save); }

  trailColors() {
    return TRAIL_COLORS[this.save.equipped.trail] || TRAIL_COLORS.white;
  }

  disguiseCanvas() {
    return this.spr.disguises[this.save.equipped.disguise] || this.spr.disguises.groucho;
  }

  // ---------- achievements ----------

  checkAchievements() {
    for (const a of ACHIEVEMENTS) {
      if (this.save.achievements[a.id]) continue;
      if (a.check(this.save, this)) {
        this.save.achievements[a.id] = true;
        this.toasts.push({ text: a.name, sub: 'ACHIEVEMENT UNLOCKED', t: 3 });
        this.audio.achievement();
        this.persist();
      }
    }
  }

  // ---------- update ----------

  update(dt) {
    this.time += dt;
    this.stateT += dt;

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 3);

    for (let i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].t -= dt;
      if (this.toasts[i].t <= 0) this.toasts.splice(i, 1);
    }

    const inp = this.input;
    if (inp.tapped || inp.flapped) this.audio.unlock();

    // global mute hotkey
    if (inp.pressed('KeyM')) {
      const s = this.save.settings;
      const muted = !s.music && !s.sfx;
      s.music = s.sfx = muted;
      this.audio.applySettings();
      this.persist();
      this.toasts.push({ text: muted ? 'SOUND ON' : 'MUTED', sub: 'AUDIO', t: 1.2 });
    }

    // keyboard menu navigation
    if (this.buttons.length && this.state !== 'play') {
      if (inp.pressed('ArrowDown') || inp.pressed('ArrowRight')) { this.sel = (this.sel + 1) % this.buttons.length; this.audio.menu(); }
      if (inp.pressed('ArrowUp') || inp.pressed('ArrowLeft')) { this.sel = (this.sel + this.buttons.length - 1) % this.buttons.length; this.audio.menu(); }
      if (inp.pressed('Enter')) this.wantActivate = true;
    }

    switch (this.state) {
      case 'splash': this.updateSplash(dt); break;
      case 'menu':
      case 'settings':
      case 'shop':
      case 'credits':
      case 'achievements':
      case 'stats':
      case 'gameover':
      case 'pause':
        this.updateMenuCommon(dt);
        break;
      case 'play': this.updatePlay(dt); break;
      case 'cutscene': this.updateCutscene(dt); break;
      case 'ending': this.updateEnding(dt); break;
      case 'victory': this.updateVictory(dt); break;
    }
  }

  updateSplash(dt) {
    this.world.update(dt, 20);
    if (this.input.tapped || this.input.flapped || this.input.pressed('Enter')) {
      this.audio.unlock();
      this.audio.playSong('main');
      this.audio.menu();
      this.goto('menu');
    }
  }

  updateMenuCommon(dt) {
    if (this.state === 'menu') {
      this.world.update(dt, 20);
      this.player.update(dt, this.particles, this.trailColors(), true);
      this.particles.update(dt);
    }
    if (this.state === 'credits') this.creditY -= dt * 14;
    if ((this.state === 'pause' || this.state === 'settings') &&
        (this.input.pressed('Escape') || this.input.pressed('KeyP'))) {
      if (this.state === 'pause') this.resume();
    }
  }

  goto(state) {
    this.stateFrom = this.state;
    this.state = state;
    this.stateT = 0;
    this.sel = 0;
    this.confirmReset = false;
    if (state === 'credits') this.creditY = H + 10;
    // consume the triggering tap so it can't also click through to the
    // screen we just switched to
    this.input.tapped = false;
    this.input.flapped = false;
    this.wantActivate = false;
  }

  resume() {
    this.state = 'play';
    this.stateT = 0;
    this.input.tapped = false;
    this.input.flapped = false;
  }

  currentCfg() {
    const cfg = blendLevels(this.blendFrom, this.blendTo, this.blendT);
    // gradual extra difficulty on top of level tuning
    const extra = Math.min(1, this.score / 70);
    cfg.speed += extra * 10;
    cfg.gap -= extra * 5;
    cfg.spacing -= extra * 8;
    return cfg;
  }

  updatePlay(dt) {
    const inp = this.input;
    if (inp.pressed('Escape') || inp.pressed('KeyP')) {
      this.goto('pause');
      this.audio.menu();
      return;
    }
    // tap in top-right corner pauses too
    if (inp.tapped && inp.pointer.x > W - 22 && inp.pointer.y < 20 && !this.player.dead) {
      this.goto('pause');
      this.audio.menu();
      return;
    }

    if (this.blendT < 1) this.blendT = Math.min(1, this.blendT + dt * 0.4);
    const cfg = this.levelCfg = this.currentCfg();
    this.levelBanner = Math.max(0, this.levelBanner - dt);
    this.save.stats.playtime += dt;
    if (this.invuln > 0) this.invuln -= dt;

    const p = this.player;
    if (!p.dead) {
      if (inp.flapped) {
        p.flap();
        this.audio.flap();
        this.runStats.flaps++;
        this.save.stats.flaps++;
        for (let i = 0; i < 2; i++) {
          const c = this.trailColors();
          this.particles.feather(p.x - 6, p.y + 4, c[(Math.random() * c.length) | 0], false);
        }
      }
      this.world.update(dt, cfg.speed);
      this.save.stats.distance += (cfg.speed * dt) / 8;
    }
    p.update(dt, this.particles, this.trailColors());
    this.particles.update(dt);

    this.scorePop = Math.max(0, this.scorePop - dt);
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t -= dt;
      f.x -= cfg.speed * dt * 0.6;
      f.y -= 16 * dt;
      if (f.t <= 0) this.floaters.splice(i, 1);
    }

    if (p.dead) {
      this.deathT += dt;
      if (p.y > GROUND_Y - 4 || this.deathT > 1.6) this.finishDeath();
      return;
    }

    // ceiling / ground
    if (p.y < -6) { p.y = -6; p.vy = Math.max(p.vy, 0); }
    if (p.y > GROUND_Y - 5) {
      if (p.y > GROUND_Y - 7) this.particles.dust(p.x - 4, GROUND_Y - 2);
      this.die(null);
      return;
    }

    // spawn obstacles until the portal run-out
    if (this.score < FINAL_AT) {
      this.spawnDist -= cfg.speed * dt;
      if (this.spawnDist <= 0) {
        this.spawnObstacle(cfg);
        this.spawnDist = cfg.spacing;
      }
    } else if (!this.portal) {
      this.startEnding();
      return;
    }

    // obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.update(dt, cfg.speed);
      if (!o.passed && o.x < p.x) {
        o.passed = true;
        this.score++;
        this.save.stats.camerasPassed++;
        this.audio.flash();
        this.scorePop = 0.3;
        this.floaters.push({ x: o.x, y: o.gapY, text: '+1', color: '#ffffff', t: 0.8 });
        if (!this.bestBeaten && this.save.highScore > 0 && this.score > this.save.highScore) {
          this.bestBeaten = true;
          this.toasts.push({ text: 'NEW BEST!', sub: 'KEEP FLYING', t: 2.5 });
          this.audio.achievement();
        }
        this.onScoreChanged();
      }
      if (o.x < -40) this.obstacles.splice(i, 1);
      else if (this.invuln <= 0 && o.hits(p.x, p.y, p.r)) {
        this.die(o);
        return;
      }
    }

    // coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.update(dt, cfg.speed, p, this.save.upgrades.magnet);
      const dx = c.x - p.x, dy = c.y - p.y;
      if (dx * dx + dy * dy < 100) {
        this.coins.splice(i, 1);
        this.runCoins++;
        this.runStats.coins++;
        this.save.coins++;
        this.save.stats.coinsCollected++;
        this.audio.coin();
        this.particles.spark(c.x, c.y);
        this.floaters.push({ x: c.x, y: c.y - 4, text: '+1', color: '#ffd040', t: 0.6 });
        this.checkAchievements();
      } else if (c.x < -10) this.coins.splice(i, 1);
    }

    // drones
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const d = this.drones[i];
      d.update(dt, p, cfg.speed);
      if (d.state === 'charge' && !d.warned) {
        d.warned = true;
        this.audio.warning();
      }
      if (d.state === 'dash' && !d.dashSfx) {
        d.dashSfx = true;
        this.audio.swoosh();
      }
      if (this.invuln <= 0 && d.hits(p.x, p.y, p.r)) {
        this.die(null, d);
        return;
      }
      if (d.gone || (d.state === 'dash' && d.x < -25)) {
        if (!d.counted) {
          d.counted = true;
          this.save.stats.dronesDodged++;
          this.runStats.drones++;
          this.checkAchievements();
        }
        if (d.gone) this.drones.splice(i, 1);
      }
    }
  }

  onScoreChanged() {
    const lvl = levelForScore(this.score);
    if (lvl === 2 && !this.caTriggered) {
      this.caTriggered = true;
      this.goto('cutscene');
      this.cutPhase = 0;
      this.audio.stopSong();
      return;
    }
    if (lvl !== this.level && lvl !== 2) {
      this.setLevel(lvl);
    }
    this.checkAchievements();
  }

  setLevel(lvl) {
    this.blendFrom = this.level;
    this.blendTo = lvl;
    this.blendT = 0;
    this.level = lvl;
    this.levelBanner = 2.5;
    this.audio.playSong(lvl === 2 ? 'danger' : 'main');
  }

  spawnObstacle(cfg) {
    const gapH = cfg.gap;
    const margin = 34;
    const gapY = margin + gapH / 2 + Math.random() * (GROUND_Y - margin * 2 - gapH);
    const o = new Obstacle(W + 40, gapY, gapH, this.spr);
    this.obstacles.push(o);

    // coins: in the gap or between obstacles
    const roll = Math.random();
    if (roll < 0.4) {
      for (let i = 0; i < 3; i++) this.coins.push(new Coin(W + 40 + cfg.spacing / 2 + (i - 1) * 12, 40 + Math.random() * 90));
    } else if (roll < 0.62) {
      this.coins.push(new Coin(W + 40, gapY));
    }

    // hunter drones
    this.sinceDrone++;
    if (cfg.droneEvery > 0 && this.sinceDrone >= cfg.droneEvery) {
      this.sinceDrone = 0;
      const swarm = this.score >= 35 ? 1 + ((Math.random() * 2) | 0) : 1;
      for (let i = 0; i < swarm; i++) {
        const d = new Drone(this.spr, 40 + Math.random() * 100);
        d.x = W + 20 + i * 26;
        this.drones.push(d);
      }
      this.audio.warning();
    }
  }

  die(obstacle, drone = null) {
    const p = this.player;
    this.audio.hit();
    this.shake = 6;
    this.flash = 0.8;
    this.hitStop = 0.1;
    for (let i = 0; i < 10; i++) this.particles.feather(p.x, p.y, '#f8f8f8', true);

    if (obstacle) {
      // the offending camera explodes
      const head = this.spr.flouk.canvas;
      const topHit = p.y < obstacle.gapY;
      const ey = topHit ? obstacle.topEnd - head.height / 2 : obstacle.botStart + head.height / 2;
      this.particles.explosion(obstacle.x, ey);
      this.audio.explosion();
      this.shake = 9;
    }
    if (drone) {
      this.particles.explosion(drone.x, drone.y);
      this.audio.explosion();
      const di = this.drones.indexOf(drone);
      if (di >= 0) this.drones.splice(di, 1);
    }

    // revive upgrade: one second chance per run
    if (this.save.upgrades.revive > 0 && !this.reviveUsed) {
      this.reviveUsed = true;
      this.save.stats.revives++;
      this.invuln = 1.6;
      this.flash = 1;
      p.y = Math.min(p.y, GROUND_Y - 30);
      p.vy = -120;
      // clear immediate threats
      this.obstacles = this.obstacles.filter((o) => o.x > p.x + 60 || o.passed);
      this.drones = [];
      this.toasts.push({ text: 'SPARE FEATHERS USED!', sub: 'SECOND CHANCE', t: 2.5 });
      this.audio.achievement();
      return;
    }

    p.dead = true;
    p.vy = -140;
    this.deathT = 0;
    this.save.stats.deaths++;
    this.audio.stopSong();
  }

  finishDeath() {
    this.save.stats.totalScore += this.score;
    if (this.score > this.save.highScore) {
      this.save.highScore = this.score;
      this.newBest = true;
    } else {
      this.newBest = false;
    }
    this.checkAchievements();
    this.persist();
    this.goto('gameover');
  }

  // ---------- cutscene: WELCOME TO CALIFORNIA ----------

  updateCutscene(dt) {
    // world intentionally frozen: everything pauses
    const t = this.stateT;
    if (this.cutPhase === 0 && t > 0.6) {
      this.cutPhase = 1;
      this.audio.glitch();
    } else if (this.cutPhase === 1 && t > 1.6) {
      this.cutPhase = 2;
      this.audio.robotVoice('Welcome to California');
    } else if (this.cutPhase === 2 && t > 4.2) {
      this.cutPhase = 3;
      this.audio.glitch();
    } else if (this.cutPhase === 3 && t > 5.0) {
      this.setLevel(2);
      this.resume();
    }
  }

  // ---------- ending ----------

  startEnding() {
    this.state = 'ending';
    this.stateT = 0;
    this.endingPhase = 0;
    this.portal = new Portal();
    this.audio.playSong('hope');
    this.drones = [];
  }

  updateEnding(dt) {
    const p = this.player;
    const cfg = this.levelCfg;
    // sky clears: blend toward sunny small-town palette
    this.blendFrom = this.blendTo = 0;
    this.blendT = 1;
    const clearT = Math.min(1, this.stateT / 5);
    this.levelCfg = blendLevels(2, 0, clearT);
    this.levelCfg.speed = cfg.speed;

    this.world.update(dt, 46);
    this.particles.update(dt);
    this.portal.update(dt);

    // remaining obstacles scroll away
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.update(dt, 46);
      if (o.x < -40) this.obstacles.splice(i, 1);
    }
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.update(dt, 46, p, this.save.upgrades.magnet);
      if (c.x < -10) this.coins.splice(i, 1);
    }

    if (this.stateT < 2.5) {
      // player still under control while the world clears
      if (this.input.flapped) { p.flap(); this.audio.flap(); }
      p.update(dt, this.particles, this.trailColors());
      if (p.y > GROUND_Y - 6) { p.y = GROUND_Y - 6; p.vy = -60; }
    } else {
      // autopilot into the portal
      p.vy = 0;
      p.tilt *= 0.9;
      p.x += (this.portal.x - p.x) * dt * 1.2;
      p.y += (this.portal.y - p.y) * dt * 2;
      p.animT += dt;
      p.frame = [0, 1, 2, 1][Math.floor(p.animT / 0.06) % 4];
      const dx = p.x - this.portal.x, dy = p.y - this.portal.y;
      if (dx * dx + dy * dy < 64 && this.endingPhase === 0) {
        this.endingPhase = 1;
        this.flash = 1.6;
        this.audio.portal();
        this.save.victory = true;
        this.save.stats.totalScore += this.score;
        if (this.score > this.save.highScore) this.save.highScore = this.score;
        this.checkAchievements();
        this.persist();
        this.goto('victory');
        this.creditY = 150;
      }
    }
  }

  updateVictory(dt) {
    this.creditY -= dt * 10;
    this.world.update(dt, 12);
    this.particles.update(dt);
    if (this.stateT > 2 && (this.input.tapped || this.input.pressed('Enter'))) {
      this.audio.menu();
      this.audio.playSong('main');
      this.resetRun();
      this.goto('menu');
    }
  }

  // ---------- drawing ----------

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0 && this.save.settings.shake) {
      ctx.translate(
        ((Math.random() - 0.5) * this.shake) | 0,
        ((Math.random() - 0.5) * this.shake) | 0
      );
    }

    const cfg = this.state === 'play' || this.state === 'ending' || this.state === 'pause' || this.state === 'cutscene' || this.state === 'gameover'
      ? this.levelCfg
      : blendLevels(0, 0, 0);

    this.world.draw(ctx, cfg, this.particles);

    // world entities
    if (['play', 'pause', 'cutscene', 'gameover', 'ending'].includes(this.state)) {
      for (const o of this.obstacles) o.draw(ctx, this.time);
      for (const c of this.coins) c.draw(ctx, this.spr);
      if (this.portal) this.portal.draw(ctx);
      for (const d of this.drones) d.draw(ctx, this.time);
      this.particles.draw(ctx);
      for (const f of this.floaters) {
        ctx.globalAlpha = Math.min(1, f.t * 2.5);
        drawText(ctx, f.text, f.x, f.y, f.color, 1, 'center');
        ctx.globalAlpha = 1;
      }
      if (!(this.state === 'gameover' && this.stateT > 0.5)) {
        const blink = this.invuln > 0 && Math.sin(this.time * 30) > 0;
        if (!blink) this.player.draw(ctx, this.disguiseCanvas());
      }
    }
    if (this.state === 'menu' || this.state === 'splash') {
      this.particles.draw(ctx);
    }

    ctx.restore();

    // state-specific UI
    this.buttons = [];
    switch (this.state) {
      case 'splash': this.drawSplash(ctx); break;
      case 'menu': this.drawMenu(ctx); break;
      case 'play': this.drawHUD(ctx); break;
      case 'pause': this.drawHUD(ctx); this.drawPause(ctx); break;
      case 'gameover': this.drawGameOver(ctx); break;
      case 'settings': this.drawSettings(ctx); break;
      case 'shop': this.drawShop(ctx); break;
      case 'credits': this.drawCredits(ctx); break;
      case 'achievements': this.drawAchievements(ctx); break;
      case 'stats': this.drawStats(ctx); break;
      case 'cutscene': this.drawHUD(ctx); this.drawCutscene(ctx); break;
      case 'ending': this.drawHUD(ctx); break;
      case 'victory': this.drawVictory(ctx); break;
    }

    this.drawToasts(ctx);

    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(1, this.flash);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    this.wantActivate = false;
    this.lastPX = this.input.pointer.x;
    this.lastPY = this.input.pointer.y;
  }

  // ---------- UI helpers ----------

  button(ctx, id, x, y, w, h, label, opts = {}) {
    const idx = this.buttons.length;
    this.buttons.push(id);
    const inp = this.input;
    const hover =
      (inp.pointer.x >= x && inp.pointer.x <= x + w && inp.pointer.y >= y && inp.pointer.y <= y + h);
    if (hover && (inp.pointer.x !== this.lastPX || inp.pointer.y !== this.lastPY)) this.sel = idx;
    const active = this.sel === idx;
    const clicked = (hover && inp.tapped) || (active && this.wantActivate);

    ctx.fillStyle = opts.danger ? (active ? '#7a2030' : '#4a1420') : active ? UI.panelLight : UI.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = active ? UI.accent : UI.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    const color = opts.danger ? '#ff8090' : active ? UI.accent : UI.text;
    drawText(ctx, label, x + w / 2, y + (h - 5 * (opts.scale || 1)) / 2 + 1, color, opts.scale || 1, 'center');
    if (active) drawText(ctx, '>', x + 4, y + (h - 5) / 2 + 1, UI.accent, 1);
    if (clicked) this.audio.menu();
    return clicked;
  }

  panel(ctx, x, y, w, h, title) {
    ctx.fillStyle = 'rgba(8,10,18,0.82)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = UI.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI.border;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = UI.panelLight;
    ctx.fillRect(x, y, w, 14);
    if (title) drawText(ctx, title, x + w / 2, y + 4, UI.accent, 1, 'center');
  }

  backButton(ctx, target = 'menu') {
    if (this.button(ctx, 'back', 8, H - 22, 56, 15, 'BACK')) {
      this.goto(target);
    }
    if (this.input.pressed('Escape')) this.goto(target);
  }

  drawToasts(ctx) {
    let ty = 30;
    for (const t of this.toasts) {
      const a = Math.min(1, t.t);
      ctx.globalAlpha = a;
      const w = Math.max(textWidth(t.text) + 16, 110);
      ctx.fillStyle = '#10141f';
      ctx.fillRect((W - w) / 2, ty, w, 18);
      ctx.strokeStyle = UI.accent;
      ctx.strokeRect((W - w) / 2 + 0.5, ty + 0.5, w - 1, 17);
      drawMicro(ctx, t.sub, W / 2, ty + 3, UI.dim, 1, 'center');
      drawText(ctx, t.text, W / 2, ty + 9, UI.accent, 1, 'center');
      ctx.globalAlpha = 1;
      ty += 22;
    }
  }

  drawLogo(ctx, y) {
    const bob = Math.sin(this.time * 2) * 2;
    drawTextShadow(ctx, 'FLOCKOFF', W / 2, y + bob, '#ffffff', '#20242e', 3, 'center');
    drawTextShadow(ctx, 'FLAPPY', W / 2, y + 18 + bob, UI.accent, '#20242e', 3, 'center');
    // a watching eye behind the logo
    const ex = W / 2 + 74, ey = y + 8 + bob;
    ctx.fillStyle = '#c81e1e';
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 3);
    ctx.fillRect(ex, ey, 3, 3);
    ctx.globalAlpha = 1;
  }

  // ---------- screens ----------

  drawSplash(ctx) {
    this.drawLogo(ctx, 42);
    // dove hero shot
    ctx.save();
    ctx.translate(W / 2, 104);
    ctx.scale(2, 2);
    ctx.drawImage(this.spr.dove[[0, 1, 2, 1][Math.floor(this.time * 8) % 4]], -13, -9);
    ctx.drawImage(this.disguiseCanvas(), -13, -9);
    ctx.restore();
    if (Math.sin(this.time * 4) > -0.3) {
      drawText(ctx, 'TAP TO START', W / 2, 140, '#ffffff', 1, 'center');
    }
    drawMicro(ctx, 'A TURNFLOCKOFF.COM PRODUCTION', W / 2, 164, 'rgba(255,255,255,0.7)', 1, 'center');
  }

  drawMenu(ctx) {
    this.drawLogo(ctx, 22);
    // hovering dove
    this.player.draw(ctx, this.disguiseCanvas());
    drawText(ctx, `BEST: ${this.save.highScore}`, W / 2, 58, UI.text, 1, 'center');
    drawText(ctx, `$ ${this.save.coins}`, 8, 8, UI.accent, 1);
    if (this.save.victory) drawMicro(ctx, 'FLOCK STATUS: OFF', W - 8, 8, UI.good, 1, 'right');

    const bw = 96, bx = (W - bw) / 2;
    if (this.button(ctx, 'play', bx, 70, bw, 17, 'PLAY', { scale: 1 })) this.startRun();
    if (this.button(ctx, 'shop', bx, 90, bw, 14, 'SHOP')) this.goto('shop');
    if (this.button(ctx, 'ach', bx, 107, bw, 14, 'ACHIEVEMENTS')) this.goto('achievements');
    if (this.button(ctx, 'stats', bx, 124, bw, 14, 'STATISTICS')) this.goto('stats');
    if (this.button(ctx, 'settings', bx, 141, bw, 14, 'SETTINGS')) this.goto('settings');
    if (this.button(ctx, 'credits', bx, 158, bw, 14, 'CREDITS')) this.goto('credits');
  }

  drawHUD(ctx) {
    if (this.state === 'play' || this.state === 'pause' || this.state === 'cutscene') {
      const popScale = this.scorePop > 0.15 ? 3 : 2;
      const popColor = this.scorePop > 0 ? UI.accent : '#ffffff';
      drawTextShadow(ctx, this.score, W / 2, 8, popColor, '#20242e', popScale, 'center');
      drawText(ctx, `$ ${this.runCoins}`, 8, 8, UI.accent, 1);
      // pause icon
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(W - 16, 8, 3, 9);
      ctx.fillRect(W - 11, 8, 3, 9);
    }
    if (this.levelBanner > 0 && this.state === 'play') {
      ctx.globalAlpha = Math.min(1, this.levelBanner);
      drawTextShadow(ctx, this.levelCfg.name, W / 2, 30, UI.accent, '#20242e', 1, 'center');
      ctx.globalAlpha = 1;
    }
    if (this.state === 'play' && this.stateT < 2 && this.score === 0 && !this.player.dead) {
      if (Math.sin(this.time * 5) > -0.4) drawText(ctx, 'TAP TO FLAP', W / 2, 120, '#ffffff', 1, 'center');
    }
    if (this.state === 'ending') {
      drawTextShadow(ctx, this.score, W / 2, 8, '#ffffff', '#20242e', 2, 'center');
      if (this.stateT > 1 && this.stateT < 4) {
        drawTextShadow(ctx, 'YOU MADE IT!', W / 2, 40, UI.good, '#103020', 2, 'center');
      }
    }
  }

  drawPause(ctx) {
    this.panel(ctx, 90, 40, 140, 104, 'PAUSED');
    drawText(ctx, `SCORE: ${this.score}`, W / 2, 62, UI.text, 1, 'center');
    if (this.button(ctx, 'resume', 100, 74, 120, 15, 'RESUME')) this.resume();
    if (this.button(ctx, 'settings', 100, 92, 120, 15, 'SETTINGS')) this.goto('settings');
    if (this.button(ctx, 'quit', 100, 110, 120, 15, 'QUIT RUN', { danger: true })) {
      this.player.dead = true;
      this.finishDeath();
    }
    drawMicro(ctx, 'ESC / P TO RESUME', W / 2, 130, UI.dim, 1, 'center');
  }

  drawGameOver(ctx) {
    this.panel(ctx, 70, 26, 180, 132, 'BUSTED BY FLOUK');
    drawTextShadow(ctx, 'GAME OVER', W / 2, 46, UI.danger, '#20242e', 2, 'center');
    drawText(ctx, `SCORE: ${this.score}`, W / 2, 64, UI.text, 1, 'center');
    drawText(ctx, `BEST: ${this.save.highScore}`, W / 2, 74, this.newBest ? UI.accent : UI.dim, 1, 'center');
    if (this.newBest && Math.sin(this.time * 6) > -0.2) {
      drawText(ctx, 'NEW BEST!', W / 2 + 62, 64, UI.accent, 1, 'center');
    }
    drawText(ctx, `$ ${this.runCoins} COLLECTED`, W / 2, 86, UI.accent, 1, 'center');
    // medal
    const medal = this.score >= 40 ? ['PLATINUM', '#d8e4f0'] : this.score >= 25 ? ['GOLD', '#ffd040'] : this.score >= 10 ? ['SILVER', '#c0c8d8'] : this.score >= 3 ? ['BRONZE', '#c88848'] : null;
    if (medal) {
      const mx = W / 2 - textWidth(`MEDAL: ${medal[0]}`) / 2 - 10;
      ctx.fillStyle = medal[1];
      ctx.beginPath();
      ctx.arc(mx, 100, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#20242e';
      ctx.stroke();
      drawText(ctx, `MEDAL: ${medal[0]}`, W / 2 + 3, 98, medal[1], 1, 'center');
    }
    if (this.button(ctx, 'retry', 80, 112, 76, 16, 'RETRY')) this.startRun();
    if (this.button(ctx, 'menu', 164, 112, 76, 16, 'MENU')) {
      this.audio.playSong('main');
      this.resetRun();
      this.goto('menu');
    }
    drawMicro(ctx, 'SPACE / TAP RETRY', W / 2, 136, UI.dim, 1, 'center');
    if (this.input.pressed('Space') && this.stateT > 0.5) this.startRun();
  }

  drawSettings(ctx) {
    this.panel(ctx, 60, 18, 200, 148, 'SETTINGS');
    const s = this.save.settings;
    const row = (i) => 38 + i * 18;
    const opt = (i, id, label, val) => {
      drawText(ctx, label, 70, row(i) + 4, UI.text, 1);
      if (this.button(ctx, id, 178, row(i), 72, 14, val ? 'ON' : 'OFF')) {
        this.audio.menu();
        return true;
      }
      return false;
    };
    if (opt(0, 'music', 'MUSIC', s.music)) { s.music = !s.music; this.audio.applySettings(); this.persist(); }
    if (opt(1, 'sfx', 'SOUND FX', s.sfx)) { s.sfx = !s.sfx; this.audio.applySettings(); this.persist(); }
    if (opt(2, 'voice', 'ROBOT VOICE', s.voice)) { s.voice = !s.voice; this.persist(); }
    if (opt(3, 'shake', 'SCREEN SHAKE', s.shake)) { s.shake = !s.shake; this.persist(); }
    if (this.button(ctx, 'reset', 70, row(4) + 2, 180, 14, this.confirmReset ? 'REALLY? TAP AGAIN' : 'RESET SAVE DATA', { danger: true })) {
      if (this.confirmReset) {
        this.save = resetSave();
        this.audio.settings = this.save.settings;
        this.audio.applySettings();
        this.confirmReset = false;
        this.toasts.push({ text: 'SAVE WIPED', sub: 'FRESH START', t: 2 });
      } else {
        this.confirmReset = true;
      }
    }
    this.backButton(ctx, this.stateFrom === 'pause' ? 'pause' : 'menu');
  }

  drawShop(ctx) {
    this.panel(ctx, 24, 10, 272, 160, 'DISGUISE SHOP');
    drawText(ctx, `$ ${this.save.coins}`, 282, 14, UI.accent, 1, 'right');

    const items = SHOP;
    const rowH = 17;
    items.forEach((item, i) => {
      const y = 28 + i * rowH;
      drawText(ctx, item.name, 32, y + 2, UI.text, 1);
      drawMicro(ctx, item.desc, 32, y + 9, UI.dim, 1);

      let label, disabled = false, equipped = false;
      if (item.kind === 'upgrade') {
        const lvl = this.save.upgrades[item.id];
        if (lvl >= item.max) { label = 'MAX'; disabled = true; }
        else label = `$${item.price * (lvl + 1)}${item.max > 1 ? ` LV${lvl + 1}` : ''}`;
      } else if (this.save.owned[item.id]) {
        const slot = item.kind === 'disguise' ? 'disguise' : 'trail';
        equipped = this.save.equipped[slot] === item.id;
        label = equipped ? 'WORN' : 'EQUIP';
        if (item.kind === 'trail') label = equipped ? 'ON' : 'USE';
      } else {
        label = `$${item.price}`;
      }
      if (this.button(ctx, `it_${item.id}`, 216, y, 72, 14, label) && !disabled) {
        this.shopAction(item, equipped);
      }
    });
    this.backButton(ctx);
  }

  shopAction(item, equipped) {
    const s = this.save;
    if (item.kind === 'upgrade') {
      const lvl = s.upgrades[item.id];
      const cost = item.price * (lvl + 1);
      if (lvl < item.max && s.coins >= cost) {
        s.coins -= cost;
        s.upgrades[item.id]++;
        this.audio.purchase();
        this.toasts.push({ text: item.name, sub: 'UPGRADED', t: 2 });
      } else this.audio.denied();
    } else if (!s.owned[item.id]) {
      if (s.coins >= item.price) {
        s.coins -= item.price;
        s.owned[item.id] = true;
        this.audio.purchase();
        this.toasts.push({ text: item.name, sub: 'UNLOCKED', t: 2 });
        // auto-equip on purchase
        s.equipped[item.kind === 'disguise' ? 'disguise' : 'trail'] = item.id;
      } else this.audio.denied();
    } else {
      const slot = item.kind === 'disguise' ? 'disguise' : 'trail';
      s.equipped[slot] = equipped && slot === 'trail' ? 'white' : item.id;
      this.audio.menu();
    }
    this.checkAchievements();
    this.persist();
  }

  drawAchievements(ctx) {
    this.panel(ctx, 24, 10, 272, 160, 'ACHIEVEMENTS');
    const perPage = 6;
    const pages = Math.ceil(ACHIEVEMENTS.length / perPage);
    const start = this.achPage * perPage;
    const unlockedCount = ACHIEVEMENTS.filter((a) => this.save.achievements[a.id]).length;
    drawText(ctx, `${unlockedCount}/${ACHIEVEMENTS.length}`, 282, 14, UI.accent, 1, 'right');

    ACHIEVEMENTS.slice(start, start + perPage).forEach((a, i) => {
      const y = 28 + i * 19;
      const got = !!this.save.achievements[a.id];
      ctx.fillStyle = got ? '#243a28' : '#20242e';
      ctx.fillRect(32, y - 2, 256, 17);
      ctx.strokeStyle = got ? UI.good : '#3a4054';
      ctx.strokeRect(32.5, y - 1.5, 255, 16);
      drawText(ctx, got ? '*' : '?', 40, y + 3, got ? UI.accent : UI.dim, 1);
      drawText(ctx, a.name, 52, y + 1, got ? UI.good : UI.text, 1);
      drawMicro(ctx, a.desc, 52, y + 8, UI.dim, 1);
    });
    if (pages > 1) {
      if (this.button(ctx, 'prev', 76, H - 22, 32, 15, '<')) this.achPage = (this.achPage + pages - 1) % pages;
      if (this.button(ctx, 'next', 114, H - 22, 32, 15, '>')) this.achPage = (this.achPage + 1) % pages;
      drawText(ctx, `${this.achPage + 1}/${pages}`, 160, H - 18, UI.dim, 1);
    }
    this.backButton(ctx);
  }

  drawStats(ctx) {
    this.panel(ctx, 24, 10, 272, 160, 'STATISTICS');
    const st = this.save.stats;
    const rows = [
      ['HIGH SCORE', this.save.highScore],
      ['RUNS FLOWN', st.games],
      ['TOTAL SCORE', st.totalScore],
      ['CAMERAS PASSED', st.camerasPassed],
      ['TOTAL FLAPS', st.flaps],
      ['COINS COLLECTED', st.coinsCollected],
      ['DRONES OUTFLOWN', st.dronesDodged],
      ['DISTANCE', `${Math.round(st.distance)} M`],
      ['TIMES BUSTED', st.deaths],
      ['REVIVES', st.revives],
      ['TIME PLAYED', `${Math.floor(st.playtime / 60)}M ${Math.floor(st.playtime % 60)}S`],
      ['MISSION', this.save.victory ? 'COMPLETE' : 'IN PROGRESS'],
    ];
    rows.forEach(([k, v], i) => {
      const col = i % 2, row = (i / 2) | 0;
      const x = 34 + col * 134;
      const y = 30 + row * 20;
      drawMicro(ctx, k, x, y, UI.dim, 1);
      drawText(ctx, String(v), x, y + 7, i === 11 && this.save.victory ? UI.good : UI.text, 1);
    });
    this.backButton(ctx);
  }

  drawCredits(ctx) {
    ctx.fillStyle = 'rgba(8,10,18,0.88)';
    ctx.fillRect(0, 0, W, H);
    let y = this.creditY;
    for (const line of CREDITS) {
      if (y > -8 && y < H + 4) {
        const isTitle = line === 'FLOCKOFF FLAPPY' || line === 'TURNFLOCKOFF.COM';
        drawText(ctx, line, W / 2, y, isTitle ? UI.accent : UI.text, isTitle ? 2 : 1, 'center');
      }
      y += line === '' ? 8 : 14;
    }
    if (y < 0) this.creditY = H + 10;
    this.backButton(ctx);
  }

  drawCutscene(ctx) {
    const t = this.stateT;
    // glitch: torn horizontal slices of the live frame + noise
    if (this.cutPhase === 1 || this.cutPhase === 3) {
      for (let i = 0; i < 10; i++) {
        const sy = (Math.random() * H) | 0;
        const sh = 2 + (Math.random() * 8) | 0;
        const off = ((Math.random() - 0.5) * 30) | 0;
        ctx.drawImage(this.canvas, 0, sy, W, sh, off, sy, W, sh);
      }
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = ['#ff0040', '#00ffc8', '#ffffff', '#4040ff'][(Math.random() * 4) | 0];
        ctx.globalAlpha = 0.3;
        ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 20, 1 + Math.random() * 2);
      }
      ctx.globalAlpha = 1;
    }
    if (this.cutPhase >= 2) {
      // freeway sign slides down
      const sign = this.spr.welcomeSign;
      const slide = Math.min(1, (t - 1.6) / 0.8);
      const sy = -70 + slide * 100;
      ctx.drawImage(sign, ((W - sign.width) / 2) | 0, sy | 0);
      if (this.cutPhase === 2 && slide >= 1) {
        ctx.fillStyle = `rgba(255,40,40,${0.12 + 0.08 * Math.sin(t * 10)})`;
        ctx.fillRect(0, 0, W, H);
        if (Math.sin(t * 8) > 0) {
          drawMicro(ctx, 'SURVEILLANCE LEVEL: MAXIMUM', W / 2, 118, '#ff5060', 1, 'center');
        }
      }
    }
    if (this.cutPhase === 0) {
      // everything pauses: subtle vignette + static tick
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  drawVictory(ctx) {
    // serene sky wash
    ctx.fillStyle = 'rgba(10,16,28,0.78)';
    ctx.fillRect(0, 0, W, H);
    const t = this.stateT;
    drawTextShadow(ctx, 'MISSION COMPLETE', W / 2, 22, UI.good, '#0a2016', 2, 'center');
    if (t > 0.8) drawTextShadow(ctx, 'YOU TURNED FLOCK OFF', W / 2, 40, UI.accent, '#20242e', 1, 'center');

    if (t > 1.4) {
      const st = [
        ['SCORE', this.score],
        ['COINS', this.runStats.coins],
        ['FLAPS', this.runStats.flaps],
        ['DRONES DODGED', this.runStats.drones],
      ];
      st.forEach(([k, v], i) => {
        const y = 58 + i * 12;
        drawText(ctx, k, 100, y, UI.dim, 1);
        drawText(ctx, String(v), 220, y, UI.text, 1, 'right');
      });
    }
    if (t > 2.2) {
      // mini credits crawl
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 108, W, 46);
      ctx.clip();
      let y = this.creditY;
      for (const line of CREDITS) {
        if (y > 100 && y < 158) drawMicro(ctx, line, W / 2, y, 'rgba(232,236,248,0.8)', 1, 'center');
        y += line === '' ? 6 : 9;
      }
      if (y < 108) this.creditY = 160;
      ctx.restore();
    }
    if (t > 2 && Math.sin(this.time * 4) > -0.3) {
      drawText(ctx, 'TAP TO CONTINUE', W / 2, 164, '#ffffff', 1, 'center');
    }
  }
}
