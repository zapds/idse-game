// The 3D world of Veyra: sky, gas giant, terrain, crystals, base, landmarks, post-processing.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { heightAt, yieldAt, SITES, riftX, inRift, inBasin, insideMap, EDGE } from './geo.js';
import { fbm, simplex2, smoothstep, clamp } from './noise.js';
import { mulberry32 } from '../stats/rng.js';

export const PALETTE = {
  horizon: new THREE.Color('#ff9a7a'),
  dusk: new THREE.Color('#6a3f8f'),
  zenith: new THREE.Color('#090a22'),
  fog: new THREE.Color('#4a3170'),
  sun: new THREE.Color('#ffb48a'),
  crystal: new THREE.Color('#5ff2ff'),
  crystal2: new THREE.Color('#d77bff'),
  ice: new THREE.Color('#bfe9ff'),
  amber: new THREE.Color('#ffc46b'),
};

const SUN_DIR = new THREE.Vector3(-0.62, 0.16, 0.77).normalize();

export class World {
  constructor(canvas, { quality = 'high' } = {}) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : 1.25));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0042);
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.3, 9000);
    this.camera.position.set(0, 30, 60);

    this.animated = []; // objects with update(dt, t)
    this._buildLights();
    this._buildSky();
    this._buildTerrain();
    this._buildCrystals();
    this._buildBase();
    this._buildGreenhouses();
    this._buildListeningPost();
    this._buildBasin();
    this._buildOutpost();
    this._buildRocks();
    this._buildComposer();

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.bloom?.resolution.set(w, h);
  }

  // ---------------------------------------------------------------- lights
  _buildLights() {
    this.hemi = new THREE.HemisphereLight('#9d8cff', '#2a1530', 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun, this.sun.target);
    // cool rim light from the gas giant
    this.planetLight = new THREE.DirectionalLight('#6fd8ff', 0.55);
    this.planetLight.position.set(0.5, 0.6, -0.7).multiplyScalar(100);
    this.scene.add(this.planetLight);
  }

  followShadow(target) {
    this.sun.position.copy(target).addScaledVector(SUN_DIR, 200);
    this.sun.target.position.copy(target);
  }

  // ---------------------------------------------------------------- sky
  _buildSky() {
    const skyGeo = new THREE.SphereGeometry(6000, 48, 24);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uHorizon: { value: PALETTE.horizon }, uDusk: { value: PALETTE.dusk }, uZenith: { value: PALETTE.zenith },
        uSun: { value: SUN_DIR }, uTime: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z = gl_Position.w; }`,
      fragmentShader: `
        varying vec3 vDir; uniform vec3 uHorizon,uDusk,uZenith,uSun; uniform float uTime;
        float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        void main(){
          float h = vDir.y;
          float sunAmt = max(dot(normalize(vDir), normalize(uSun)), 0.0);
          vec3 col = mix(uDusk, uZenith, smoothstep(0.02, 0.55, h));
          col = mix(uHorizon, col, smoothstep(-0.08, 0.22 + 0.25*pow(sunAmt,4.0), h));
          col += vec3(1.0,0.55,0.35) * pow(sunAmt, 24.0) * 1.4;   // sun glow
          col += vec3(1.0,0.7,0.5) * pow(sunAmt, 900.0) * 6.0;    // sun disc
          // stars
          vec3 d = normalize(vDir) * 380.0;
          vec3 cell = floor(d);
          float s = hash(cell);
          float star = step(0.9975, s) * smoothstep(0.08, 0.6, h);
          float tw = 0.6 + 0.4*sin(uTime*2.0 + s*90.0);
          col += vec3(0.85,0.9,1.0) * star * tw * (1.0 - length(fract(d)-0.5)*1.6);
          // faint nebula band
          float band = exp(-pow((vDir.x*0.6 + vDir.z*0.8 - vDir.y*0.3), 2.0)*14.0) * smoothstep(0.1,0.7,h);
          col += vec3(0.35,0.15,0.55) * band * 0.25;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    this.animated.push({ update: (dt, t) => { skyMat.uniforms.uTime.value = t; } });

    // Thessaly — the gas giant Veyra orbits
    const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 512;
    const g = pc.getContext('2d');
    const bands = ['#1f5f6e', '#3a8f96', '#a9d8cf', '#e7e2c4', '#6fb7b3', '#2e6f7d', '#d9c99e', '#8ccfc6', '#174b5a', '#5ea9a8'];
    for (let y = 0; y < 512; y++) {
      const v = y / 512;
      const w = Math.sin(v * 40) * 0.5 + Math.sin(v * 113) * 0.25;
      const idx = Math.floor((v * 9 + w * 0.6 + 10) % bands.length);
      g.fillStyle = bands[idx]; g.fillRect(0, y, 1024, 1);
    }
    // turbulence streaks
    const rr = mulberry32(7);
    for (let i = 0; i < 2600; i++) {
      const y = rr() * 512, x = rr() * 1024, len = 20 + rr() * 140;
      g.globalAlpha = 0.06 + rr() * 0.08;
      g.fillStyle = rr() > 0.5 ? '#ffffff' : '#0e3440';
      g.fillRect(x, y, len, 1 + rr() * 2);
    }
    // great storm
    g.globalAlpha = 0.85; const grd = g.createRadialGradient(640, 300, 4, 640, 300, 46);
    grd.addColorStop(0, '#ffe8c2'); grd.addColorStop(0.5, '#e09a6a'); grd.addColorStop(1, 'rgba(224,154,106,0)');
    g.fillStyle = grd; g.beginPath(); g.ellipse(640, 300, 70, 30, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace; ptex.anisotropy = 4;
    const planetMat = new THREE.ShaderMaterial({
      fog: false,
      uniforms: { map: { value: ptex }, uSun: { value: SUN_DIR } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vN = normalize(mat3(modelMatrix)*normal); vec4 wp = modelMatrix*vec4(position,1.); vV = normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 uSun; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ vec3 c = texture2D(map, vUv).rgb; float l = clamp(dot(vN, normalize(uSun))*1.1+0.12, 0.0, 1.0);
        float rim = pow(1.0-max(dot(vN,vV),0.0), 3.0);
        vec3 col = c*l + vec3(0.35,0.8,0.9)*rim*0.7 + c*0.06;
        gl_FragColor = vec4(col,1.0);
        #include <colorspace_fragment>
        }`,
    });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 48), planetMat);
    planet.position.set(1500, 1100, -3300);
    planet.rotation.z = 0.32; planet.rotation.x = 0.2;
    this.scene.add(planet);
    // rings
    const rc = document.createElement('canvas'); rc.width = 512; rc.height = 8;
    const rg = rc.getContext('2d');
    for (let x = 0; x < 512; x++) {
      const v = x / 512;
      const a = (0.25 + 0.55 * Math.abs(Math.sin(v * 37) * Math.sin(v * 11))) * smoothstep(0, 0.08, v) * (1 - smoothstep(0.9, 1, v)) * (v > 0.55 && v < 0.6 ? 0.1 : 1);
      rg.fillStyle = `rgba(${200 + 40 * Math.sin(v * 20)},${210},${200},${a})`; rg.fillRect(x, 0, 1, 8);
    }
    const rtex = new THREE.CanvasTexture(rc); rtex.colorSpace = THREE.SRGBColorSpace;
    const ringGeo = new THREE.RingGeometry(1150, 1900, 128, 1);
    const pos = ringGeo.attributes.position, uv = ringGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (r - 1150) / 750, 0.5); }
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: rtex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false, opacity: 0.85 }));
    ring.position.copy(planet.position); ring.rotation.x = -Math.PI / 2 + 0.38; ring.rotation.y = 0.32;
    this.scene.add(ring);
    // small sister moon
    const moon = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 16), new THREE.MeshBasicMaterial({ color: '#d9c8ff', fog: false }));
    moon.position.set(-2600, 1500, -2200); this.scene.add(moon);
    this.planet = planet;
  }

  // ---------------------------------------------------------------- terrain
  _buildTerrain() {
    const seg = this.quality === 'low' ? 150 : 230;
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    const flat = geo.toNonIndexed();
    flat.computeVertexNormals();
    const p = flat.attributes.position, n = flat.attributes.normal;
    const colors = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    const regA = new THREE.Color('#6b5a86'), regB = new THREE.Color('#8f7193'), regC = new THREE.Color('#3d3157');
    const iceC = new THREE.Color('#a9c9e8'), riftC = new THREE.Color('#2a1f3d'), glowC = new THREE.Color('#ff7a59');
    const padC = new THREE.Color('#4b4562'), mtnC = new THREE.Color('#9b86b8');
    for (let i = 0; i < p.count; i += 3) {
      // colour per triangle (faceted look)
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
      const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
      const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      const slope = 1 - n.getY(i);
      const v = fbm(x / 30, z / 30, 2) * 0.5 + 0.5;
      c.copy(regA).lerp(regB, v);
      c.lerp(regC, smoothstep(0.15, 0.55, slope));
      const r = Math.hypot(x, z);
      if (r < 48) c.lerp(padC, 0.55 * (1 - smoothstep(38, 48, r)));
      if (inBasin(x, z) || Math.hypot(x - SITES.basin.x, z - SITES.basin.z) < SITES.basin.r + 10) {
        const d = Math.hypot(x - SITES.basin.x, z - SITES.basin.z);
        c.lerp(iceC, 0.85 * (1 - smoothstep(SITES.basin.r - 6, SITES.basin.r + 10, d)));
      }
      const dr = Math.abs(x - riftX(z));
      if (dr < 18) { c.lerp(riftC, 0.8 * (1 - smoothstep(4, 18, dr))); if (y < -28) c.lerp(glowC, 0.6); }
      if (r > EDGE) c.lerp(mtnC, smoothstep(EDGE, EDGE + 40, r) * 0.7);
      const jitter = (simplex2(x * 0.7, z * 0.7)) * 0.04;
      c.offsetHSL(0, 0, jitter);
      for (let k = 0; k < 3; k++) { colors[(i + k) * 3] = c.r; colors[(i + k) * 3 + 1] = c.g; colors[(i + k) * 3 + 2] = c.b; }
    }
    flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0.02 });
    this.terrain = new THREE.Mesh(flat, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);

    // glowing fissure along the Rift floor
    {
      const pts = []; for (let z = -270; z <= 270; z += 6) pts.push(new THREE.Vector3(riftX(z), heightAt(riftX(z), z) + 0.6, z));
      const curve = new THREE.CatmullRomCurve3(pts);
      const fissure = new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 1.3, 5, false), new THREE.MeshBasicMaterial({ color: '#ff7a45', fog: false }));
      this.scene.add(fissure); this.fissure = fissure;
    }
    // magma glow deep in the Rift
    const riftGlow = new THREE.PointLight('#ff6a3d', 3, 160, 1.4);
    riftGlow.position.set(riftX(0), -20, 0); this.scene.add(riftGlow);
    this.riftGlow = riftGlow;
  }

  // ---------------------------------------------------------------- crystals
  _buildCrystals() {
    // Crystal density follows the true yield field → the bias near the base is visible.
    const rnd = mulberry32(99);
    const geo = new THREE.OctahedronGeometry(1, 0);
    geo.scale(0.55, 1.6, 0.55);
    const mat = new THREE.MeshStandardMaterial({ color: '#4fd8ff', emissive: '#29c6ff', emissiveIntensity: 0.85, roughness: 0.2, metalness: 0.1, flatShading: true });
    const N = this.quality === 'low' ? 1400 : 2600;
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
    const col = new THREE.Color();
    let i = 0, guard = 0;
    while (i < N && guard++ < 200000) {
      const x = (rnd() - 0.5) * 2 * (EDGE - 15), z = (rnd() - 0.5) * 2 * (EDGE - 15);
      if (!insideMap(x, z) || inRift(x, z) || inBasin(x, z) || Math.hypot(x, z) < 36) continue;
      if (Math.hypot(x - SITES.domes.x, z - SITES.domes.z) < 30) continue;
      if (Math.hypot(x - SITES.post.x, z - SITES.post.z) < 42 || Math.hypot(x - SITES.depot.x, z - SITES.depot.z) < 14) continue;
      if (Math.abs(x - riftX(z)) < 34 || Math.hypot(x - SITES.outpost.x, z - SITES.outpost.z) < 24 || Math.hypot(x - SITES.basinGate.x, z - SITES.basinGate.z) < 18) continue;
      if (Math.abs(x - SITES.basinGate.x) < 10 && z < -100) continue;
      const y = yieldAt(x, z);
      if (rnd() > Math.min(1, (y / 46) ** 1.6)) continue;
      const sc = 0.45 + Math.min(1.5, y / 30) * (0.55 + rnd() * 0.5);
      e.set((rnd() - 0.5) * 0.7, rnd() * 6, (rnd() - 0.5) * 0.7); q.setFromEuler(e);
      s.set(sc, sc, sc);
      m.compose(new THREE.Vector3(x, heightAt(x, z) + sc * 0.9, z), q, s);
      mesh.setMatrixAt(i, m);
      col.copy(PALETTE.crystal).lerp(PALETTE.crystal2, clamp((y - 15) / 50, 0, 1) * rnd());
      mesh.setColorAt(i, col);
      i++;
    }
    mesh.count = i;
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.crystals = mesh;
  }

  // ---------------------------------------------------------------- base
  _mat(color, opts = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.35, flatShading: true, ...opts }); }

  _buildBase() {
    const base = new THREE.Group();
    const hull = this._mat('#d9d3e6'), dark = this._mat('#3a3550'), glow = new THREE.MeshStandardMaterial({ color: '#ffd28a', emissive: '#ffb14d', emissiveIntensity: 2.2 });
    const cyan = new THREE.MeshStandardMaterial({ color: '#7ff', emissive: '#3ef0ff', emissiveIntensity: 2.2 });
    // central council hall: big dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hull);
    dome.position.set(SITES.council.x, 0, SITES.council.z); dome.castShadow = dome.receiveShadow = true; base.add(dome);
    const ringStrip = new THREE.Mesh(new THREE.TorusGeometry(14.1, 0.35, 6, 48), glow);
    ringStrip.rotation.x = Math.PI / 2; ringStrip.position.set(SITES.council.x, 1.6, SITES.council.z); base.add(ringStrip);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.5, 3, 8), dark); cap.position.set(SITES.council.x, 14.2, SITES.council.z); base.add(cap);
    // habitat modules around
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.4;
      const r = 30 + (k % 2) * 6;
      const x = Math.cos(a) * r, z = Math.sin(a) * r + 6;
      const hab = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 7, 10), hull); body.position.y = 3.5; body.castShadow = true; hab.add(body);
      const roof = new THREE.Mesh(new THREE.SphereGeometry(4.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hull); roof.position.y = 7; hab.add(roof);
      const win = new THREE.Mesh(new THREE.TorusGeometry(4.35, 0.18, 4, 24), k % 3 ? glow : cyan); win.rotation.x = Math.PI / 2; win.position.y = 4.6; hab.add(win);
      hab.position.set(x, 0, z); base.add(hab);
      // connecting tube
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, r - 15, 8), dark);
      tube.rotation.z = Math.PI / 2; tube.rotation.y = -a;
      tube.position.set(Math.cos(a) * (r / 2 + 7), 1.2, Math.sin(a) * (r / 2 + 7) + 6); base.add(tube);
    }
    // comms mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 34, 6), dark); mast.position.set(18, 17, -18); mast.castShadow = true; base.add(mast);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), hull);
    dish.position.set(18, 30, -18); dish.rotation.x = -1.2; dish.material.side = THREE.DoubleSide; base.add(dish);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshStandardMaterial({ color: '#f44', emissive: '#ff2b2b', emissiveIntensity: 4 }));
    blink.position.set(18, 34.5, -18); base.add(blink);
    this.animated.push({ update: (dt, t) => { blink.visible = Math.sin(t * 3) > 0.2; dish.rotation.z = t * 0.2; } });
    // landing pad
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 0.6, 6), dark); pad.position.set(-26, 0.3, -26); pad.receiveShadow = true; base.add(pad);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 4), glow); l.position.set(-26 + Math.cos(a) * 10.4, 0.8, -26 + Math.sin(a) * 10.4); base.add(l);
    }
    // a parked shuttle (the evacuation ship Voss wants to use)
    const shuttle = new THREE.Group();
    const fus = new THREE.Mesh(new THREE.ConeGeometry(3.2, 13, 8), hull); fus.rotation.x = Math.PI / 2; shuttle.add(fus);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 4.5), dark); wing.position.z = 3; shuttle.add(wing);
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 2, 8), cyan); eng.rotation.x = Math.PI / 2; eng.position.z = 6.6; shuttle.add(eng);
    shuttle.position.set(-26, 3.5, -26); shuttle.rotation.y = 0.8; shuttle.traverse((o) => (o.castShadow = true)); base.add(shuttle);
    // solar arrays
    for (let k = 0; k < 10; k++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 3.2), new THREE.MeshStandardMaterial({ color: '#28305e', metalness: 0.8, roughness: 0.25, emissive: '#101a40' }));
      sp.position.set(28 + (k % 5) * 7, 1.8, 26 + Math.floor(k / 5) * 6); sp.rotation.x = -0.5; sp.castShadow = true; base.add(sp);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.8, 4), dark); leg.position.set(sp.position.x, 0.9, sp.position.z); base.add(leg);
    }
    // perimeter light posts
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 3, 5), dark); post.position.set(Math.cos(a) * 46, 1.5, Math.sin(a) * 46); base.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 4), k % 2 ? glow : cyan); lamp.position.set(Math.cos(a) * 46, 3.2, Math.sin(a) * 46); base.add(lamp);
    }
    const baseLight = new THREE.PointLight('#ffb36b', 40, 90, 1.6); baseLight.position.set(0, 18, 0); base.add(baseLight);
    this.scene.add(base);
    this.base = base;
    this.colliders = [
      { x: SITES.council.x, z: SITES.council.z, r: 14.5 },
      { x: 18, z: -18, r: 1.5 }, { x: -26, z: -26, r: 8 },
    ];
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + 0.4; const r = 30 + (k % 2) * 6; this.colliders.push({ x: Math.cos(a) * r, z: Math.sin(a) * r + 6, r: 4.8 }); }
  }

  _buildGreenhouses() {
    const g = new THREE.Group();
    const glass = new THREE.MeshPhysicalMaterial({ color: '#bff7ff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    const frame = this._mat('#d9d3e6');
    const plantGeo = new THREE.ConeGeometry(0.5, 1.4, 5);
    this.domes = [];
    const defs = [
      // spaced so the rover can drive between domes into the central courtyard (beacon)
      { dx: -21, dz: -9, r: 7, big: false }, { dx: 0, dz: -18, r: 7, big: false }, { dx: 20, dz: -8, r: 7, big: false },
      { dx: -15, dz: 18, r: 10, big: true }, { dx: 18, dz: 18, r: 10, big: true },
    ];
    for (const d of defs) {
      const x = SITES.domes.x + d.dx, z = SITES.domes.z + d.dz;
      const shell = new THREE.Mesh(new THREE.SphereGeometry(d.r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass);
      shell.position.set(x, 0.2, z); shell.renderOrder = 2; g.add(shell);
      const rib = new THREE.Mesh(new THREE.SphereGeometry(d.r + 0.05, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#e6f8ff', wireframe: true, transparent: true, opacity: 0.35 }));
      rib.position.copy(shell.position); g.add(rib);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(d.r, 0.3, 4, 32), frame); ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.3, z); g.add(ring);
      const n = Math.floor(d.r * d.r * 0.9);
      const plants = new THREE.InstancedMesh(plantGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#103a10', roughness: 0.7, flatShading: true }), n);
      const m = new THREE.Matrix4(); const rnd = mulberry32(d.dx * 13 + d.dz);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * (d.r - 1.5);
        m.makeTranslation(x + Math.cos(a) * rr, 0.9, z + Math.sin(a) * rr); plants.setMatrixAt(i, m);
        plants.setColorAt(i, new THREE.Color('#5be37a'));
      }
      g.add(plants);
      const lamp = new THREE.PointLight('#c8ff9a', 8, d.r * 2.2, 2); lamp.position.set(x, d.r * 0.6, z); g.add(lamp);
      this.domes.push({ x, z, r: d.r, big: d.big, plants, n });
      this.colliders?.push({ x, z, r: d.r + 0.5 });
    }
    this.scene.add(g);
  }

  // Recolour plants in the greenhouses (healthy fraction 0..1) — used by Chapter 4
  setDomeHealth(fracs) {
    const healthy = new THREE.Color('#5be37a'), sick = new THREE.Color('#8a5a2b');
    this.domes.forEach((d, k) => {
      const f = fracs[k] ?? 1; const rnd = mulberry32(k * 31 + 7);
      for (let i = 0; i < d.n; i++) d.plants.setColorAt(i, rnd() < f ? healthy : sick);
      d.plants.instanceColor.needsUpdate = true;
    });
  }

  _buildListeningPost() {
    const g = new THREE.Group();
    const dark = this._mat('#3a3550'), hull = this._mat('#d9d3e6');
    const { x, z } = SITES.post; const y = heightAt(x, z);
    const hut = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 5), hull); hut.position.set(x - 6, y + 2, z - 4); hut.castShadow = true; g.add(hut);
    this.colliders?.push({ x: x - 6, z: z - 4, r: 4 });
    // seismometer array: tripods with glowing heads along the rim
    this.seismoHeads = [];
    for (let k = 0; k < 5; k++) {
      const sz = z - 40 + k * 20, sx = riftX(sz) - 26;
      const sy = heightAt(sx, sz);
      for (let l = 0; l < 3; l++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4, 4), dark);
        const a = (l / 3) * Math.PI * 2; leg.position.set(sx + Math.cos(a) * 0.7, sy + 1.5, sz + Math.sin(a) * 0.7); leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); g.add(leg);
      }
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), new THREE.MeshStandardMaterial({ color: '#ff9b6b', emissive: '#ff6a3d', emissiveIntensity: 1.2 }));
      head.position.set(sx, sy + 3.3, sz); g.add(head); this.seismoHeads.push(head);
    }
    const dish = new THREE.Mesh(new THREE.SphereGeometry(3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3), hull);
    dish.material.side = THREE.DoubleSide; dish.position.set(x - 6, y + 6.5, z - 4); dish.rotation.x = -0.9; g.add(dish);
    this.scene.add(g);
  }

  _buildBasin() {
    const g = new THREE.Group();
    this.vents = [];
    const rnd = mulberry32(5);
    const coneMat = this._mat('#c9d8ee', { roughness: 0.4 });
    const defs = [{ x: 0, z: 0, main: true }];
    for (let k = 0; k < 9; k++) defs.push({ x: (rnd() - 0.5) * 80, z: (rnd() - 0.5) * 80, main: false });
    for (const d of defs) {
      const x = SITES.basin.x + d.x, z = SITES.basin.z + d.z; const y = heightAt(x, z);
      const s = d.main ? 2.4 : 0.9 + rnd() * 0.6;
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * s, 3.4 * s, 2.2 * s, 9, 1, true), coneMat);
      cone.position.set(x, y + 1.1 * s, z); cone.castShadow = true; g.add(cone);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1.15 * s, 12), new THREE.MeshStandardMaterial({ color: '#7fe8ff', emissive: '#39c8ff', emissiveIntensity: 1.5 }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(x, y + 2.15 * s, z); g.add(pool);
      this.vents.push({ x, y: y + 2.2 * s, z, s, main: d.main });
      if (d.main) this.colliders?.push({ x, z, r: 3.6 * s });
    }
    this.scene.add(g);
    this.steam = new SteamSystem(this.scene, this.vents);
    this.animated.push(this.steam);
  }

  _buildOutpost() {
    const g = new THREE.Group();
    const { x, z } = SITES.outpost; const y = heightAt(x, z);
    const hull = this._mat('#a9a3b8'), dark = this._mat('#2e2a40');
    const hab = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 9, 10), hull); hab.rotation.z = Math.PI / 2; hab.position.set(x + 6, y + 5, z - 4); hab.castShadow = true; g.add(hab);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 16, 5), dark); mast.position.set(x - 5, y + 8, z - 6); g.add(mast);
    const light = new THREE.PointLight('#7ff6ff', 10, 30, 2); light.position.set(x + 6, y + 11, z - 4); g.add(light);
    const beaconMat = new THREE.MeshStandardMaterial({ color: '#7ff6ff', emissive: '#4ff', emissiveIntensity: 3 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), beaconMat); b.position.set(x - 5, y + 16.4, z - 6); g.add(b);
    this.animated.push({ update: (dt, t) => { const f = Math.random() > 0.97 ? 0.1 : 1; light.intensity = 10 * f * (0.7 + 0.3 * Math.sin(t * 7)); b.visible = Math.sin(t * 1.3) > -0.3; } });
    this.colliders?.push({ x: x + 6, z: z - 4, r: 6 });
    this.scene.add(g);
  }

  _buildRocks() {
    const rnd = mulberry32(42);
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = this._mat('#5a4c73', { roughness: 0.95, metalness: 0 });
    const N = this.quality === 'low' ? 350 : 700;
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let i = 0, guard = 0;
    while (i < N && guard++ < 20000) {
      const x = (rnd() - 0.5) * 2 * EDGE, z = (rnd() - 0.5) * 2 * EDGE;
      if (!insideMap(x, z) || inRift(x, z) || Math.hypot(x, z) < 55 || inBasin(x, z)) continue;
      if (Math.hypot(x - SITES.domes.x, z - SITES.domes.z) < 40 || Math.hypot(x - SITES.post.x, z - SITES.post.z) < 25) continue;
      if (Math.abs(x - SITES.basinGate.x) < 14 && z < -100) continue; // keep gate→outpost road clear
      const s = 0.4 + rnd() ** 3 * 4;
      e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, heightAt(x, z) + s * 0.3, z), q, new THREE.Vector3(s, s * (0.6 + rnd() * 0.5), s));
      mesh.setMatrixAt(i++, m);
      if (s > 2.5) this.colliders.push({ x, z, r: s * 0.9 });
    }
    mesh.count = i; mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  // ---------------------------------------------------------------- beacons
  addBeacon(x, z, color = '#5ff2ff', label = '') {
    const y = heightAt(x, z);
    const g = new THREE.Group();
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uTime;
        void main(){ float a = (1.0 - vUv.y) * (0.55 + 0.45*sin(vUv.y*30.0 - uTime*3.0)); a *= 0.55; gl_FragColor = vec4(uColor*1.6, a); }`,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 90, 16, 1, true), beamMat);
    beam.position.y = 45; g.add(beam);
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, fog: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.18, 6, 48), ringMat); ring.rotation.x = Math.PI / 2; g.add(ring);
    const ring2 = ring.clone(); ring2.scale.setScalar(0.6); g.add(ring2);
    g.position.set(x, y + 0.5, z);
    this.scene.add(g);
    const obj = {
      group: g, x, z, label, active: true,
      update: (dt, t) => {
        beamMat.uniforms.uTime.value = t;
        ring.position.y = 1 + Math.sin(t * 2) * 0.6; ring2.position.y = 2.5 + Math.sin(t * 2 + 1) * 0.6;
        ring.rotation.z = t * 0.6; ring2.rotation.z = -t;
        g.visible = obj.active;
      },
    };
    this.animated.push(obj);
    return obj;
  }

  // ---------------------------------------------------------------- composer
  _buildComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.quality !== 'low') {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.65, 0.55, 0.82);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
  }

  update(dt, t) { for (const a of this.animated) a.update(dt, t); }
  render() { this.composer.render(); }
}

const WORLD_SIZE = 720;

// ---------------------------------------------------------------- steam / geyser particles
class SteamSystem {
  constructor(scene, vents) {
    this.vents = vents;
    this.N = 1800;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.N * 3);
    this.vel = new Float32Array(this.N * 3);
    this.life = new Float32Array(this.N);
    this.size = new Float32Array(this.N);
    this.alpha = new Float32Array(this.N);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color('#e8f6ff') }, uScale: { value: window.innerHeight * 0.5 } },
      vertexShader: `attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale;
        void main(){ vA=aAlpha; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; uniform vec3 uColor; void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); float a = smoothstep(0.5,0.0,d)*vA; gl_FragColor = vec4(uColor, a); }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
    this.erupting = 0; // seconds of eruption remaining
    this.eruptPower = 1;
  }
  emit(v, speed, spread, size, life) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.N;
    this.pos[i * 3] = v.x + (Math.random() - 0.5) * v.s; this.pos[i * 3 + 1] = v.y; this.pos[i * 3 + 2] = v.z + (Math.random() - 0.5) * v.s;
    this.vel[i * 3] = (Math.random() - 0.5) * spread; this.vel[i * 3 + 1] = speed * (0.7 + Math.random() * 0.6); this.vel[i * 3 + 2] = (Math.random() - 0.5) * spread;
    this.life[i] = life; this.size[i] = size;
  }
  erupt(seconds = 8) { this.erupting = seconds; }
  update(dt) {
    for (const v of this.vents) {
      if (Math.random() < (v.main ? 0.5 : 0.18)) this.emit(v, 1.5, 0.6, v.main ? 4 : 2.5, 4);
    }
    if (this.erupting > 0) {
      this.erupting -= dt;
      const main = this.vents[0];
      for (let k = 0; k < 22; k++) this.emit(main, 34 + Math.random() * 14, 6, 6 + Math.random() * 5, 3.2);
      for (const v of this.vents) if (!v.main && Math.random() < 0.6) this.emit(v, 16, 3, 4, 2.4);
    }
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 6 * dt * (this.vel[i * 3 + 1] > 8 ? 1 : 0.1);
      this.vel[i * 3] += 1.2 * dt; // wind
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += dt * 1.8;
      this.alpha[i] = Math.min(1, this.life[i] / 2) * 0.35;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.aSize.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true;
  }
}
