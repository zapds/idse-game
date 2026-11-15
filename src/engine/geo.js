// Geography of Veyra: terrain height, landmarks, and the crystal-yield field.
// Pure functions (no three.js) so the stats labs can reuse the exact same world.
import { fbm, simplex2, smoothstep, lerp } from './noise.js';

export const WORLD = 640;          // world spans ±320
export const EDGE = 285;           // mountains start here

export const SITES = {
  base:     { x: 0,    z: 0,    r: 46, name: 'Halcyon Base' },
  domes:    { x: -62,  z: 34,   r: 26, name: 'Greenhouse Ring' },
  depot:    { x: 34,   z: -30,  r: 10, name: 'Survey Depot' },
  post:     { x: 168,  z: 18,   r: 16, name: 'Rift Listening Post' },
  basinGate:{ x: -40,  z: -118, r: 12, name: 'Basin Gate' },
  basin:    { x: -40,  z: -192, r: 62, name: 'Cryogeyser Basin' },
  outpost:  { x: -40,  z: -268, r: 14, name: "Okoro's Outpost" },
  council:  { x: 0,    z: 14,   r: 10, name: 'Council Hall' },
};

// Rift canyon centre line: x as a function of z
export const riftX = (z) => 205 + 14 * Math.sin(z / 55) + 6 * Math.sin(z / 23);

function flatten(h, x, z, site, target, inner, outer) {
  const d = Math.hypot(x - site.x, z - site.z);
  const t = smoothstep(inner, outer, d);
  return lerp(target, h, t);
}

export function heightAt(x, z) {
  // Rolling regolith + ridges
  let h = 7 * fbm(x / 95, z / 95, 4);
  const ridge = 1 - Math.abs(simplex2(x / 170 + 3.1, z / 170 - 1.7));
  h += 10 * ridge * ridge - 4;
  h += 1.2 * simplex2(x / 14, z / 14);

  // Flatten pads for structures
  h = flatten(h, x, z, SITES.base, 0, 44, 80);
  h = flatten(h, x, z, SITES.domes, 0.2, 24, 48);
  h = flatten(h, x, z, SITES.post, h * 0.3 + 2, 14, 30);
  h = flatten(h, x, z, SITES.basinGate, 1, 10, 26);
  h = flatten(h, x, z, SITES.outpost, 0.5, 14, 30);

  // Cryogeyser basin: a shallow flat bowl
  {
    const d = Math.hypot(x - SITES.basin.x, z - SITES.basin.z);
    const floor = -5 + 0.6 * simplex2(x / 9, z / 9);
    h = lerp(floor, h, smoothstep(SITES.basin.r - 8, SITES.basin.r + 18, d));
  }

  // The Rift: a deep canyon running north–south in the east
  {
    const dx = Math.abs(x - riftX(z));
    const w = 16 + 5 * simplex2(z / 40, 2.3);
    const depth = 34;
    const cut = 1 - smoothstep(w * 0.45, w, dx);
    h -= depth * cut;
    h += 3 * (1 - smoothstep(w, w + 14, dx)) * (1 - cut); // raised lip
  }

  // Mountain rim keeps the rover inside the map
  const r = Math.hypot(x, z);
  h += 70 * smoothstep(EDGE - 10, EDGE + 40, r) * (0.7 + 0.3 * fbm(x / 40, z / 40, 3));
  return h;
}

export function normalAt(x, z, e = 0.8) {
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  const nx = -hx, ny = 2 * e, nz = -hz;
  const l = Math.hypot(nx, ny, nz);
  return [nx / l, ny / l, nz / l];
}

// ---------- Crystal yield field (kg of crystal per m³ of regolith) ----------
// Right-skewed (log-normal-like) and depleted near the base: decades of mining.
export function rawYield(x, z) {
  const g = fbm(x / 85 + 11, z / 85 - 4, 4);
  const fine = simplex2(x / 13 + 5, z / 13 + 8);
  return Math.exp(3.0 + 1.75 * g + 0.42 * fine);
}
export function depletion(x, z) {
  const r = Math.hypot(x, z);
  return 1 - 0.78 * Math.exp(-(r * r) / (2 * 62 * 62));
}
export function yieldAt(x, z) { return rawYield(x, z) * depletion(x, z); }

export function insideMap(x, z) { return Math.hypot(x, z) < EDGE - 12; }
export function inRift(x, z) { return Math.abs(x - riftX(z)) < 20; }
export function inBasin(x, z) { return Math.hypot(x - SITES.basin.x, z - SITES.basin.z) < SITES.basin.r; }

// Survey strata (regions) used for stratified sampling
export const STRATA = [
  { id: 'core', name: 'Core Plains', color: '#ffb86b' },
  { id: 'north', name: 'Northern Steppe', color: '#7fe3ff' },
  { id: 'east', name: 'Eastern Badlands', color: '#c39bff' },
  { id: 'south', name: 'Southern Dunes', color: '#8affc1' },
];
export function stratumOf(x, z) {
  const r = Math.hypot(x, z);
  if (r < 105) return 0;
  const a = Math.atan2(z, x); // radians; z negative = north
  if (a < -Math.PI / 4 && a > (-3 * Math.PI) / 4) return 1;
  if (a >= -Math.PI / 4 && a < Math.PI / 4) return 2;
  if (a <= (-3 * Math.PI) / 4 || a >= (3 * Math.PI) / 4) return 1;
  return 3;
}
