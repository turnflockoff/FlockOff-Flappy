// Unified input: pointer (tap) + keyboard. Exposes edge-triggered queries
// consumed once per frame by the game state machine.

export class Input {
  constructor(canvas, view) {
    this.canvas = canvas;
    this.view = view; // { scale, offX, offY } updated by main on resize
    this.pointer = { x: -1, y: -1, down: false };
    this.tapped = false;      // pointer pressed this frame
    this.flapped = false;     // tap OR space/up this frame
    this.keys = new Set();
    this.pressedKeys = new Set(); // edge-triggered, cleared each frame

    this.onGesture = null;
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._point(e);
      this.pointer.down = true;
      this.tapped = true;
      this.flapped = true;
      if (this.onGesture) this.onGesture();
    });
    canvas.addEventListener('pointermove', (e) => this._point(e));
    window.addEventListener('pointerup', () => { this.pointer.down = false; });
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.pressedKeys.add(e.code);
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') this.flapped = true;
        if (this.onGesture) this.onGesture();
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.pointer.down = false; });

    // Gamepad: flap on face buttons / d-pad up; navigate menus with d-pad.
    this._padPrev = {};
    window.addEventListener('gamepadconnected', () => { this._hasPad = true; });
  }

  // Poll gamepad state once per frame, before the game reads inputs.
  pollGamepad() {
    if (!this._hasPad || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (!pad) continue;
      const b = (i) => pad.buttons[i] && pad.buttons[i].pressed;
      const ax = pad.axes[1] || 0;
      // A(0), B(1), X(2), Y(3), d-pad up(12)
      const flap = b(0) || b(1) || b(2) || b(3);
      const up = b(12) || ax < -0.5;
      const down = b(13) || ax > 0.5;
      const left = b(14);
      const right = b(15);
      const start = b(9);
      const edge = (name, val) => {
        const was = this._padPrev[name];
        this._padPrev[name] = val;
        return val && !was;
      };
      if (edge('flap', flap)) { this.flapped = true; if (this.onGesture) this.onGesture(); }
      if (edge('up', up)) this.pressedKeys.add('ArrowUp');
      if (edge('down', down)) this.pressedKeys.add('ArrowDown');
      if (edge('left', left)) this.pressedKeys.add('ArrowLeft');
      if (edge('right', right)) this.pressedKeys.add('ArrowRight');
      if (edge('confirm', flap)) this.pressedKeys.add('Enter');
      if (edge('start', start)) this.pressedKeys.add('Escape');
      break; // first connected pad only
    }
  }

  _point(e) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - r.left) / r.width) * this.canvas.width;
    this.pointer.y = ((e.clientY - r.top) / r.height) * this.canvas.height;
  }

  pressed(code) { return this.pressedKeys.has(code); }

  endFrame() {
    this.tapped = false;
    this.flapped = false;
    this.pressedKeys.clear();
  }
}
