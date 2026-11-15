// Small reusable 3D effects: text labels, expanding rings, shockwaves.
import * as THREE from 'three';

export function makeLabel(text, { color = '#ffffff', bg = 'rgba(14,11,34,0.82)', size = 1, border = '#5ff2ff' } = {}) {
  const cv = document.createElement('canvas'); const c = cv.getContext('2d');
  const font = '600 44px "JetBrains Mono", monospace'; c.font = font;
  const w = Math.ceil(c.measureText(text).width) + 44, hgt = 74;
  cv.width = w; cv.height = hgt; c.font = font;
  c.fillStyle = bg; roundRect(c, 2, 2, w - 4, hgt - 4, 18); c.fill();
  c.strokeStyle = border; c.lineWidth = 3; roundRect(c, 2, 2, w - 4, hgt - 4, 18); c.stroke();
  c.fillStyle = color; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText(text, w / 2, hgt / 2 + 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false }));
  spr.material.color.setScalar(0.72); // keep labels below the bloom threshold
  spr.scale.set((w / hgt) * 1.6 * size, 1.6 * size, 1); spr.renderOrder = 10;
  return spr;
}
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

// Expanding ground ring; registers itself with world.animated and removes itself when done.
export function ring(world, x, y, z, { color = '#5ff2ff', maxR = 12, life = 1.2, width = 0.5 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(1 - width / 2, 1, 48), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y + 0.3, z); world.scene.add(mesh);
  let t = 0;
  const obj = { update: (dt) => {
    t += dt; const k = t / life; mesh.scale.setScalar(0.5 + k * maxR); mat.opacity = Math.max(0, 1 - k);
    if (k >= 1) { world.scene.remove(mesh); mesh.geometry.dispose(); mat.dispose(); world.animated.splice(world.animated.indexOf(obj), 1); }
  } };
  world.animated.push(obj);
}
