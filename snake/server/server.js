'use strict';
// SNAKE! SNAKE! — authoritative multiplayer game server (by Turnflockoff.com)
// Holds the shared world, simulates at a fixed tick, and streams area-of-interest
// snapshots to each connected client over WebSocket. Also serves the client,
// a small REST API for the premium-skins shop, and verifies PayPal payments
// server-side before granting entitlements (stored in Supabase).

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

// ---------- Config (kept in sync with the client's look/feel) ----------
const PORT = process.env.PORT || 3000;
const WORLD_R = 3400;          // world is a circle of this radius (bigger arena)
const FOOD_COUNT = 2200;
const MIN_SNAKES = 22;         // players + bots kept at or above this
const MAX_BOTS = 22;
const TICK_HZ = 20;
const BASE_SPEED = 2.6;
const BOOST_SPEED = 5.0;
const TURN_RATE = 0.095;
const SEG_SPACING = 5;
const START_LEN = 10;
const BOOST_COST = 0.018;
const MIN_BOOST_LEN = 12;
const VIEW_R = 1500;           // how far around a player we send entities

const BOT_NAMES = ['Slitherin','NoodleKing','Wormzilla','SnekDaddy','Hissy Elliott','Danger Noodle','Sir Coilsalot','Boop Snoot','Mamba №5','Pretzel','Loopy','Kaa','Nagini','Solid Snek','Ekans','Wiggles','Spaghetti','Cobra Kai','Slinky','Twizzler'];
const FREE_SKIN_COUNT = 12;    // bots + free players pick from these
const CUSTOM_SKIN_INDEX = 16;  // free — any player can pick their own hue, no purchase needed

// ---------- Premium skins (paid, cool visual effects + a small balanced perk) ----------
// index >= FREE_SKIN_COUNT. Prices are USD. Perks are intentionally modest —
// no invincibility, no bigger hitbox advantage — just a flavor-appropriate edge.
// `effect` names a client-side render flourish (shimmer/aura/flame/scale/rainbow);
// it's purely cosmetic, computed client-side, and never affects gameplay.
const PREMIUM_SKINS = [
  { index: 12, id: 'golden',     name: 'Golden Cobra', price: 1.99, perk: 'startLen',   desc: '+10 starting length', effect: 'shimmer' },
  { index: 13, id: 'magnetite',  name: 'Magnetite',    price: 2.49, perk: 'suction',    desc: '+30% food pull radius', effect: 'aura' },
  { index: 14, id: 'speeddemon', name: 'Speed Demon',  price: 2.99, perk: 'boostSpeed', desc: '+8% boost speed', effect: 'flame' },
  { index: 15, id: 'ironscale',  name: 'Iron Scale',   price: 1.99, perk: 'boostEff',   desc: 'Boost burns 15% less length', effect: 'scale' },
  { index: 17, id: 'rainbow',    name: 'Rainbow Serpent', price: 1.49, perk: null,      desc: 'Cosmetic — continuously shifting rainbow scales', effect: 'rainbow' },
];
const PREMIUM_BY_INDEX = new Map(PREMIUM_SKINS.map(s => [s.index, s]));
const PREMIUM_BY_ID = new Map(PREMIUM_SKINS.map(s => [s.id, s]));
const TOTAL_SKINS = 18; // valid skin indices are 0..17 (0-11 free, 12-15 premium, 16 custom-free, 17 premium)

// ---------- Special Skills — active, purchasable abilities (not passive skin perks) ----------
// A player equips at most one owned ability before a match and triggers it live with a
// keypress/tap. Everything is server-authoritative: charges, cooldowns and effects all live
// here, never trusted from the client. Entitlements reuse the same Supabase tables as skins
// (snake_skin_orders / snake_entitlements) — the columns just hold an opaque item id, so an
// ability id like 'ghost' lives there exactly like a skin id like 'golden' does, no schema
// change needed. Single-player is a free trial for all of these (no server to fake-pay there).
const ABILITIES = [
  { id: 'ghost',  name: 'Ghost Mode',   price: 2.99, charges: 2, cooldown: 8,  durationTicks: 50,
    desc: '2.5s pass through other snakes’ bodies unharmed (head-on still lethal by size)' },
  { id: 'turbo',  name: 'Turbo Burst',  price: 1.99, charges: 3, cooldown: 6,  durationTicks: 20,
    desc: '1s of free speed — no length burned, unlike boost' },
  { id: 'magnet', name: 'Magnet Pulse', price: 2.49, charges: 2, cooldown: 10, durationTicks: 0,
    desc: 'Instantly pulls in all nearby food in one burst' },
  { id: 'jam',    name: 'Jam Signal',   price: 3.49, charges: 1, cooldown: 0,  durationTicks: 80,
    desc: '4s: nearby bots lose track of you and just wander' },
];
const ABILITY_BY_ID = new Map(ABILITIES.map(a => [a.id, a]));
const MAGNET_RADIUS = 260;
const JAM_RADIUS = 500;


// ---------- Payment / DB config (all optional — shop disables itself if unset) ----------
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_ENV = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
const PAYPAL_API = PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qvreiiraoovppuvhjubm.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SHOP_ENABLED = !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET && SUPABASE_SERVICE_ROLE_KEY);
if (!SHOP_ENABLED) {
  console.log('[shop] Disabled — set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and SUPABASE_SERVICE_ROLE_KEY to enable real purchases.');
}

const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + Math.max(-t, Math.min(t, d));
}
function randomWorldPoint(margin) {
  const r = Math.sqrt(Math.random()) * (WORLD_R - margin);
  const a = Math.random() * Math.PI * 2;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}
function sanitizeName(n) {
  return String(n == null ? '' : n).replace(/[ -<>]/g, '').trim().slice(0, 16) || 'Snake';
}

// ---------- Supabase REST helpers (service role — bypasses RLS, server only) ----------
async function supabaseFetch(pathAndQuery, opts) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + pathAndQuery, {
    ...opts,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      ...(opts && opts.headers),
    },
  });
  return res;
}
async function hasEntitlement(ownerId, skinId) {
  if (!SHOP_ENABLED) return false;
  try {
    const res = await supabaseFetch(
      `snake_entitlements?owner_id=eq.${encodeURIComponent(ownerId)}&skin_id=eq.${encodeURIComponent(skinId)}&select=owner_id`,
      { method: 'GET' }
    );
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) { console.error('[shop] entitlement check failed', e.message); return false; }
}
async function recordOrder(row) {
  try {
    await supabaseFetch('snake_skin_orders', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
  } catch (e) { console.error('[shop] recordOrder failed', e.message); }
}
async function grantEntitlement(ownerId, skinId) {
  try {
    await supabaseFetch('snake_entitlements', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ owner_id: ownerId, skin_id: skinId }),
    });
  } catch (e) { console.error('[shop] grantEntitlement failed', e.message); }
}

// ---------- PayPal REST helpers ----------
let paypalTokenCache = { token: null, exp: 0 };
async function paypalToken() {
  if (paypalTokenCache.token && Date.now() < paypalTokenCache.exp) return paypalTokenCache.token;
  const res = await fetch(PAYPAL_API + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error('paypal token request failed: ' + res.status);
  const data = await res.json();
  paypalTokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}
async function paypalCreateOrder(item) {
  const token = await paypalToken();
  const res = await fetch(PAYPAL_API + '/v2/checkout/orders', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        description: `SNAKE! SNAKE! — ${item.name}`,
        amount: { currency_code: 'USD', value: item.price.toFixed(2) },
      }],
    }),
  });
  if (!res.ok) throw new Error('paypal create order failed: ' + res.status + ' ' + await res.text());
  return res.json();
}
async function paypalCaptureOrder(orderId) {
  const token = await paypalToken();
  const res = await fetch(PAYPAL_API + `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error('paypal capture failed: ' + res.status + ' ' + JSON.stringify(data));
  return data;
}

// ---------- Food ----------
let foods = [];
const foodById = new Map();
let foodSeq = 1;
function addFood(x, y, val, hue) {
  const f = { id: foodSeq++, x, y, val, r: 3 + val * 1.6, hue: hue == null ? (Math.random() * 360) | 0 : hue };
  foods.push(f);
  foodById.set(f.id, f);
}
function removeFoodAt(i) {
  const f = foods[i];
  foodById.delete(f.id);
  foods[i] = foods[foods.length - 1]; foods.pop();
}
function spawnFoodField() {
  foods = []; foodById.clear();
  for (let i = 0; i < FOOD_COUNT; i++) {
    const p = randomWorldPoint(20);
    addFood(p.x, p.y, rand(0.6, 1.4));
  }
}

// ---------- Snake ----------
let idSeq = 1;
let namePool = [];
function nextBotName() {
  if (namePool.length === 0) namePool = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
  return namePool.pop();
}

class Snake {
  constructor(name, skin, isBot) {
    this.id = idSeq++;
    this.name = name;
    this.skin = skin;
    this.isBot = !!isBot;
    this.premium = PREMIUM_BY_INDEX.get(skin) || null;
    this.customHue = null; this.customHue2 = null;   // set by caller when skin === CUSTOM_SKIN_INDEX
    this.ability = null; this.abilityCharges = 0; this.abilityCooldownT = 0;
    this.ghostT = 0; this.turboT = 0; this.jamT = 0;
    this.reset();
  }
  equipAbility(id) {
    const a = ABILITY_BY_ID.get(id);
    this.ability = a ? a.id : null;
    this.abilityCharges = a ? a.charges : 0;
    this.abilityCooldownT = 0;
  }
  useAbility() {
    const a = ABILITY_BY_ID.get(this.ability);
    if (!a || this.dead || this.abilityCharges <= 0 || this.abilityCooldownT > 0) return false;
    this.abilityCharges--;
    this.abilityCooldownT = a.cooldown * TICK_HZ;
    if (a.id === 'ghost') this.ghostT = a.durationTicks;
    else if (a.id === 'turbo') this.turboT = a.durationTicks;
    else if (a.id === 'jam') this.jamT = a.durationTicks;
    else if (a.id === 'magnet') {
      const r2 = MAGNET_RADIUS * MAGNET_RADIUS;
      for (let i = foods.length - 1; i >= 0; i--) {
        const f = foods[i];
        if (dist2(this.x, this.y, f.x, f.y) <= r2) {
          this.len += f.val * 0.6;
          if (this.target === f) this.target = null;
          removeFoodAt(i);
        }
      }
    }
    return true;
  }
  reset() {
    const p = randomWorldPoint(400);
    this.angle = Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;
    this.len = START_LEN + (this.premium && this.premium.perk === 'startLen' ? 10 : 0);
    this.boost = false;
    this.dead = false;
    this.kills = 0;
    this.foodDropTick = 0;
    this.path = [];
    for (let i = 0; i < START_LEN * 2; i++) {
      this.path.push({ x: p.x - Math.cos(this.angle) * i * SEG_SPACING, y: p.y - Math.sin(this.angle) * i * SEG_SPACING });
    }
    this.x = p.x; this.y = p.y;
    this.target = null;      // locked food target (bots)
    this.retargetT = 0;
    this.wanderT = 0;
    this.boostT = 0;
    this.segs = [];
    if (this.ability) this.abilityCharges = (ABILITY_BY_ID.get(this.ability) || { charges: 0 }).charges;
    this.abilityCooldownT = 0;
    this.ghostT = 0; this.turboT = 0; this.jamT = 0;
  }
  get radius() { return 5 + Math.min(14, Math.sqrt(this.len) * 0.9); }
  get speed() {
    if (this.turboT > 0) return BOOST_SPEED * 1.3;
    if (!(this.boost && this.len > MIN_BOOST_LEN)) return BASE_SPEED;
    const mul = this.premium && this.premium.perk === 'boostSpeed' ? 1.08 : 1;
    return BOOST_SPEED * mul;
  }
  get segCount() { return Math.max(3, this.len | 0); }
  get score() { return Math.round(this.len); }

  computeSegs() {
    const out = [];
    const n = this.segCount;
    const step = 2;
    for (let i = 0; i < n; i++) out.push(this.path[Math.min(i * step, this.path.length - 1)]);
    this.segs = out;
    return out;
  }

  update() {
    if (this.dead) return;
    if (this.ghostT > 0) this.ghostT--;
    if (this.turboT > 0) this.turboT--;
    if (this.jamT > 0) this.jamT--;
    if (this.abilityCooldownT > 0) this.abilityCooldownT--;
    const agility = TURN_RATE * (this.boost ? 0.8 : 1) * Math.max(0.55, 1 - this.len / 900);
    this.angle = angleLerp(this.angle, this.targetAngle, agility);
    const sp = this.speed;
    this.x += Math.cos(this.angle) * sp;
    this.y += Math.sin(this.angle) * sp;

    const d = Math.hypot(this.x, this.y);
    if (d > WORLD_R) { this.die(); return; }

    const head = this.path[0];
    if (dist2(this.x, this.y, head.x, head.y) >= SEG_SPACING * SEG_SPACING) {
      this.path.unshift({ x: this.x, y: this.y });
      const maxPath = this.segCount * 2 + 6;
      if (this.path.length > maxPath) this.path.length = maxPath;
    }

    if (this.boost && this.len > MIN_BOOST_LEN) {
      const costMul = this.premium && this.premium.perk === 'boostEff' ? 0.85 : 1;
      this.len -= BOOST_COST * 10 * costMul;
      if (++this.foodDropTick % 9 === 0) {
        const tail = this.path[this.path.length - 1];
        addFood(tail.x + rand(-4, 4), tail.y + rand(-4, 4), 0.5);
      }
    } else if (this.boost) {
      this.boost = false;
    }

    // eat nearby food
    const suckMul = this.premium && this.premium.perk === 'suction' ? 1.3 : 1;
    const suck = (this.radius + 22) * suckMul;
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      const dd = dist2(this.x, this.y, f.x, f.y);
      if (dd < suck * suck) {
        if (dd < (this.radius + f.r + 4) ** 2) {
          this.len += f.val;
          if (this.target === f) this.target = null;
          removeFoodAt(i);
        } else {
          f.x += (this.x - f.x) * 0.35;
          f.y += (this.y - f.y) * 0.35;
        }
      }
    }
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    const segs = this.segs.length ? this.segs : this.computeSegs();
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (foods.length < FOOD_COUNT * 2.4) {
        addFood(s.x + rand(-9, 9), s.y + rand(-9, 9), 1.6, (this.skin * 30) % 360);
        if (i % 3 === 0) addFood(s.x + rand(-12, 12), s.y + rand(-12, 12), 1);
      }
    }
  }
}

// ---------- World ----------
const snakes = new Map();       // id -> Snake
const clients = new Map();      // Snake id -> ws   (human players only)

function botCount() { let n = 0; for (const s of snakes.values()) if (s.isBot) n++; return n; }
function humanCount() { let n = 0; for (const s of snakes.values()) if (!s.isBot) n++; return n; }

function addBot() {
  const s = new Snake(nextBotName(), (Math.random() * FREE_SKIN_COUNT) | 0, true);
  s.len = rand(START_LEN, 90);
  snakes.set(s.id, s);
  return s;
}

function topUpBots() {
  while (snakes.size < MIN_SNAKES && botCount() < MAX_BOTS) addBot();
}

// Smarter bot AI: locks onto one food target and steers toward it EVERY tick
// (continuous pursuit) instead of recomputing a fresh "nearest food" heading
// only every dozen ticks. The old approach produced stale straight-line runs
// punctuated by sharp corrections — which look exactly like a bot orbiting
// its target. Continuous pursuit converges straight to the food instead.
function botThink(s) {
  s.boostT--;

  const d = Math.hypot(s.x, s.y);
  if (d > WORLD_R - 280) {
    s.targetAngle = Math.atan2(-s.y, -s.x) + rand(-0.35, 0.35);
    s.boost = false;
    s.target = null;
    return;
  }

  // Jam Signal: a nearby jammer blinds this bot's threat/food awareness — it just wanders.
  for (const j of snakes.values()) {
    if (j.jamT > 0 && !j.dead && dist2(s.x, s.y, j.x, j.y) < JAM_RADIUS * JAM_RADIUS) {
      s.wanderT--;
      if (s.wanderT <= 0) { s.targetAngle = s.angle + rand(-0.5, 0.5); s.wanderT = 20 + rand(0, 20); }
      s.target = null;
      return;
    }
  }

  let threatAng = null, threatD2 = 170 * 170;
  for (const o of snakes.values()) {
    if (o === s || o.dead) continue;
    if (dist2(s.x, s.y, o.x, o.y) > 420 * 420) continue;
    const segs = o.segs;
    for (let i = 0; i < segs.length; i += 4) {
      const dd = dist2(s.x, s.y, segs[i].x, segs[i].y);
      if (dd < threatD2) { threatD2 = dd; threatAng = Math.atan2(segs[i].y - s.y, segs[i].x - s.x); }
    }
  }
  if (threatAng !== null) {
    s.targetAngle = threatAng + Math.PI + rand(-0.3, 0.3);
    s.boost = s.len > 40 && threatD2 < 100 * 100;
    s.target = null;
    return;
  }

  if (s.target && !foodById.has(s.target.id)) s.target = null;

  s.retargetT--;
  if (!s.target || s.retargetT <= 0) {
    const searchR2 = 420 * 420;
    let best = s.target, bestD = s.target ? dist2(s.x, s.y, s.target.x, s.target.y) : Infinity;
    for (const f of foods) {
      const dd = dist2(s.x, s.y, f.x, f.y);
      if (dd < searchR2 && dd < bestD * 0.7) { bestD = dd; best = f; }
    }
    s.target = best;
    s.retargetT = 15 + rand(0, 10);
  }

  if (s.target) {
    s.targetAngle = Math.atan2(s.target.y - s.y, s.target.x - s.x);
  } else {
    s.wanderT--;
    if (s.wanderT <= 0) {
      s.targetAngle = s.angle + rand(-0.7, 0.7);
      s.wanderT = 50 + rand(0, 40);
    }
  }

  if (s.boostT <= 0) {
    s.boost = s.len > 60 && Math.random() < 0.05;
    s.boostT = s.boost ? 40 : 30;
  }
}

function checkCollisions() {
  const list = [...snakes.values()];
  for (const s of list) {
    if (s.dead) continue;
    for (const o of list) {
      if (o === s || o.dead) continue;
      const rr = s.radius + o.radius;
      const headD2 = dist2(s.x, s.y, o.x, o.y);
      const reach = (o.segCount * SEG_SPACING * 2 + rr);
      if (headD2 > reach * reach) continue;
      const segs = o.segs;
      for (let i = 0; i < segs.length; i++) {
        const dd = dist2(s.x, s.y, segs[i].x, segs[i].y);
        if (dd < rr * rr * 0.72) {
          if (i === 0) {
            if (s.len <= o.len) { s.die(); o.kills++; }
            if (o.len <= s.len) { o.die(); s.kills++; }
          } else if (!s.ghostT) { s.die(); o.kills++; } // Ghost Mode: pass through others' bodies unharmed
          break;
        }
      }
      if (s.dead) break;
    }
  }
}

function netSegments(segs, cap) {
  const step = Math.max(1, Math.ceil(segs.length / cap));
  const pts = [];
  for (let i = 0; i < segs.length; i += step) pts.push(Math.round(segs[i].x), Math.round(segs[i].y));
  return pts;
}

function buildSnapshotFor(me) {
  const cx = me ? me.x : 0, cy = me ? me.y : 0;
  const vr2 = (VIEW_R + 200) ** 2;
  const outSnakes = [];
  for (const s of snakes.values()) {
    if (s.dead) continue;
    if (s !== me && dist2(cx, cy, s.x, s.y) > vr2 && dist2(cx, cy, s.segs.length ? s.segs[s.segs.length - 1].x : s.x, s.segs.length ? s.segs[s.segs.length - 1].y : s.y) > vr2) continue;
    outSnakes.push({
      i: s.id, n: s.name, c: s.skin, h: s.customHue, h2: s.customHue2,
      x: Math.round(s.x), y: Math.round(s.y),
      a: +s.angle.toFixed(3), r: +s.radius.toFixed(1),
      b: s.boost ? 1 : 0, p: netSegments(s.segs, 40),
      g: s.ghostT > 0 ? 1 : 0, tb: s.turboT > 0 ? 1 : 0, jm: s.jamT > 0 ? 1 : 0
    });
  }
  const outFood = [];
  const fr2 = (VIEW_R) ** 2;
  for (const f of foods) {
    if (dist2(cx, cy, f.x, f.y) > fr2) continue;
    outFood.push(f.id, Math.round(f.x), Math.round(f.y), +f.r.toFixed(1), f.hue);
  }
  let ms = 0, mk = 0, mr = 0, ab = null;
  if (me) {
    ms = me.score; mk = me.kills; mr = 1;
    for (const s of snakes.values()) if (!s.dead && s.score > me.score) mr++;
    if (me.ability) ab = { id: me.ability, charges: me.abilityCharges, cd: Math.ceil(me.abilityCooldownT / TICK_HZ) };
  }
  return { t: 's', me: me ? me.id : 0, ms, mk, mr, ab, sn: outSnakes, fd: outFood };
}

function leaderboard() {
  const all = [...snakes.values()].filter(s => !s.dead).sort((a, b) => b.score - a.score);
  const rows = all.slice(0, 8).map(s => ({ i: s.id, n: s.name, v: s.score }));
  return { all, rows };
}

let tick = 0;
function gameLoop() {
  tick++;
  for (const s of snakes.values()) { if (!s.dead && s.isBot) botThink(s); }
  for (const s of snakes.values()) { if (!s.dead) { s.update(); } }
  for (const s of snakes.values()) { if (!s.dead) s.computeSegs(); }
  checkCollisions();

  const { all, rows } = leaderboard();
  for (const [id, ws] of clients) {
    const s = snakes.get(id);
    if (s && s.dead && !s.notifiedDead) {
      s.notifiedDead = true;
      const rank = 1 + all.filter(x => x.score > s.score).length;
      send(ws, { t: 'dead', score: s.score, kills: s.kills, rank });
    }
  }
  for (const [id, s] of snakes) { if (s.dead && s.isBot) snakes.delete(id); }

  if (foods.length < FOOD_COUNT && tick % 2 === 0) {
    const p = randomWorldPoint(20); addFood(p.x, p.y, rand(0.6, 1.4));
  }
  topUpBots();

  for (const [id, ws] of clients) {
    if (ws.readyState !== ws.OPEN) continue;
    const me = snakes.get(id);
    if (me && me.dead) continue;
    send(ws, buildSnapshotFor(me));
  }

  if (tick % 5 === 0) {
    const msg = { t: 'lb', rows, players: humanCount(), total: snakes.size };
    for (const [id, ws] of clients) if (ws.readyState === ws.OPEN) send(ws, msg);
  }
}

function send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) {} }

// ---------- HTTP body helper ----------
function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let data = '', size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) { reject(new Error('body too large')); req.destroy(); return; }
      data += chunk;
    });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

// ---------- HTTP + static client + shop API ----------
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (url === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }

  // ---- Shop API ----
  if (url === '/api/config' && req.method === 'GET') {
    return sendJson(res, 200, { shopEnabled: SHOP_ENABLED, paypalClientId: SHOP_ENABLED ? PAYPAL_CLIENT_ID : null, worldRadius: WORLD_R, customSkinIndex: CUSTOM_SKIN_INDEX });
  }
  if (url === '/api/shop' && req.method === 'GET') {
    return sendJson(res, 200, { enabled: SHOP_ENABLED, skins: PREMIUM_SKINS.map(s => ({ id: s.id, index: s.index, name: s.name, price: s.price, desc: s.desc, effect: s.effect })) });
  }
  if (url === '/api/abilities' && req.method === 'GET') {
    return sendJson(res, 200, { enabled: SHOP_ENABLED, abilities: ABILITIES.map(a => ({ id: a.id, name: a.name, price: a.price, desc: a.desc, charges: a.charges, cooldown: a.cooldown })) });
  }
  if (url === '/api/shop/owned' && req.method === 'GET') {
    const ownerId = new URL(req.url, 'http://x').searchParams.get('ownerId') || '';
    if (!SHOP_ENABLED || !ownerId) return sendJson(res, 200, { owned: [] });
    try {
      const r = await supabaseFetch(`snake_entitlements?owner_id=eq.${encodeURIComponent(ownerId)}&select=skin_id`, { method: 'GET' });
      const rows = r.ok ? await r.json() : [];
      return sendJson(res, 200, { owned: rows.map(x => x.skin_id) });
    } catch (e) { return sendJson(res, 200, { owned: [] }); }
  }
  if (url === '/api/paypal/create-order' && req.method === 'POST') {
    if (!SHOP_ENABLED) return sendJson(res, 503, { error: 'shop not configured' });
    try {
      const body = await readJsonBody(req, 2048);
      const itemId = String(body.itemId || body.skinId || '');
      const item = PREMIUM_BY_ID.get(itemId) || ABILITY_BY_ID.get(itemId);
      if (!item) return sendJson(res, 400, { error: 'unknown item' });
      const order = await paypalCreateOrder(item);
      return sendJson(res, 200, { id: order.id });
    } catch (e) { console.error('[shop] create-order error', e.message); return sendJson(res, 500, { error: 'create-order failed' }); }
  }
  if (url === '/api/paypal/capture-order' && req.method === 'POST') {
    if (!SHOP_ENABLED) return sendJson(res, 503, { error: 'shop not configured' });
    try {
      const body = await readJsonBody(req, 2048);
      const { orderId, ownerId } = body;
      const itemId = String(body.itemId || body.skinId || '');
      const item = PREMIUM_BY_ID.get(itemId) || ABILITY_BY_ID.get(itemId);
      if (!orderId || !ownerId || !item) return sendJson(res, 400, { error: 'missing fields' });

      const capture = await paypalCaptureOrder(orderId);
      const status = capture.status;
      const pu = (capture.purchase_units || [])[0];
      const cap = pu && pu.payments && pu.payments.captures && pu.payments.captures[0];
      const paidAmount = cap ? parseFloat(cap.amount.value) : 0;
      const currency = cap ? cap.amount.currency_code : '';
      const payerEmail = capture.payer && capture.payer.email_address;

      const ok = status === 'COMPLETED' && currency === 'USD' && Math.abs(paidAmount - item.price) < 0.005;

      await recordOrder({
        owner_id: ownerId, paypal_order_id: orderId, skin_id: item.id,
        amount: paidAmount || item.price, currency: currency || 'USD',
        payer_email: payerEmail || null, status: ok ? 'completed' : 'failed',
      });

      if (!ok) return sendJson(res, 402, { error: 'payment not verified' });

      await grantEntitlement(ownerId, item.id);
      return sendJson(res, 200, { ok: true, itemId: item.id, skinIndex: item.index != null ? item.index : undefined });
    } catch (e) { console.error('[shop] capture-order error', e.message); return sendJson(res, 500, { error: 'capture failed' }); }
  }

  // ---- Static client ----
  let rel = url === '/' ? '/index.html' : url;
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  let snakeId = 0;
  ws.on('message', async (buf) => {
    let msg; try { msg = JSON.parse(buf); } catch (e) { return; }
    if (msg.t === 'join' || msg.t === 'respawn') {
      const ownerId = String(msg.ownerId || '').slice(0, 64);
      let skinIndex = ((msg.skin | 0) % TOTAL_SKINS + TOTAL_SKINS) % TOTAL_SKINS;
      let premiumDenied = false;
      let customHue = null, customHue2 = null;
      if (skinIndex === CUSTOM_SKIN_INDEX) {
        customHue = Math.max(0, Math.min(359, (msg.hue | 0) || 0));
        customHue2 = Math.max(0, Math.min(359, (msg.hue2 | 0) || 0));
      } else {
        const premium = PREMIUM_BY_INDEX.get(skinIndex);
        if (premium) {
          const entitled = ownerId && await hasEntitlement(ownerId, premium.id);
          if (!entitled) { skinIndex = 0; premiumDenied = true; }
        }
      }
      let abilityId = null, abilityDenied = false;
      const reqAbility = ABILITY_BY_ID.get(String(msg.ability || ''));
      if (reqAbility) {
        const entitled = ownerId && await hasEntitlement(ownerId, reqAbility.id);
        if (entitled) abilityId = reqAbility.id; else abilityDenied = true;
      }
      if (snakeId && snakes.has(snakeId)) snakes.delete(snakeId);
      const s = new Snake(sanitizeName(msg.name), skinIndex, false);
      if (customHue !== null) { s.customHue = customHue; s.customHue2 = customHue2; }
      if (abilityId) s.equipAbility(abilityId);
      snakeId = s.id;
      snakes.set(s.id, s);
      clients.set(s.id, ws);
      send(ws, { t: 'welcome', id: s.id, world: WORLD_R, skin: skinIndex, premiumDenied, abilityDenied });
    } else if (msg.t === 'in') {
      const s = snakes.get(snakeId);
      if (s && !s.dead) {
        if (typeof msg.a === 'number') s.targetAngle = msg.a;
        s.boost = !!msg.b;
      }
    } else if (msg.t === 'skill') {
      const s = snakes.get(snakeId);
      if (s && !s.dead) s.useAbility();
    }
  });
  ws.on('close', () => {
    if (snakeId) { snakes.delete(snakeId); clients.delete(snakeId); }
  });
  ws.on('error', () => {});
});

// ---------- Boot ----------
spawnFoodField();
topUpBots();
setInterval(gameLoop, 1000 / TICK_HZ);
server.listen(PORT, () => {
  console.log(`SNAKE! SNAKE! multiplayer server listening on :${PORT} (world radius ${WORLD_R}, shop ${SHOP_ENABLED ? 'ON' : 'OFF'})`);
});
