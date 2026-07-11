// All game art is generated at boot: authored procedural pixel art baked
// to offscreen canvases. 16-bit palette, black outlines, no external assets.

import { Pix } from './pix.js';
import { drawMicro } from '../core/font.js';
import { drawText } from '../core/font.js';

const OUT = '#141420';
const WHITE = '#f8f8f8';
const SHADE = '#c9cede';
const SHADE2 = '#a7adc4';
const BEAK = '#f5921e';
const BEAK_D = '#c46a10';
const EYE_W = '#ffffff';

function doveBase(wing) {
  const p = new Pix(26, 17);
  // tail feathers
  p.tri(0, 6, 6, 9, 1, 13, WHITE);
  p.line(1, 8, 5, 9, SHADE, 1);
  p.line(1, 11, 5, 10, SHADE, 1);
  // body
  p.ellipse(10, 10, 7, 4.5, WHITE);
  p.ellipse(9, 12, 5, 2.2, SHADE); // belly shading
  // neck + head
  p.ellipse(13.5, 8, 4.5, 3.5, WHITE);
  p.ellipse(17, 6, 5, 5, WHITE);
  // beak
  p.tri(21, 4, 21, 8, 25, 6, BEAK);
  p.line(21, 7, 23, 7, BEAK_D, 1);
  // wing (three animation poses)
  if (wing === 0) { // up
    p.tri(4, 1, 12, 8, 4, 9, SHADE);
    p.ellipse(7, 5, 3, 3, SHADE);
    p.line(5, 3, 9, 7, SHADE2, 1);
  } else if (wing === 1) { // mid
    p.ellipse(8, 9.5, 4.5, 2.5, SHADE);
    p.line(4, 9, 7, 9, SHADE2, 1);
    p.line(4, 11, 7, 11, SHADE2, 1);
  } else { // down
    p.tri(4, 16, 12, 9, 4, 9, SHADE);
    p.ellipse(7, 12, 3, 2.8, SHADE);
    p.line(5, 14, 9, 10, SHADE2, 1);
  }
  p.outline(OUT);
  // big bulging paranoid eye (ring + white; pupil is drawn at runtime)
  p.ellipse(19, 5, 3.4, 3.6, OUT);
  p.ellipse(19, 5, 2.6, 2.8, EYE_W);
  return p.toCanvas();
}

// Disguise overlays share the dove's 26x17 coordinate space (eye at 19,5).
function disguiseGroucho() {
  const p = new Pix(26, 17);
  p.ellipse(19, 5, 3.8, 4, '#1c1c28');       // round lens frame
  p.ellipse(19, 5, 2.7, 2.9, null);          // punch out the glass
  p.line(13, 4, 15, 4, '#1c1c28', 1);        // arm over the head
  p.ellipse(20, 9.5, 2, 1.9, '#d9a066');     // fake nose
  p.ellipse(20, 12, 3.4, 1.4, '#5a3a22');    // fake mustache
  p.outline(OUT, ['#1c1c28']);
  return p.toCanvas();
}

function disguiseShades() {
  const p = new Pix(26, 17);
  p.rect(15, 3, 9, 5, '#101018');
  p.set(21, 4, '#4a6a9a');
  p.set(22, 4, '#4a6a9a');
  p.line(13, 4, 14, 4, '#101018', 1);
  return p.toCanvas();
}

function disguiseDetective() {
  const p = new Pix(26, 17);
  p.rect(13, 0, 9, 2, '#6a4a2a');            // hat crown
  p.rect(11, 2, 13, 2, '#6a4a2a');           // brim
  p.rect(13, 1, 9, 1, '#3a2a1a');            // band
  p.ellipse(19, 5, 3.4, 3.6, '#c8a030');     // monocle ring
  p.ellipse(19, 5, 2.4, 2.6, null);
  p.line(17, 9, 16, 12, '#c8a030', 1);       // chain
  p.outline(OUT, []);
  return p.toCanvas();
}

function disguiseLuchador() {
  const p = new Pix(26, 17);
  p.ellipse(17, 6, 5.4, 5.4, '#c03030');
  // clear beak zone and eye hole
  for (let y = 0; y < 17; y++) for (let x = 21; x < 26; x++) if (y > 2 && y < 9) p.set(x, y, null);
  p.ellipse(19, 5, 2.9, 3.1, null);
  p.line(14, 2, 16, 8, '#e8b830', 1);        // gold accent
  p.outline(OUT);
  return p.toCanvas();
}

// FLOUK roadside ALPR camera head assembly (faces left, toward the player).
function floukHead() {
  const p = new Pix(32, 27);
  // solar panel
  p.rect(7, 0, 20, 4, '#2a3a5a');
  for (let x = 9; x < 26; x += 3) p.line(x, 0, x, 3, '#4a6a9a', 1);
  p.rect(15, 4, 3, 2, '#8a8fa0');            // mount post
  // housing
  p.rect(4, 6, 25, 15, '#b4bac6');
  p.rect(4, 6, 25, 1, '#d2d6e0');            // top highlight
  p.rect(26, 9, 2, 9, '#9aa0b0');            // side vents zone
  for (let y = 10; y < 17; y += 2) p.line(26, y, 27, y, '#6a7080', 1);
  // black faceplate
  p.rect(4, 7, 12, 13, '#16161e');
  // huge terminator eye (glow pulses at runtime)
  p.ellipse(10, 13, 4.2, 4.2, '#5a0a0a');
  p.ellipse(10, 13, 2.8, 2.8, '#c81e1e');
  p.ellipse(9, 12, 1, 1, '#ff5050');
  // tiny status LED (blinks at runtime at 25,8)
  p.set(25, 8, '#202028');
  // mounting bracket to pole
  p.rect(13, 21, 7, 3, '#7a8090');
  p.rect(11, 24, 11, 2, '#5a6070');
  p.outline(OUT);
  return { canvas: p.toCanvas(), led: { x: 25, y: 8 }, eye: { x: 10, y: 13 } };
}

function batteryBox() {
  const p = new Pix(14, 12);
  p.rect(1, 1, 12, 10, '#8a8fa0');
  p.rect(2, 3, 8, 6, '#6a7080');             // door
  p.set(8, 6, '#d2d6e0');                    // latch
  p.line(12, 4, 13, 2, '#2a2e38', 1);        // cable
  p.outline(OUT);
  return p.toCanvas();
}

function floukPlacard() {
  const p = new Pix(24, 10);
  p.rect(1, 1, 22, 8, '#e8e4d8');
  p.outline('#3a3e4a');
  const c = p.toCanvas();
  const ctx = c.getContext('2d');
  drawMicro(ctx, 'FLOUK', 12, 3, '#20242c', 1, 'center');
  return c;
}

// FLOUK Hunter Drone: industrial quadcopter, glowing eye, belly scanner.
function drone(frame) {
  const p = new Pix(22, 15);
  // rotor masts
  p.rect(4, 3, 2, 3, '#2a2e38');
  p.rect(16, 3, 2, 3, '#2a2e38');
  // rotors (two blur states)
  if (frame === 0) {
    p.rect(0, 2, 10, 1, '#565c6c');
    p.rect(12, 2, 10, 1, '#565c6c');
  } else {
    p.rect(2, 2, 6, 1, '#8a90a0');
    p.rect(14, 2, 6, 1, '#8a90a0');
  }
  // arms
  p.line(6, 6, 9, 8, '#3a3f4a', 1);
  p.line(15, 6, 12, 8, '#3a3f4a', 1);
  // body
  p.rect(7, 6, 8, 6, '#3a3f4a');
  p.rect(7, 10, 8, 2, '#2a2e38');
  p.rect(8, 7, 6, 1, '#565c6c');
  // glowing red eye (front, faces left)
  p.rect(6, 8, 2, 2, '#c81e1e');
  p.set(6, 8, '#ff5050');
  // belly scanner emitter
  p.rect(10, 12, 3, 1, '#801828');
  // landing skids
  p.line(7, 13, 9, 13, '#2a2e38', 1);
  p.line(13, 13, 15, 13, '#2a2e38', 1);
  p.outline(OUT);
  return p.toCanvas();
}

function coin(frame) {
  const rx = [3.5, 2.2, 0.9, 2.2][frame];
  const p = new Pix(8, 8);
  p.ellipse(4, 4, rx, 3.5, '#f0c030');
  if (frame === 0) {
    p.ellipse(4, 4, 2.2, 2.4, '#b08010');
    p.ellipse(4, 4, 1.2, 1.4, '#f0c030');
    p.set(2, 2, '#fff0a0');
  } else if (frame !== 2) {
    p.set(4, 2, '#fff0a0');
  }
  p.outline('#7a5808');
  return p.toCanvas();
}

// ---- Background surveillance decorations (smaller, darker, blurred) ----
const D1 = '#232733';
const D2 = '#31364a';
const DLENS = '#6a2030';

function blurred(c) {
  const o = document.createElement('canvas');
  o.width = c.width + 2;
  o.height = c.height + 2;
  const ctx = o.getContext('2d');
  ctx.filter = 'blur(0.5px)';
  ctx.drawImage(c, 1, 1);
  return o;
}

function bgTrafficCam() {
  const p = new Pix(14, 16);
  p.rect(1, 0, 2, 16, D1);                   // pole
  p.line(3, 1, 11, 1, D1, 1);                // arm
  p.rect(9, 2, 4, 3, D2);                    // hanging cam
  p.set(9, 3, DLENS);
  return p.toCanvas();
}

function bgPTZ() {
  const p = new Pix(8, 8);
  p.rect(3, 0, 2, 2, D1);
  p.ellipse(4, 4, 3, 3, D2);                 // dome
  p.ellipse(4, 5, 1.4, 1.4, DLENS);
  return p.toCanvas();
}

function bgGarageCam() {
  const p = new Pix(9, 7);
  p.rect(4, 0, 1, 2, D1);
  p.rect(1, 2, 7, 4, D2);
  p.rect(1, 3, 2, 2, DLENS);
  return p.toCanvas();
}

function bgBuildingCam() {
  const p = new Pix(7, 6);
  p.rect(3, 0, 2, 2, D1);
  p.tri(0, 2, 6, 2, 6, 5, D2);
  p.set(1, 3, DLENS);
  return p.toCanvas();
}

function bgHighwayCam() {
  const p = new Pix(26, 13);
  p.rect(0, 0, 2, 13, D1);
  p.rect(24, 0, 2, 13, D1);
  p.rect(0, 0, 26, 2, D1);                   // gantry beam
  p.rect(5, 2, 4, 3, D2);
  p.rect(17, 2, 4, 3, D2);
  p.set(5, 3, DLENS);
  p.set(17, 3, DLENS);
  return p.toCanvas();
}

function bgDroneDock() {
  const p = new Pix(16, 12);
  p.rect(6, 4, 2, 8, D1);                    // pole
  p.rect(1, 2, 14, 2, D2);                   // pad
  p.rect(4, 0, 8, 2, D1);                    // parked drone silhouette
  p.set(5, 1, DLENS);
  return p.toCanvas();
}

function bgStreetCam() {
  const p = new Pix(10, 18);
  p.rect(4, 2, 2, 16, D1);
  p.rect(0, 0, 4, 3, D2);
  p.rect(6, 0, 4, 3, D2);
  p.set(1, 1, DLENS);
  p.set(8, 1, DLENS);
  return p.toCanvas();
}

function cloud(w, h) {
  const p = new Pix(w, h);
  const n = Math.max(3, (w / 8) | 0);
  for (let i = 0; i < n; i++) {
    const cx = 4 + (i * (w - 8)) / (n - 1);
    const r = h / 2 - 1 + (i % 2);
    p.ellipse(cx, h - r - 1, r + 2, r, '#ffffff');
  }
  p.rect(2, h - 3, w - 4, 2, '#dfe6f2');
  return p.toCanvas();
}

function billboard() {
  const p = new Pix(78, 32);
  p.rect(6, 24, 3, 8, '#4a3a28');
  p.rect(69, 24, 3, 8, '#4a3a28');
  p.rect(0, 0, 78, 24, '#2a2620');
  p.rect(2, 2, 74, 20, '#e8e4d8');
  const c = p.toCanvas();
  const ctx = c.getContext('2d');
  drawMicro(ctx, 'TURNFLOCKOFF.COM', 39, 7, '#c02830', 1, 'center');
  drawMicro(ctx, 'FLY FREE', 39, 15, '#20242c', 1, 'center');
  return c;
}

function rooftopSign() {
  const p = new Pix(70, 12);
  p.rect(0, 0, 70, 10, '#16161e');
  p.rect(6, 10, 2, 2, '#565c6c');
  p.rect(62, 10, 2, 2, '#565c6c');
  const c = p.toCanvas();
  drawMicro(c.getContext('2d'), 'TURNFLOCKOFF.COM', 35, 3, '#ff5060', 1, 'center');
  return c;
}

function graffiti(text, color) {
  const cw = text.length * 4 + 4;
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = 9;
  const ctx = c.getContext('2d');
  ctx.globalAlpha = 0.85;
  drawMicro(ctx, text, 2, 3, color, 1);
  ctx.globalAlpha = 0.4;
  drawMicro(ctx, text, 3, 2, '#ffffff', 1);
  return c;
}

function welcomeSign() {
  const c = document.createElement('canvas');
  c.width = 150;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a8fa0';
  ctx.fillRect(12, 44, 4, 20);
  ctx.fillRect(134, 44, 4, 20);
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(0, 0, 150, 46);
  ctx.fillStyle = '#1e7a3c';
  ctx.fillRect(2, 2, 146, 42);
  drawText(ctx, 'WELCOME TO', 75, 8, '#f4f4f4', 2, 'center');
  drawText(ctx, 'CALIFORNIA', 75, 24, '#f4f4f4', 2, 'center');
  drawMicro(ctx, 'POPULATION: WATCHED', 75, 38, '#c9e4c9', 1, 'center');
  return c;
}

export function makeSprites() {
  const doveFrames = [doveBase(0), doveBase(1), doveBase(2)];
  return {
    dove: doveFrames,
    doveEye: { x: 19, y: 5, r: 1.4 },
    disguises: {
      groucho: disguiseGroucho(),
      shades: disguiseShades(),
      detective: disguiseDetective(),
      luchador: disguiseLuchador(),
    },
    flouk: floukHead(),
    battery: batteryBox(),
    placard: floukPlacard(),
    drone: [drone(0), drone(1)],
    coin: [coin(0), coin(1), coin(2), coin(3)],
    bgCams: [
      bgTrafficCam(), bgPTZ(), bgGarageCam(), bgBuildingCam(),
      bgHighwayCam(), bgDroneDock(), bgStreetCam(),
    ].map(blurred),
    clouds: [cloud(22, 8), cloud(32, 11), cloud(44, 14)],
    billboard: billboard(),
    rooftopSign: rooftopSign(),
    graffiti: [
      graffiti('FLOCKOFF!', '#ff40a0'),
      graffiti('TURNFLOCKOFF.COM', '#40e080'),
      graffiti('FLOCKOFF!', '#40c8ff'),
    ],
    welcomeSign: welcomeSign(),
  };
}
