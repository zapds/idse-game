// Keyboard, mouse-drag camera orbit, and a simple touch joystick for tablets.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.touch = { x: 0, y: 0 };
    this.dragging = false; this.dragDX = 0; this.dragDY = 0;
    this.enabled = true;
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { this.dragging = true; this.lx = e.clientX; this.ly = e.clientY; } });
    window.addEventListener('pointermove', (e) => { if (!this.dragging) return; this.dragDX += e.clientX - this.lx; this.dragDY += e.clientY - this.ly; this.lx = e.clientX; this.ly = e.clientY; });
    window.addEventListener('pointerup', () => (this.dragging = false));
    this._touchStick();
  }
  down(code) { return this.enabled && this.keys.has(code); }
  // true once per physical key press
  hit(code) { if (!this.enabled) return false; const h = this.pressed.has(code); this.pressed.delete(code); return h; }
  endFrame() { this.pressed.clear(); }

  _touchStick() {
    if (!('ontouchstart' in window)) return;
    const pad = document.createElement('div'); pad.className = 'touch-stick'; pad.innerHTML = '<div class="nub"></div>';
    document.body.appendChild(pad);
    const nub = pad.firstChild; let id = null, cx = 0, cy = 0;
    pad.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; id = t.identifier; const r = pad.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; e.preventDefault(); }, { passive: false });
    pad.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === id) {
        let dx = (t.clientX - cx) / 50, dy = (t.clientY - cy) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        this.touch.x = -dx; this.touch.y = -dy; nub.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
      }
      e.preventDefault();
    }, { passive: false });
    const end = () => { id = null; this.touch.x = 0; this.touch.y = 0; nub.style.transform = ''; };
    pad.addEventListener('touchend', end); pad.addEventListener('touchcancel', end);
    const act = document.createElement('button'); act.className = 'touch-act'; act.textContent = 'E';
    act.addEventListener('touchstart', (e) => { this.pressed.add('KeyE'); e.preventDefault(); }, { passive: false });
    document.body.appendChild(act);
    const probe = document.createElement('button'); probe.className = 'touch-act touch-act2'; probe.textContent = 'F';
    probe.addEventListener('touchstart', (e) => { this.pressed.add('KeyF'); e.preventDefault(); }, { passive: false });
    document.body.appendChild(probe);
  }
}
