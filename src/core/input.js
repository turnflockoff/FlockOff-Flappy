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
