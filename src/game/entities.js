// Game entities: the dove, FLOUK camera obstacles, hunter drones, coins,
// and the ending portal.

import { W, H, GROUND_Y } from './data.js';
import { drawMicro } from '../core/font.js';

const GRAVITY = 640;
const FLAP_VY = -218;

export class Player {
  constructor(sprites) {
    this.spr = sprites;
    this.reset();
  }

  reset() {
    this.x = 70;
    this.y = 80;
    this.vy = 0;
    this.r = 6;
    this.tilt = 0;
    this.animT = 0;
    this.frame = 1;
    this.eyeT = 0;
    this.eyeDx = 0;
    this.eyeDy = 0;
    this.eyeTx = 0;
    this.eyeTy = 0;
    this.featherT = 0;
    this.dead = false;
  }

  flap() {
    this.vy = FLAP_VY;
    this.animT = 0;
  }

  update(dt, particles, trailColors, floating = false) {
    if (floating) {
      // menu hover bob
      this.y = 80 + Math.sin(performance.now() / 400) * 6;
      this.vy = 0;
      this.tilt = 0;
    } else {
      this.vy += GRAVITY * dt;
      if (this.vy > 300) this.vy = 300;
      this.y += this.vy * dt;
      const target = Math.max(-0.5, Math.min(1.15, this.vy / 280));
      this.tilt += (target - this.tilt) * Math.min(1, dt * 10);
    }

    // wing animation: fast right after a flap, lazy glide otherwise
    this.animT += dt;
    const rate = this.vy < 0 ? 0.05 : 0.11;
    this.frame = [0, 1, 2, 1][Math.floor(this.animT / rate) % 4];

    // paranoid darting eyes
    this.eyeT -= dt;
    if (this.eyeT <= 0) {
      this.eyeT = 0.25 + Math.random() * 0.9;
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * this.spr.doveEye.r;
      this.eyeTx = Math.cos(a) * d;
      this.eyeTy = Math.sin(a) * d;
    }
    this.eyeDx += (this.eyeTx - this.eyeDx) * Math.min(1, dt * 18);
    this.eyeDy += (this.eyeTy - this.eyeDy) * Math.min(1, dt * 18);

    // feather trail
    this.featherT -= dt;
    if (this.featherT <= 0 && !this.dead) {
      this.featherT = 0.16 + Math.random() * 0.12;
      const c = trailColors[(Math.random() * trailColors.length) | 0];
      particles.feather(this.x - 8, this.y + (Math.random() - 0.3) * 6, c);
    }
  }

  draw(ctx, disguiseCanvas) {
    const spr = this.spr;
    const img = spr.dove[this.frame];
    ctx.save();
    ctx.translate(this.x | 0, this.y | 0);
    ctx.rotate(this.tilt * 0.9);
    const ox = -13, oy = -9; // sprite center offset
    ctx.drawImage(img, ox, oy);
    // pupil (dynamic, darting)
    ctx.fillStyle = '#141420';
    ctx.fillRect(
      (ox + spr.doveEye.x + this.eyeDx - 0.5) | 0,
      (oy + spr.doveEye.y + this.eyeDy - 0.5) | 0,
      2, 2
    );
    if (disguiseCanvas) ctx.drawImage(disguiseCanvas, ox, oy);
    ctx.restore();
  }
}

let obstacleSeq = 0;

export class Obstacle {
  // A FLOUK camera pair: one mounted on a ground pole, one hanging from a
  // top gantry pole, with a gap between them.
  constructor(x, gapY, gapH, sprites) {
    this.x = x;
    this.gapY = gapY;
    this.gapH = gapH;
    this.spr = sprites;
    this.passed = false;
    this.exploded = false;
    this.id = obstacleSeq++;
    this.sweep = Math.random() * Math.PI * 2;
    this.flashT = 3 + Math.random() * 6;
    this.flashing = 0;
    this.poleW = 8;
  }

  get topEnd() { return this.gapY - this.gapH / 2; }   // bottom edge of top unit
  get botStart() { return this.gapY + this.gapH / 2; } // top edge of bottom unit

  update(dt, speed) {
    this.x -= speed * dt;
    this.sweep += dt * 0.9;
    this.flashT -= dt;
    if (this.flashT <= 0) {
      this.flashing = 0.12;
      this.flashT = 4 + Math.random() * 7;
    }
    if (this.flashing > 0) this.flashing -= dt;
  }

  rects() {
    const head = this.spr.flouk.canvas;
    const px = this.x - this.poleW / 2;
    return [
      // bottom: pole + head
      { x: px, y: this.botStart + head.height - 6, w: this.poleW, h: GROUND_Y - this.botStart },
      { x: this.x - head.width / 2 + 2, y: this.botStart, w: head.width - 6, h: head.height - 2 },
      // top: pole + head (flipped); pole height clamps to 0 when the gap
      // sits high enough that the head alone reaches the ceiling
      { x: px, y: 0, w: this.poleW, h: Math.max(0, this.topEnd - head.height + 6) },
      { x: this.x - head.width / 2 + 2, y: this.topEnd - head.height + 2, w: head.width - 6, h: head.height - 2 },
    ];
  }

  hits(px, py, r) {
    for (const rc of this.rects()) {
      const cx = Math.max(rc.x, Math.min(px, rc.x + rc.w));
      const cy = Math.max(rc.y, Math.min(py, rc.y + rc.h));
      const dx = px - cx, dy = py - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  draw(ctx, time) {
    if (this.exploded) return;
    const spr = this.spr;
    const head = spr.flouk.canvas;
    const hx = (this.x - head.width / 2) | 0;

    // --- bottom unit ---
    const by = this.botStart | 0;
    this._pole(ctx, by + head.height - 6, GROUND_Y);
    ctx.drawImage(spr.battery, (this.x - spr.battery.width / 2) | 0, Math.min(GROUND_Y - 14, by + head.height + 16));
    ctx.drawImage(spr.placard, (this.x - spr.placard.width / 2) | 0, Math.min(GROUND_Y - 30, by + head.height + 30));
    ctx.drawImage(head, hx, by);
    this._eyeFx(ctx, hx, by, false, time);

    // --- top unit (flipped vertically) ---
    const ty = (this.topEnd - head.height) | 0;
    this._pole(ctx, 0, ty + 8);
    ctx.save();
    ctx.translate(hx, ty + head.height);
    ctx.scale(1, -1);
    ctx.drawImage(head, 0, 0);
    ctx.restore();
    this._eyeFx(ctx, hx, ty, true, time);
  }

  _pole(ctx, y0, y1) {
    if (y1 <= y0) return;
    const px = (this.x - this.poleW / 2) | 0;
    ctx.fillStyle = '#6a7080';
    ctx.fillRect(px, y0, this.poleW, y1 - y0);
    ctx.fillStyle = '#8a90a0';
    ctx.fillRect(px + 1, y0, 2, y1 - y0);
    ctx.fillStyle = '#14141e';
    ctx.fillRect(px - 1, y0, 1, y1 - y0);
    ctx.fillRect(px + this.poleW, y0, 1, y1 - y0);
    ctx.fillStyle = '#4a5060';
    for (let y = y0 + 6; y < y1 - 3; y += 12) ctx.fillRect(px + this.poleW - 3, y, 2, 2);
  }

  _eyeFx(ctx, hx, hy, flipped, time) {
    const spr = this.spr;
    const head = spr.flouk.canvas;
    const ex = hx + spr.flouk.eye.x;
    const ey = flipped ? hy + head.height - spr.flouk.eye.y : hy + spr.flouk.eye.y;

    // pulsing lens glow
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + this.id * 1.7);
    ctx.globalAlpha = 0.25 + pulse * 0.3;
    ctx.fillStyle = '#ff3030';
    ctx.beginPath();
    ctx.arc(ex, ey, 6 + pulse * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pulse > 0.5 ? '#ff6060' : '#e04040';
    ctx.fillRect(ex - 1, ey - 1, 2, 2);

    // sweeping scanner beam
    const dir = flipped ? 1 : -1;
    const ang = dir * (0.35 + Math.sin(this.sweep) * 0.4);
    const len = 55;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(flipped ? -ang : ang);
    const g = ctx.createLinearGradient(0, 0, -len, 0);
    g.addColorStop(0, 'rgba(255,40,40,0.35)');
    g.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-len, -10);
    ctx.lineTo(-len, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // blinking status LED
    if (Math.sin(time * 6 + this.id) > 0) {
      const lx = hx + spr.flouk.led.x;
      const ly = flipped ? hy + head.height - spr.flouk.led.y : hy + spr.flouk.led.y;
      ctx.fillStyle = '#40ff60';
      ctx.fillRect(lx, ly, 1, 1);
    }

    // occasional white capture flash
    if (this.flashing > 0) {
      ctx.globalAlpha = Math.min(1, this.flashing * 8);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex, ey, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

export class Drone {
  constructor(sprites, targetY) {
    this.spr = sprites;
    this.x = W + 20;
    this.y = targetY;
    this.vx = 0;
    this.vy = 0;
    this.r = 6;
    this.state = 'enter';
    this.t = 0;
    this.bob = Math.random() * Math.PI * 2;
    this.frame = 0;
    this.animT = 0;
    this.warned = false;
    this.counted = false;
  }

  update(dt, player, speed) {
    this.t += dt;
    this.animT += dt;
    if (this.animT > 0.05) { this.animT = 0; this.frame = 1 - this.frame; }
    this.bob += dt * 5;

    switch (this.state) {
      case 'enter':
        this.x += (250 - this.x) * dt * 2.2 - speed * dt * 0.2;
        this.y += (player.y - this.y) * dt * 1.6;
        if (this.x < 262) { this.state = 'hover'; this.t = 0; }
        break;
      case 'hover':
        this.y += (player.y - this.y) * dt * 2.4;
        this.y += Math.sin(this.bob) * 8 * dt;
        this.x += Math.sin(this.bob * 0.6) * 6 * dt;
        if (this.t > 1.15) { this.state = 'charge'; this.t = 0; }
        break;
      case 'charge': // telegraphed wind-up before the dash
        this.x += Math.sin(this.t * 60) * 0.8;
        if (this.t > 0.55) { this.state = 'dash'; this.t = 0; this.vx = -290; }
        break;
      case 'dash':
        this.x += this.vx * dt;
        if (this.x < -30) { this.state = 'return'; this.t = 0; }
        break;
      case 'return': // swings back up and off-screen
        this.x += 150 * dt;
        this.y -= 120 * dt;
        break;
    }
  }

  get gone() { return this.state === 'return' && (this.y < -30 || this.x > W + 40); }

  hits(px, py, r) {
    const dx = px - this.x, dy = py - this.y;
    const rr = r + this.r;
    return dx * dx + dy * dy < rr * rr;
  }

  draw(ctx, time) {
    const img = this.spr.drone[this.frame];
    const y = (this.y + Math.sin(this.bob) * 1.5) | 0;
    ctx.drawImage(img, (this.x - 11) | 0, y - 7);
    // glowing eye
    const pulse = this.state === 'charge' ? (Math.sin(time * 30) > 0 ? 1 : 0.3) : 0.6 + 0.4 * Math.sin(time * 4);
    ctx.globalAlpha = pulse * 0.5;
    ctx.fillStyle = '#ff3030';
    ctx.beginPath();
    ctx.arc((this.x - 5) | 0, y + 1, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // belly scanner cone
    if (this.state === 'hover' || this.state === 'enter') {
      const g = ctx.createLinearGradient(0, y + 6, 0, y + 26);
      g.addColorStop(0, 'rgba(255,40,40,0.3)');
      g.addColorStop(1, 'rgba(255,40,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(this.x - 2, y + 6);
      ctx.lineTo(this.x + 2, y + 6);
      ctx.lineTo(this.x + 7, y + 26);
      ctx.lineTo(this.x - 7, y + 26);
      ctx.fill();
    }
  }
}

export class Coin {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.t = Math.random() * 4;
    this.taken = false;
  }

  update(dt, speed, player, magnetLvl) {
    this.t += dt;
    this.x -= speed * dt;
    const pull = 20 + magnetLvl * 18;
    const dx = player.x - this.x, dy = player.y - this.y;
    const d2 = dx * dx + dy * dy;
    if (magnetLvl > 0 && d2 < pull * pull) {
      const d = Math.sqrt(d2) || 1;
      const s = (140 + magnetLvl * 40) * dt;
      this.x += (dx / d) * s;
      this.y += (dy / d) * s;
    } else {
      this.y = this.baseY + Math.sin(this.t * 3) * 2;
      this.baseY = this.y - Math.sin(this.t * 3) * 2;
    }
  }

  draw(ctx, sprites) {
    const f = Math.floor(this.t * 8) % 4;
    ctx.drawImage(sprites.coin[f], (this.x - 4) | 0, (this.y - 4) | 0);
  }
}

export class Portal {
  constructor() {
    this.x = W + 60;
    this.y = 88;
    this.t = 0;
    this.open = 0;
  }

  update(dt) {
    this.t += dt;
    if (this.x > 235) this.x -= 40 * dt;
    this.open = Math.min(1, this.open + dt * 0.7);
  }

  draw(ctx) {
    const r = 34 * this.open;
    if (r < 2) return;
    const { x, y } = this;
    // glow halo
    const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 1.8);
    g.addColorStop(0, 'rgba(120,255,200,0.5)');
    g.addColorStop(1, 'rgba(120,255,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    // swirl rings
    for (let i = 0; i < 3; i++) {
      const rr = r - i * 6;
      if (rr <= 0) continue;
      ctx.strokeStyle = ['#a8ffe0', '#50e0a8', '#208860'][i];
      ctx.lineWidth = 3 - i;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.25) {
        const wob = Math.sin(a * 5 + this.t * 4 + i) * 1.5;
        const px = x + Math.cos(a) * (rr + wob);
        const py = y + Math.sin(a) * (rr + wob);
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // inner light
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#eafff6';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r - 16 + Math.sin(this.t * 6) * 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // the destination, glowing above the portal
    if (this.open > 0.8) {
      const bl = 0.7 + 0.3 * Math.sin(this.t * 5);
      ctx.globalAlpha = bl;
      drawMicro(ctx, 'TURNFLOCKOFF.COM', x, y - r - 14, '#a8ffe0', 1, 'center');
      ctx.globalAlpha = 1;
    }
  }
}
