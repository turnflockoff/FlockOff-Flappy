// Scrolling world: layered parallax skyline, procedural buildings, ground,
// weather (day/night, clouds, rain, fog) and background-only surveillance
// decorations + easter-egg signage. Everything is deterministic from the
// scroll position via hashRand, so the world is infinite and stable.

import { hashRand } from '../gfx/pix.js';
import { W, H, GROUND_Y, LEVELS } from './data.js';

function hexRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function blendLevels(from, to, t) {
  const a = LEVELS[from], b = LEVELS[to];
  const m = (k) => a[k] + (b[k] - a[k]) * t;
  return {
    sky: [mixHex(a.sky[0], b.sky[0], t), mixHex(a.sky[1], b.sky[1], t)],
    hills: mixHex(a.hills, b.hills, t),
    buildings: a.buildings.map((c, i) => mixHex(c, b.buildings[i], t)),
    night: m('night'), rain: m('rain'), fog: m('fog'),
    bgCamChance: m('bgCamChance'), decoChance: m('decoChance'),
    droneEvery: b.droneEvery, speed: m('speed'), gap: m('gap'), spacing: m('spacing'),
    name: b.name,
  };
}

export class World {
  constructor(sprites) {
    this.spr = sprites;
    this.x = 0;
    this.time = 0;
    this.rain = [];
    for (let i = 0; i < 90; i++) {
      this.rain.push({ x: Math.random() * W, y: Math.random() * H, s: 180 + Math.random() * 120 });
    }
  }

  update(dt, speed) {
    this.x += speed * dt;
    this.time += dt;
  }

  draw(ctx, cfg, particles) {
    const { x } = this;
    // sky
    const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, cfg.sky[0]);
    grad.addColorStop(1, cfg.sky[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // stars at night
    if (cfg.night > 0.3) {
      ctx.fillStyle = `rgba(255,255,255,${(cfg.night - 0.3) * 0.9})`;
      for (let i = 0; i < 40; i++) {
        const sx = (hashRand(i, 77) * W * 2 - x * 0.02) % W;
        const sy = hashRand(i, 78) * 80;
        const tw = Math.sin(this.time * 2 + i) > 0.4 ? 1 : 0;
        if (tw) ctx.fillRect(((sx + W) % W) | 0, sy | 0, 1, 1);
      }
    }

    // sun / moon
    const sunY = 26, sunX = 262;
    if (cfg.night < 0.5) {
      ctx.globalAlpha = 1 - cfg.night;
      ctx.fillStyle = '#ffe890';
      ctx.beginPath();
      ctx.fillRect(sunX - 7, sunY - 7, 14, 14);
      ctx.fillRect(sunX - 9, sunY - 4, 18, 8);
      ctx.fillRect(sunX - 4, sunY - 9, 8, 18);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = (cfg.night - 0.4) * 1.4;
      ctx.fillStyle = '#e8ecf8';
      ctx.fillRect(sunX - 6, sunY - 6, 12, 12);
      ctx.fillRect(sunX - 8, sunY - 3, 16, 6);
      ctx.fillStyle = '#c8ccd8';
      ctx.fillRect(sunX - 2, sunY - 3, 3, 3);
      ctx.globalAlpha = 1;
    }

    this._clouds(ctx, cfg);
    this._hills(ctx, cfg);
    this._buildings(ctx, cfg, 0.35, 60, 0, true);   // far
    this._buildings(ctx, cfg, 0.6, 44, 1, false);   // near (with decor)
    this._ground(ctx, cfg);
    if (cfg.rain > 0.05) this._rain(ctx, cfg, particles);
    if (cfg.fog > 0.02) {
      const fg = ctx.createLinearGradient(0, H, 0, 40);
      fg.addColorStop(0, `rgba(180,190,210,${cfg.fog * 0.55})`);
      fg.addColorStop(1, 'rgba(180,190,210,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _clouds(ctx, cfg) {
    const par = 0.12;
    const spacing = 90;
    ctx.globalAlpha = 0.85 - cfg.night * 0.45;
    const first = Math.floor((this.x * par) / spacing) - 1;
    for (let i = first; i < first + W / spacing + 2; i++) {
      if (hashRand(i, 5) < 0.35) continue;
      const spr = this.spr.clouds[(hashRand(i, 6) * 3) | 0];
      const sx = i * spacing - this.x * par + hashRand(i, 7) * 40;
      const sy = 14 + hashRand(i, 8) * 52;
      ctx.drawImage(spr, sx | 0, sy | 0);
    }
    ctx.globalAlpha = 1;
  }

  _hills(ctx, cfg) {
    const par = 0.2;
    ctx.fillStyle = cfg.hills;
    const seg = 40;
    const first = Math.floor((this.x * par) / seg) - 1;
    for (let i = first; i < first + W / seg + 2; i++) {
      const sx = i * seg - this.x * par;
      const h = 18 + hashRand(i, 11) * 26;
      ctx.beginPath();
      ctx.moveTo(sx, GROUND_Y);
      ctx.lineTo(sx + seg / 2, GROUND_Y - h);
      ctx.lineTo(sx + seg, GROUND_Y);
      ctx.fill();
    }
  }

  _buildings(ctx, cfg, par, spacing, salt, far) {
    const first = Math.floor((this.x * par) / spacing) - 1;
    for (let i = first; i < first + W / spacing + 3; i++) {
      const r = hashRand(i, 21 + salt);
      if (r < 0.12) continue; // gap between buildings
      const sx = (i * spacing - this.x * par) | 0;
      const bw = (spacing * (0.6 + hashRand(i, 22 + salt) * 0.35)) | 0;
      const bh = (26 + hashRand(i, 23 + salt) * (far ? 60 : 78)) | 0;
      const col = cfg.buildings[(hashRand(i, 24 + salt) * cfg.buildings.length) | 0];
      const by = GROUND_Y - bh;
      ctx.fillStyle = col;
      ctx.fillRect(sx, by, bw, bh);
      // roof lip
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(sx, by, bw, 2);
      // windows
      const lit = cfg.night;
      for (let wy = by + 5; wy < GROUND_Y - 6; wy += 8) {
        for (let wx = sx + 3; wx < sx + bw - 4; wx += 7) {
          const wr = hashRand(i, wx * 13 + wy * 7, salt);
          const isLit = wr < lit * 0.55 + 0.06;
          ctx.fillStyle = isLit ? '#ffd870' : 'rgba(10,12,20,0.45)';
          ctx.fillRect(wx, wy, 3, 4);
        }
      }
      if (!far) this._decor(ctx, cfg, i, sx, by, bw);
    }
  }

  // Background-only decorations: small dark blurred cameras + easter eggs.
  _decor(ctx, cfg, i, sx, by, bw) {
    const spr = this.spr;
    ctx.globalAlpha = 0.8;
    // rooftop cameras / drone docks / PTZ
    if (hashRand(i, 31) < cfg.bgCamChance * 0.5) {
      const kind = [1, 3, 5, 6][(hashRand(i, 32) * 4) | 0];
      const c = spr.bgCams[kind];
      ctx.drawImage(c, sx + 3 + ((bw - 10) * hashRand(i, 33)) | 0, by - c.height + 2);
    }
    if (cfg.bgCamChance > 1 && hashRand(i, 36) < cfg.bgCamChance - 1) {
      const c = spr.bgCams[1];
      ctx.drawImage(c, sx + bw - 12, by - c.height + 2);
    }
    // wall-mounted building/garage cams
    if (hashRand(i, 34) < cfg.bgCamChance * 0.4) {
      const c = spr.bgCams[hashRand(i, 35) < 0.5 ? 2 : 3];
      ctx.drawImage(c, sx + 2, by + 8);
    }
    ctx.globalAlpha = 1;
    // rooftop neon sign easter egg
    if (hashRand(i, 41) < 0.06 && bw > 66) {
      ctx.drawImage(spr.rooftopSign, sx + ((bw - spr.rooftopSign.width) / 2) | 0, by - spr.rooftopSign.height);
    }
    // wall graffiti easter egg
    if (hashRand(i, 42) < 0.14) {
      const g = spr.graffiti[(hashRand(i, 43) * spr.graffiti.length) | 0];
      if (g.width < bw - 6) ctx.drawImage(g, sx + 3, GROUND_Y - 14);
    }
  }

  _ground(ctx, cfg) {
    // sidewalk + road
    ctx.fillStyle = mixHex('#8a8878', '#3c3c4c', cfg.night);
    ctx.fillRect(0, GROUND_Y, W, 5);
    ctx.fillStyle = mixHex('#4a4e58', '#22242e', cfg.night);
    ctx.fillRect(0, GROUND_Y + 5, W, H - GROUND_Y - 5);
    // curb line
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, GROUND_Y + 4, W, 1);
    // lane dashes
    ctx.fillStyle = mixHex('#d8d060', '#8a8440', cfg.night);
    const dashOff = -(this.x % 24);
    for (let dx = dashOff; dx < W; dx += 24) {
      ctx.fillRect(dx | 0, GROUND_Y + 11, 10, 2);
    }
    // roadside props (billboards, street cams, bridges) at full parallax
    const spacing = 130;
    const first = Math.floor(this.x / spacing) - 1;
    for (let i = first; i < first + W / spacing + 3; i++) {
      const sx = (i * spacing - this.x) | 0;
      const r = hashRand(i, 51);
      if (r < 0.09) {
        ctx.drawImage(this.spr.billboard, sx, GROUND_Y - this.spr.billboard.height + 1);
      } else if (r < 0.13) {
        // overpass bridge with easter-egg graffiti
        ctx.fillStyle = mixHex('#7a7468', '#2e3040', cfg.night);
        ctx.fillRect(sx + 4, 34, 10, GROUND_Y - 34);
        ctx.fillRect(sx + 92, 34, 10, GROUND_Y - 34);
        ctx.fillRect(sx - 6, 26, 118, 10);
        const g = this.spr.graffiti[(hashRand(i, 52) * this.spr.graffiti.length) | 0];
        ctx.drawImage(g, sx + 20, 27);
        ctx.globalAlpha = 0.85;
        ctx.drawImage(this.spr.bgCams[4], sx + 30, 36);
        ctx.globalAlpha = 1;
      } else if (r < 0.13 + cfg.bgCamChance * 0.18) {
        ctx.globalAlpha = 0.85;
        const c = this.spr.bgCams[hashRand(i, 53) < 0.5 ? 0 : 6];
        ctx.drawImage(c, sx, GROUND_Y - c.height + 1);
        ctx.globalAlpha = 1;
      } else if (r > 0.92) {
        // ground graffiti
        const g = this.spr.graffiti[(hashRand(i, 54) * this.spr.graffiti.length) | 0];
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.drawImage(g, sx, GROUND_Y + 6);
        ctx.restore();
      }
    }
  }

  _rain(ctx, cfg, particles) {
    ctx.strokeStyle = `rgba(160,190,230,${0.25 + cfg.rain * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const n = (this.rain.length * cfg.rain) | 0;
    for (let i = 0; i < n; i++) {
      const d = this.rain[i];
      d.y += d.s * (1 / 60);
      d.x -= d.s * 0.25 * (1 / 60);
      if (d.y > GROUND_Y + 8) {
        if (particles && Math.random() < 0.3) particles.splash(d.x, GROUND_Y + 2);
        d.y = -6;
        d.x = Math.random() * (W + 40);
      }
      ctx.moveTo(d.x | 0, d.y | 0);
      ctx.lineTo((d.x - 1.5) | 0, (d.y + 5) | 0);
    }
    ctx.stroke();
  }
}
