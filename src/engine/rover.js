// KESTREL-7 survey rover: procedural model, arcade driving on the heightfield, chase camera, dust.
import * as THREE from 'three';
import { heightAt, insideMap, EDGE } from './geo.js';
import { clamp } from './noise.js';

export class Rover {
  constructor(world, input) {
    this.world = world; this.input = input;
    this.pos = new THREE.Vector3(8, 0, -62);
    this.heading = 0.68; // radians, 0 = +z
    this.speed = 0;
    this.maxSpeed = 17; this.boostSpeed = 27;
    this.controlEnabled = true;
    this.damage = 0;
    this.odometer = 0;
    this.group = this._build();
    world.scene.add(this.group);
    this.camYaw = 0; this.camDist = 16; this.camPitch = 0.38;
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3();
    this.shake = 0;
    this._dust();
    this._initCam = false;
    window.addEventListener('wheel', (e) => { this.camDist = clamp(this.camDist + e.deltaY * 0.01, 8, 34); }, { passive: true });
  }

  _build() {
    const g = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: '#efe9f7', roughness: 0.45, metalness: 0.3, flatShading: true });
    const accent = new THREE.MeshStandardMaterial({ color: '#ff8a5c', roughness: 0.5, metalness: 0.2, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: '#262236', roughness: 0.8, flatShading: true });
    const glass = new THREE.MeshStandardMaterial({ color: '#1a2b4a', roughness: 0.1, metalness: 0.6, emissive: '#0a3a5a', emissiveIntensity: 0.6 });
    const lamp = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#bff6ff', emissiveIntensity: 3 });
    const body = new THREE.Group(); g.add(body); this.body = body;
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 4.4), dark); chassis.position.y = 1.0; body.add(chassis);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 3.2), hull); top.position.set(0, 1.75, -0.2); body.add(top);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1.2, 1.2, 4, 1), hull); nose.rotation.set(Math.PI / 2, Math.PI / 4, 0); nose.scale.set(1.4, 1, 0.55); nose.position.set(0, 1.55, 1.85); body.add(nose);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 1.3), glass); cab.position.set(0, 2.35, 0.5); body.add(cab);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.18, 3.25), accent); stripe.position.set(0, 1.45, -0.2); body.add(stripe);
    // sensor mast + dish
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5), dark); mast.position.set(-0.8, 2.9, -1.2); body.add(mast);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.5), hull); dish.material = hull.clone(); dish.material.side = THREE.DoubleSide;
    dish.position.set(-0.8, 3.7, -1.2); dish.rotation.x = -0.6; body.add(dish); this.dish = dish;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshStandardMaterial({ color: '#f55', emissive: '#ff3030', emissiveIntensity: 4 }));
    tip.position.set(0.8, 3.1, -1.6); body.add(tip); this.tip = tip;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4), dark); ant.position.set(0.8, 2.4, -1.6); body.add(ant);
    // probe rack (Chapter 1)
    for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 6), accent); p.position.set(-0.6 + i * 0.4, 2.45, -1.6); body.add(p); }
    // headlights
    for (const sx of [-0.8, 0.8]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.1), lamp); l.position.set(sx, 1.2, 2.22); body.add(l); }
    const head = new THREE.SpotLight('#dff8ff', 60, 60, 0.55, 0.6, 1.2);
    head.position.set(0, 1.6, 2.0); head.target.position.set(0, 0, 14); body.add(head, head.target);
    // wheels: 6 wheels on rocker arms
    this.wheels = [];
    const wgeo = new THREE.CylinderGeometry(0.62, 0.62, 0.5, 12); wgeo.rotateZ(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(0.3, 0.3, 0.52, 6); hub.rotateZ(Math.PI / 2);
    for (const sx of [-1.55, 1.55]) for (const sz of [-1.6, 0, 1.6]) {
      const w = new THREE.Group();
      const tyre = new THREE.Mesh(wgeo, dark); w.add(tyre);
      const h = new THREE.Mesh(hub, accent); w.add(h);
      w.position.set(sx, 0.62, sz); g.add(w); this.wheels.push(w);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    return g;
  }

  _dust() {
    const N = 400; this.dN = N; this.dI = 0;
    this.dPos = new Float32Array(N * 3); this.dVel = new Float32Array(N * 3); this.dLife = new Float32Array(N);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.dPos, 3));
    this.dAlpha = new Float32Array(N); geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.dAlpha, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: `attribute float aAlpha; varying float vA; void main(){ vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize = 220.0/-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; void main(){ float d=length(gl_PointCoord-0.5); gl_FragColor=vec4(0.75,0.62,0.85, smoothstep(0.5,0.0,d)*vA); }`,
    });
    this.dust = new THREE.Points(geo, mat); this.dust.frustumCulled = false; this.world.scene.add(this.dust);
  }

  teleport(x, z, heading = this.heading) {
    this.pos.set(x, heightAt(x, z), z); this.heading = heading; this.speed = 0; this._initCam = false;
  }

  collide(nx, nz) {
    for (const c of this.world.colliders) {
      const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz), min = c.r + 1.8;
      if (d < min && d > 0.0001) { nx = c.x + (dx / d) * min; nz = c.z + (dz / d) * min; this.speed *= 0.92; }
    }
    return [nx, nz];
  }

  update(dt) {
    const inp = this.input;
    let throttle = 0, steer = 0;
    if (this.controlEnabled) {
      throttle = (inp.down('KeyW') || inp.down('ArrowUp') ? 1 : 0) - (inp.down('KeyS') || inp.down('ArrowDown') ? 1 : 0);
      steer = (inp.down('KeyA') || inp.down('ArrowLeft') ? 1 : 0) - (inp.down('KeyD') || inp.down('ArrowRight') ? 1 : 0);
      throttle += inp.touch.y; steer += inp.touch.x;
      throttle = clamp(throttle, -1, 1); steer = clamp(steer, -1, 1);
    }
    const boosting = this.controlEnabled && inp.down('ShiftLeft') && throttle > 0;
    const vmax = (boosting ? this.boostSpeed : this.maxSpeed) * (1 - this.damage * 0.35);
    const target = throttle > 0 ? vmax * throttle : throttle < 0 ? -7 : 0;
    const accel = throttle !== 0 ? (Math.sign(target - this.speed) === Math.sign(this.speed) || this.speed === 0 ? 14 : 30) : 9;
    this.speed += clamp(target - this.speed, -accel * dt, accel * dt);
    const turnRate = 1.9 * clamp(Math.abs(this.speed) / 6, 0.25, 1) * (this.speed < 0 ? -1 : 1);
    this.heading += steer * turnRate * dt;

    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let nx = this.pos.x + fx * this.speed * dt, nz = this.pos.z + fz * this.speed * dt;
    // slope limiter: refuse to climb walls or drive off cliffs
    const h0 = heightAt(this.pos.x, this.pos.z), h1 = heightAt(nx, nz);
    const dist = Math.hypot(nx - this.pos.x, nz - this.pos.z) + 1e-6;
    const grade = (h1 - h0) / dist;
    if (Math.abs(grade) > 1.25 || !insideMap(nx, nz) && Math.hypot(nx, nz) > Math.hypot(this.pos.x, this.pos.z)) {
      nx = this.pos.x; nz = this.pos.z; this.speed *= -0.25; this.shake = Math.max(this.shake, 0.25);
    } else if (grade > 0.3) {
      this.speed *= 1 - clamp(grade - 0.3, 0, 1) * dt * 2.5; // uphill drag
    }
    [nx, nz] = this.collide(nx, nz);
    this.odometer += Math.hypot(nx - this.pos.x, nz - this.pos.z);
    this.pos.x = nx; this.pos.z = nz; this.pos.y = heightAt(nx, nz);

    // orient to terrain using four probe points
    const L = 1.6, W = 1.3;
    const hf = heightAt(nx + fx * L, nz + fz * L), hb = heightAt(nx - fx * L, nz - fz * L);
    const rx = Math.cos(this.heading), rz = -Math.sin(this.heading);
    const hr = heightAt(nx + rx * W, nz + rz * W), hl = heightAt(nx - rx * W, nz - rz * W);
    const pitch = Math.atan2(hb - hf, 2 * L), roll = Math.atan2(hr - hl, 2 * W);
    const g = this.group;
    g.position.set(nx, (hf + hb + hl + hr) / 4, nz);
    const tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, this.heading, roll, 'YXZ'));
    g.quaternion.slerp(tq, 1 - Math.exp(-dt * 10));
    // suspension bob + wheel spin
    this.body.position.y = Math.sin(performance.now() * 0.02) * 0.02 * Math.min(1, Math.abs(this.speed) / 5);
    for (const w of this.wheels) w.children[0].rotation.x += (this.speed * dt) / 0.62, w.children[1].rotation.x = w.children[0].rotation.x;
    this.dish.rotation.z += dt * 0.8;
    this.tip.visible = Math.sin(performance.now() * 0.006) > 0;

    // dust
    if (Math.abs(this.speed) > 3) {
      for (let k = 0; k < (boosting ? 3 : 1); k++) {
        const i = this.dI; this.dI = (this.dI + 1) % this.dN;
        const side = Math.random() > 0.5 ? 1.5 : -1.5;
        this.dPos[i * 3] = nx - fx * 2 + rx * side; this.dPos[i * 3 + 1] = this.pos.y + 0.3; this.dPos[i * 3 + 2] = nz - fz * 2 + rz * side;
        this.dVel[i * 3] = (Math.random() - 0.5) * 2 - fx * 2; this.dVel[i * 3 + 1] = 1 + Math.random() * 1.5; this.dVel[i * 3 + 2] = (Math.random() - 0.5) * 2 - fz * 2;
        this.dLife[i] = 1.4;
      }
    }
    for (let i = 0; i < this.dN; i++) {
      if (this.dLife[i] <= 0) { this.dAlpha[i] = 0; continue; }
      this.dLife[i] -= dt;
      this.dPos[i * 3] += this.dVel[i * 3] * dt; this.dPos[i * 3 + 1] += this.dVel[i * 3 + 1] * dt; this.dPos[i * 3 + 2] += this.dVel[i * 3 + 2] * dt;
      this.dVel[i * 3 + 1] -= dt * 0.8;
      this.dAlpha[i] = (this.dLife[i] / 1.4) * 0.35;
    }
    this.dust.geometry.attributes.position.needsUpdate = true; this.dust.geometry.attributes.aAlpha.needsUpdate = true;
  }

  updateCamera(dt, camera) {
    // orbit with mouse drag (input.drag), otherwise ease back behind the rover
    const inp = this.input;
    if (inp.dragging) { this.camYaw -= inp.dragDX * 0.006; this.camPitch = clamp(this.camPitch + inp.dragDY * 0.004, 0.08, 1.2); }
    else this.camYaw *= Math.exp(-dt * (Math.abs(this.speed) > 2 ? 1.6 : 0.3));
    inp.dragDX = 0; inp.dragDY = 0;
    const yaw = this.heading + Math.PI + this.camYaw;
    const d = this.camDist;
    const want = new THREE.Vector3(
      this.pos.x + Math.sin(yaw) * Math.cos(this.camPitch) * d,
      this.pos.y + 2 + Math.sin(this.camPitch) * d,
      this.pos.z + Math.cos(yaw) * Math.cos(this.camPitch) * d,
    );
    const ground = heightAt(want.x, want.z) + 1.5;
    if (want.y < ground) want.y = ground;
    // don't let the camera sit inside a building: lift it over the roof instead
    for (const c of this.world.colliders) {
      if (c.r < 3) continue;
      const dd = Math.hypot(want.x - c.x, want.z - c.z);
      if (dd < c.r + 2) want.y = Math.max(want.y, heightAt(c.x, c.z) + c.r * 1.05 + 3);
    }
    const look = new THREE.Vector3(this.pos.x, this.pos.y + 2.2, this.pos.z);
    if (!this._initCam) { this.camPos.copy(want); this.camLook.copy(look); this._initCam = true; }
    this.camPos.lerp(want, 1 - Math.exp(-dt * 5));
    this.camLook.lerp(look, 1 - Math.exp(-dt * 10));
    camera.position.copy(this.camPos);
    if (this.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * this.shake; camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.5);
    }
    camera.lookAt(this.camLook);
  }
}
