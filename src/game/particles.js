// Particle system: feathers, sparks, explosions, dust, rain splashes.

export class Particles {
  constructor() {
    this.list = [];
  }

  spawn(p) {
    if (this.list.length > 400) this.list.shift();
    this.list.push({
      x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 1,
      life: 1, maxLife: 1, size: 2, color: '#ffffff',
      type: 'dot', rot: Math.random() * Math.PI * 2, vr: 0,
      flutter: 0,
      ...p,
      maxLife: p.life ?? 1,
    });
  }

  feather(x, y, color, burst = false) {
    this.spawn({
      x, y,
      vx: burst ? (Math.random() - 0.5) * 90 : -30 - Math.random() * 20,
      vy: burst ? -30 - Math.random() * 60 : (Math.random() - 0.5) * 20,
      g: 55, drag: 0.985,
      life: 1.1 + Math.random() * 0.7,
      color, type: 'feather',
      vr: (Math.random() - 0.5) * 6,
      flutter: 2 + Math.random() * 3,
    });
  }

  spark(x, y) {
    this.spawn({
      x, y,
      vx: (Math.random() - 0.5) * 160,
      vy: (Math.random() - 0.7) * 160,
      g: 200, life: 0.3 + Math.random() * 0.3,
      size: 1 + (Math.random() < 0.4 ? 1 : 0),
      color: Math.random() < 0.5 ? '#ffd040' : '#ff8030',
      type: 'dot',
    });
  }

  debris(x, y) {
    this.spawn({
      x, y,
      vx: (Math.random() - 0.5) * 130,
      vy: -40 - Math.random() * 90,
      g: 260, life: 0.5 + Math.random() * 0.5,
      size: 2, color: ['#b4bac6', '#16161e', '#c81e1e', '#5a6070'][(Math.random() * 4) | 0],
      type: 'dot',
    });
  }

  explosion(x, y) {
    for (let i = 0; i < 14; i++) this.spark(x, y);
    for (let i = 0; i < 12; i++) this.debris(x, y);
    for (let i = 0; i < 6; i++) {
      this.spawn({
        x, y,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.6) * 40,
        g: -12, drag: 0.96,
        life: 0.6 + Math.random() * 0.5,
        size: 3 + Math.random() * 3,
        color: ['#565c6c', '#3a3f4a', '#8a90a0'][(Math.random() * 3) | 0],
        type: 'smoke',
      });
    }
  }

  dust(x, y) {
    this.spawn({
      x, y,
      vx: -20 - Math.random() * 30,
      vy: -8 - Math.random() * 14,
      g: 30, drag: 0.96,
      life: 0.35 + Math.random() * 0.3,
      size: 1 + (Math.random() < 0.5 ? 1 : 0),
      color: '#cfc9b8', type: 'dot',
    });
  }

  splash(x, y) {
    this.spawn({
      x, y,
      vx: (Math.random() - 0.5) * 30,
      vy: -25 - Math.random() * 25,
      g: 220, life: 0.25,
      size: 1, color: '#9ab8d8', type: 'dot',
    });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.flutter) p.x += Math.sin(p.rot * 2) * p.flutter * dt * 8;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const a = Math.max(0, Math.min(1, p.life / (p.maxLife * 0.5)));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.type === 'feather') {
        ctx.save();
        ctx.translate(p.x | 0, p.y | 0);
        ctx.rotate(p.rot);
        ctx.fillRect(-2, -1, 4, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(1, -1, 1, 2);
        ctx.restore();
      } else if (p.type === 'smoke') {
        const s = p.size * (2 - a);
        ctx.globalAlpha = a * 0.5;
        ctx.fillRect((p.x - s / 2) | 0, (p.y - s / 2) | 0, s | 0, s | 0);
      } else {
        ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }
}
