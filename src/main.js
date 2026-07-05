import './style.css';
import { Input } from './core/input.js';
import { Game } from './game/game.js';
import { W, H } from './game/data.js';

const canvas = document.getElementById('game');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Integer-ish scaling to fill the window while keeping pixels crisp.
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const scale = Math.min(vw / W, vh / H);
  const snapped = scale >= 1 ? Math.max(1, Math.floor(scale * 2) / 2) : scale;
  canvas.style.width = `${W * snapped}px`;
  canvas.style.height = `${H * snapped}px`;
}
window.addEventListener('resize', resize);
resize();

const input = new Input(canvas, {});
const game = new Game(canvas, input);
// Unlock WebAudio inside a real user gesture (mobile autoplay policy).
input.onGesture = () => game.audio.unlock();

if (import.meta.env.DEV) window.__game = game;

// Fixed-timestep-ish loop targeting 60 FPS with a clamped delta so tab
// switches don't cause physics jumps.
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  // rAF's first timestamp can precede the performance.now() taken at module
  // load, and tab switches can produce huge gaps — clamp both ways.
  if (dt < 0) dt = 0;
  if (dt > 0.1) dt = 0.1;
  game.update(dt);
  game.draw();
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// PWA service worker (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
