// CROWNBOUND — renderer. Three.js (vendored ESM). Fixed follow camera,
// craggy procedural stone colossi, the v4 Ape King cutout as a billboard
// sprite (NEVER redrawn in code), gold chains, telegraphed hazards, and the
// user's five reference images as distant backdrop vistas (Fix 8), one per
// matching stage. Decorative choices are seeded per stage (mulberry32), so
// the rendered world is deterministic across loads — the sim already was.
import * as THREE from '../vendor/three.module.min.js';
import { CROWNBOUND_STAGES as STAGES, ARENA_HALF_X, ARENA_HALF_Z } from './config.js';
import { pinGround, maxChains } from './sim.js';

function hex(c) { return new THREE.Color(c); }

// Deterministic PRNG for decoration (the sim's seeded RNG is not visible
// here, so a fixed per-stage seed gives the same reproducibility).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Image aspects (w/h), so each vista plane is sized without distortion.
const BACKDROP_ASPECT = [659 / 465, 0, 713 / 430, 659 / 465, 728 / 410, 738 / 415];
const BACKDROP_FILES = [
  './assets/ref-cave.jpg',     // stage 1 — Sunken Crystal Cavern
  null,                        // stage 2 — Sunset Sky-Bridge (procedural)
  './assets/ref-coral.jpg',    // stage 3 — Coral Abyssal Trench
  './assets/ref-nebula.jpg',   // stage 4 — Ringed Moon Observatory
  './assets/ref-colossus.jpg', // stage 5 — Caldera Foundry (misty giant)
  './assets/ref-castle.jpg',   // stage 6 — Floating Castle Citadel (cover)
];

export function createRenderer(canvas, kingTextureUrl) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(1280, 720, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = hex('#10255e');
  scene.fog = new THREE.Fog(hex('#10255e'), 55, 110);

  const camera = new THREE.PerspectiveCamera(50, 1280 / 720, 0.1, 400);
  camera.position.set(0, 18, 34);
  camera.lookAt(0, 2, -6);

  // ---- lights (brightened in the fix round: the old 0.55 ambient left the
  // frames darker than FULGURITE) ----
  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xfff2cc, 1.35);
  key.position.set(18, 30, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -32; key.shadow.camera.right = 32;
  key.shadow.camera.top = 24; key.shadow.camera.bottom = -24;
  scene.add(key);
  // warm sunset rim light from behind the altar (-z), gold not cyan
  const rim = new THREE.DirectionalLight(0xffd43b, 0.85);
  rim.position.set(-20, 14, -24);
  scene.add(rim);
  // Fix round 2 (A): warm floor light. The cover/play lower third read
  // dark even after the fix-round-1 brightening, so the floor gets its own
  // warm bounce instead of a flat global brightness bump:
  //  - HemisphereLight, per-stage colours set in setStageDecor (Gemini:
  //    Stage 6 0xffb870/0x6e4a5e/1.15, Stage 4 0x7ce8ff/0x3d356b/1.10).
  //  - kingLight: warm point light above/in front of the King (Gemini:
  //    0xffaa44, 1.8, 18 at king+1.5/+3.0/+2.0) — it follows the staged
  //    King position in cover mode, so it lights the hero + foreground.
  //  - fill: warm camera-side fill (Qwen: 0xffd9a0, 0.55 at (0,6,26));
  //    intensity is per-camMode in update() (0.55 cover/playshot, 0.25
  //    elsewhere) so the title frame keeps its cave mood.
  //  - brazierLight: ember-orange pool at the brazier nearest the King
  //    (DeepSeek: #FF8C00, 2.5, distance 12, decay 2), cover mode only.
  const hemi = new THREE.HemisphereLight(0xffe8c8, 0x5a4a5e, 0.6);
  scene.add(hemi);
  const kingLight = new THREE.PointLight(0xffaa44, 1.8, 18, 2);
  scene.add(kingLight);
  const fill = new THREE.DirectionalLight(0xffd9a0, 0.55);
  fill.position.set(0, 6, 26);
  scene.add(fill);
  const brazierLight = new THREE.PointLight(0xff8c00, 0, 12, 2);
  scene.add(brazierLight);

  // ---- ground: procedural warm stone tiles (Fix: the bare dark grid) ----
  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF_X * 2 + 8, ARENA_HALF_Z * 2 + 8),
    // Fix round 2 (A, Gemini): roughness 0.9 -> 0.62, metalness 0.05 -> 0.12
    // so the sunset/nebula light catches the stone tiles; the subtle warm
    // emissive (0x241934, 0.35) lifts the floor without the 0x9a8ea8 colour
    // tint, which would multiply the ground texture map down.
    new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.12, emissive: 0x241934, emissiveIntensity: 0.35 }),
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  function makeGroundTexture(stage, rng) {
    const W = 1024, H = 768;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    // base: the stage's warm ground tone, lifted ~12% (ref9/ref8: the world
    // is lush and bright, not a dungeon floor). Fix round 2 (A, Qwen):
    // base lift 0.12 -> 0.20 — the stage grounds are dark violet
    // (#241a4d / #2a2450), which is why the lower third read black.
    g.fillStyle = shade(stage.ground, 0.20);
    g.fillRect(0, 0, W, H);
    // large stone tiles with per-tile tone variation
    const cols = 8, rows = 6;
    const tw = W / cols, th = H / rows;
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const v = 0.20 + (rng() - 0.5) * 0.14;
        g.fillStyle = shade(stage.ground, v);
        g.fillRect(i * tw + 2, j * th + 2, tw - 4, th - 4);
      }
    }
    // grout lines
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 3;
    for (let i = 0; i <= cols; i += 1) {
      g.beginPath(); g.moveTo(i * tw, 0); g.lineTo(i * tw, H); g.stroke();
    }
    for (let j = 0; j <= rows; j += 1) {
      g.beginPath(); g.moveTo(0, j * th); g.lineTo(W, j * th); g.stroke();
    }
    // cracks: dark random walks
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    for (let c = 0; c < 12; c += 1) {
      g.lineWidth = 2 + rng() * 2;
      g.beginPath();
      let x = rng() * W, y = rng() * H;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k += 1) {
        x += (rng() - 0.5) * 220; y += (rng() - 0.5) * 160;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // gold-inlaid runes: circles + strokes in the trim colour. Fix round 2
    // (A): the "ground-trim" lift Qwen asked for has no separate trim
    // material — the runes ARE the trim, painted into this texture — so
    // their alpha rises 0.55 -> 0.75 and they read as gold inlay, not dirt.
    g.strokeStyle = stage.groundTrim;
    g.globalAlpha = 0.75;
    for (let c = 0; c < 6; c += 1) {
      const x = rng() * W, y = rng() * H, r = 14 + rng() * 26;
      g.lineWidth = 3;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.stroke();
      g.beginPath(); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke();
    }
    // glowing crystal veins (cyan + magenta)
    for (let c = 0; c < 5; c += 1) {
      const col = c % 2 ? '#ff3b8e' : '#5ef2ff';
      g.strokeStyle = col;
      g.globalAlpha = 0.25; g.lineWidth = 7;
      g.beginPath();
      let x = rng() * W, y = rng() * H;
      g.moveTo(x, y);
      for (let k = 0; k < 5; k += 1) {
        x += (rng() - 0.5) * 300; y += (rng() - 0.5) * 200;
        g.lineTo(x, y);
      }
      g.stroke();
      g.globalAlpha = 0.7; g.lineWidth = 2;
      g.stroke();
    }
    g.globalAlpha = 1;
    // gold border trim
    g.strokeStyle = 'rgba(255,197,61,0.6)';
    g.lineWidth = 8;
    g.strokeRect(6, 6, W - 12, H - 12);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  // lighten/darken a #rrggbb colour by a fraction (-1..1)
  function shade(c, f) {
    const n = parseInt(c.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * (1 + f)));
    const gg = Math.max(0, Math.min(255, ((n >> 8) & 255) * (1 + f)));
    const b = Math.max(0, Math.min(255, (n & 255) * (1 + f)));
    return `rgb(${r | 0},${gg | 0},${b | 0})`;
  }

  // ---- sky: per-stage vertical gradient (the old flat sky[0] hid the
  // sunset; the gradient makes the warm horizon visible in every frame) ----
  function makeSkyTexture(stage) {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 256;
    const g = cv.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, stage.sky[0]);
    grad.addColorStop(0.5, stage.sky[1]);
    grad.addColorStop(0.78, stage.sky[2]);
    grad.addColorStop(1, stage.sky[3]);
    g.fillStyle = grad;
    g.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ---- altar (golden structure at the breach line) ----
  const altarGroup = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc53d, roughness: 0.35, metalness: 0.7, emissive: 0x664400, emissiveIntensity: 0.25 });
  const altarBase = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 2.4), goldMat);
  altarBase.position.set(0, 1.1, -16.5);
  altarBase.castShadow = true;
  altarGroup.add(altarBase);
  const altarTop = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 3.2), goldMat);
  altarTop.position.set(0, 2.4, -16.5);
  altarTop.castShadow = true;
  altarGroup.add(altarTop);
  for (let i = -2; i <= 2; i += 1) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 3.4, 8), goldMat);
    pillar.position.set(i * 2.2, 1.7, -16.5);
    pillar.castShadow = true;
    altarGroup.add(pillar);
  }
  const altarGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshStandardMaterial({ color: 0xff3b8e, emissive: 0xff3b8e, emissiveIntensity: 1.2, roughness: 0.2 }),
  );
  altarGem.position.set(0, 3.6, -16.5);
  altarGroup.add(altarGem);
  scene.add(altarGroup);

  // breach line (glowing red-gold line at z = -14)
  const breach = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF_X * 2, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.75 }),
  );
  breach.rotation.x = -Math.PI / 2;
  breach.position.set(0, 0.03, -14);
  scene.add(breach);

  // ---- pylons (golden obelisks) ----
  const pylonMeshes = [];
  for (const p of [
    { x: -22, z: -8 }, { x: 22, z: -8 }, { x: -22, z: 8 }, { x: 22, z: 8 },
    { x: -12, z: -2 }, { x: 12, z: -2 }, { x: -12, z: 12 }, { x: 12, z: 12 },
    { x: 0, z: -6 }, { x: 0, z: 6 },
  ]) {
    const g = new THREE.Group();
    const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 4.2, 6), goldMat);
    ob.position.y = 2.1;
    ob.castShadow = true;
    g.add(ob);
    const tip = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.7),
      new THREE.MeshStandardMaterial({ color: 0x5ef2ff, emissive: 0x5ef2ff, emissiveIntensity: 1.0, roughness: 0.2 }),
    );
    tip.position.y = 4.6;
    g.add(tip);
    g.position.set(p.x, 0, p.z);
    scene.add(g);
    pylonMeshes.push(g);
  }

  // ---- the King: the v4 cutout as a billboard sprite (never redrawn) ----
  // Texture load tracking: screenshots must not fire before the art is in.
  let texLoaded = 0;
  const texTotal = 1 + BACKDROP_FILES.filter(Boolean).length;
  function texDone() { texLoaded += 1; }
  function texFail(url) { return () => { console.warn('texture failed to load:', url); texDone(); }; }
  const kingTex = new THREE.TextureLoader().load(kingTextureUrl, texDone, undefined, texFail(kingTextureUrl));
  kingTex.colorSpace = THREE.SRGBColorSpace;
  const kingSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: kingTex, transparent: true, depthWrite: false }));
  kingSprite.scale.set(2.4, 1.8, 1);
  scene.add(kingSprite);
  const kingShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
  );
  kingShadow.rotation.x = -Math.PI / 2;
  kingShadow.position.y = 0.02;
  scene.add(kingShadow);
  // crown glow above the King
  const kingGlow = new THREE.PointLight(0xffc53d, 12, 12, 1.8);
  scene.add(kingGlow);
  // Fix round 2 (C, Qwen Fix 3): cover-only gold halo behind the King so he
  // pops at thumbnail size without growing past the scale story. A 7x7
  // plane with a radial-gradient canvas texture (gold centre -> transparent),
  // additive, fog:false, opacity 0.5, shown only in cover mode.
  const haloCv = document.createElement('canvas');
  haloCv.width = 256; haloCv.height = 256;
  {
    const hg = haloCv.getContext('2d');
    const grad = hg.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 197, 61, 0.9)');
    grad.addColorStop(0.5, 'rgba(255, 170, 60, 0.35)');
    grad.addColorStop(1, 'rgba(255, 170, 60, 0)');
    hg.fillStyle = grad;
    hg.fillRect(0, 0, 256, 256);
  }
  const haloTex = new THREE.CanvasTexture(haloCv);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  const kingHalo = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, opacity: 0.5, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  kingHalo.visible = false;
  scene.add(kingHalo);

  // ---- backdrop vistas: the user's reference images as distant planes ----
  // Feather the edges of each vista into transparency so the backdrop melts
  // into the stage sky instead of ending in a hard seam. Fix round 2 (B):
  // feathering is fw 0.22 on L/R plus top/bottom gradients fh 0.18.
  // ROOT CAUSE, PROVED BY PROBE (fix round 2): the old helper used
  // 'destination-in' with fills over just the edge bands. That op KEEPS the
  // destination ONLY where the source shape was drawn — so band fills erase
  // everything OUTSIDE the bands, i.e. the whole picture. (The fix-round-1
  // record blamed the in-place tex.image swap; the probe shows the swap
  // was innocent and the composite-op semantics were the killer — a solid
  // opaque rect under destination-in over the left band alone erased the
  // centre pixel.) Edge feathering needs 'destination-out': the source
  // shape defines the ERASE region, so each band fill erases its own edge
  // (opaque at the outer rim, fading to transparent inward) and the centre
  // is never touched. The fresh-CanvasTexture construction is kept anyway
  // (never an in-place tex.image swap).
  function featherCanvas(img) {
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    const fw = Math.round(img.width * 0.22);
    const fh = Math.round(img.height * 0.18);
    g.globalCompositeOperation = 'destination-out';
    // left edge: erase from the rim (opaque) fading inward (transparent)
    const gradL = g.createLinearGradient(0, 0, fw, 0);
    gradL.addColorStop(0, 'rgba(0,0,0,1)');
    gradL.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gradL;
    g.fillRect(0, 0, fw, img.height);
    const gradR = g.createLinearGradient(img.width, 0, img.width - fw, 0);
    gradR.addColorStop(0, 'rgba(0,0,0,1)');
    gradR.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gradR;
    g.fillRect(img.width - fw, 0, fw, img.height);
    const gradT = g.createLinearGradient(0, 0, 0, fh);
    gradT.addColorStop(0, 'rgba(0,0,0,1)');
    gradT.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gradT;
    g.fillRect(0, 0, img.width, fh);
    const gradB = g.createLinearGradient(0, img.height, 0, img.height - fh);
    gradB.addColorStop(0, 'rgba(0,0,0,1)');
    gradB.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gradB;
    g.fillRect(0, img.height - fh, img.width, fh);
    g.globalCompositeOperation = 'source-over';
    return cv;
  }
  // Each entry starts as the TextureLoader texture (so the mesh has a map
  // immediately) and is REPLACED in onLoad by a fresh feathered
  // CanvasTexture. backdropsReady() counts onLoad calls, so a shot never
  // fires before every vista is feathered. update() swaps a staged mesh's
  // map if its entry changed after the mesh was built.
  const backdropTex = BACKDROP_FILES.map((f, i) => {
    if (!f) return null;
    const t = new THREE.TextureLoader().load(f, (tex) => {
      const ft = new THREE.CanvasTexture(featherCanvas(tex.image));
      ft.colorSpace = THREE.SRGBColorSpace;
      backdropTex[i] = ft;
      tex.dispose();
      texDone();
    }, undefined, texFail(f));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  let backdropMesh = null;
  let backdropStageIdx = -1;
  function setBackdrop(stageIdx) {
    if (backdropMesh) { scene.remove(backdropMesh); backdropMesh = null; }
    const tex = backdropTex[stageIdx];
    if (!tex) return;
    // Flat rectangular vista, far behind the arena (never a stretched
    // scene.background). Fix round 2 (B): widened 190 -> 240, height x1.15
    // (aspect-matched, so no distortion), pushed deeper to z=-95, centre
    // y=21 — the edges fall outside the playshot frustum.
    const h = (240 / BACKDROP_ASPECT[stageIdx]) * 1.15;
    backdropMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(240, h),
      new THREE.MeshBasicMaterial({ map: tex, fog: false, transparent: true }),
    );
    backdropMesh.position.set(0, 21, -95);
    backdropStageIdx = stageIdx;
    scene.add(backdropMesh);
  }

  // ---- colossus factory (REBUILT in the fix round) ----
  // Was: three flat dark boxes (torso BoxGeometry + cylinder legs + box
  // head). Now: a craggy stone mass — irregular chunks fused at angles with
  // visible seams, tapered legs with knee joints, massive knuckled arms,
  // beveled shoulder pauldrons, glowing teal crystals embedded in the stone,
  // and a large glowing cracked gold heart-sigil. Palette (ref12, the rune
  // golem): dark slate plates #454E57 / highlights #6B7680 / shadows
  // #2A2F33, bronze trim #B07840, teal crystals/runes #35F2C8 / #4FE8B0,
  // sigil stays gold #FFD166 (the King's target). The dark plates read
  // because the world around them is bright — never flat dark on dark.
  // Chunk placement is seeded per colossus (deterministic).
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x454e57, roughness: 0.9, metalness: 0.08, flatShading: true });
  const stoneLightMat = new THREE.MeshStandardMaterial({ color: 0x6b7680, roughness: 0.85, metalness: 0.08, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.9, metalness: 0.1, flatShading: true });
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xb07840, roughness: 0.6, metalness: 0.35, flatShading: true });
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x35f2c8, emissive: 0x35f2c8, emissiveIntensity: 1.8, roughness: 0.2, flatShading: true });
  const runeMat = new THREE.MeshStandardMaterial({ color: 0x4fe8b0, emissive: 0x4fe8b0, emissiveIntensity: 2.0, roughness: 0.2 });
  const sigilMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffd166, emissiveIntensity: 1.6, roughness: 0.3, flatShading: true });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x4fe8b0, emissive: 0x4fe8b0, emissiveIntensity: 2.2 });
  const pinMat = new THREE.MeshStandardMaterial({ color: 0x5ef2ff, emissive: 0x5ef2ff, emissiveIntensity: 1.8, roughness: 0.2 });
  const pinChainedMat = new THREE.MeshStandardMaterial({ color: 0xffc53d, emissive: 0xffc53d, emissiveIntensity: 1.8, roughness: 0.2 });
  const pinDoneMat = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0x222222, roughness: 0.6 });

  function chunk(rng, geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx + (rng() - 0.5) * 0.5, ry + (rng() - 0.5) * 0.5, rz + (rng() - 0.5) * 0.5);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    return m;
  }

  function buildColossus(state, col) {
    const size = col.size;
    const s = size / 14; // scale relative to the standard colossus
    const rng = mulberry32(0xB055 + col.id * 131 + state.stageIdx * 17 + size * 7);
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    // --- legs: tapered stone columns with a knee joint each ---
    for (const side of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.62 * s, 0.8 * s, 1.9 * s, 7), stoneMat);
      thigh.position.set(side * 1.15 * s, 2.5 * s, 0);
      thigh.castShadow = true;
      body.add(thigh);
      const knee = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72 * s, 0), stoneLightMat);
      knee.position.set(side * 1.15 * s, 1.55 * s, 0.1 * s);
      knee.castShadow = true;
      body.add(knee);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.6 * s, 0.78 * s, 1.7 * s, 7), stoneMat);
      shin.position.set(side * 1.15 * s, 0.75 * s, 0);
      shin.castShadow = true;
      body.add(shin);
      const foot = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 * s, 0), darkMat);
      foot.scale.set(1.3, 0.5, 1.8);
      foot.position.set(side * 1.15 * s, 0.18 * s, 0.35 * s);
      body.add(foot);
    }
    // --- torso: 7 irregular stone chunks fused at angles ---
    const torsoChunks = [
      [2.3, 0, 5.9, 0, 0, 0, 1.25, 1.45, 0.85, stoneMat],
      [1.4, -1.7, 7.3, 0.2, 0, 0.4, 1, 1, 1, stoneLightMat],
      [1.5, 1.8, 7.1, -0.2, 0, -0.3, 1, 1, 1, stoneMat],
      [1.2, -2.0, 5.4, 0.3, 0, 0.7, 1, 1, 1, stoneMat],
      [1.3, 2.1, 5.2, -0.3, 0, 0.5, 1, 1, 1, stoneLightMat],
      [1.5, 0.3, 4.1, 0.2, 0, 0.2, 1, 1, 1, stoneMat],
      [1.6, -0.3, 6.0, -0.9, 0, 0, 1.3, 1.2, 0.6, stoneMat],
    ];
    for (const [r, x, y, z, rx, ry, rz, sx, sy, sz, mat] of torsoChunks) {
      body.add(chunk(rng, new THREE.DodecahedronGeometry(r * s, 0), mat, x * s, y * s, z * s, rx, ry, rz, sx, sy, sz));
    }
    // --- beveled shoulder pauldrons ---
    for (const side of [-1, 1]) {
      const paul = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 * s, 0), stoneLightMat);
      paul.scale.set(1.5, 0.8, 1.3);
      paul.position.set(side * 2.7 * s, 8.3 * s, 0);
      paul.rotation.z = side * -0.25;
      paul.castShadow = true;
      body.add(paul);
    }
    // --- arms: massive, knuckled, hanging past the knees ---
    // Bronze trim bands on both segments (ref12's copper arm bands).
    for (const side of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * s, 0.75 * s, 2.4 * s, 7), stoneMat);
      upper.position.set(side * 2.95 * s, 6.7 * s, 0);
      upper.rotation.z = side * -0.12;
      upper.castShadow = true;
      body.add(upper);
      const bandU = new THREE.Mesh(new THREE.CylinderGeometry(0.68 * s, 0.68 * s, 0.35 * s, 7), bronzeMat);
      bandU.position.set(side * 2.95 * s, 7.6 * s, 0);
      bandU.rotation.z = side * -0.12;
      body.add(bandU);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * s, 0.55 * s, 2.3 * s, 7), stoneMat);
      fore.position.set(side * 3.05 * s, 4.5 * s, 0);
      fore.rotation.z = side * -0.08;
      fore.castShadow = true;
      body.add(fore);
      const bandF = new THREE.Mesh(new THREE.CylinderGeometry(0.75 * s, 0.75 * s, 0.35 * s, 7), bronzeMat);
      bandF.position.set(side * 3.05 * s, 5.4 * s, 0);
      bandF.rotation.z = side * -0.08;
      body.add(bandF);
      const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95 * s, 0), darkMat);
      fist.position.set(side * 3.1 * s, 3.1 * s, 0.1 * s);
      fist.castShadow = true;
      body.add(fist);
      // knuckle bumps on the fist front
      for (const kx of [-0.5, 0, 0.5]) {
        const kn = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.3 * s, 0.3 * s), darkMat);
        kn.position.set((side * 3.1 + kx) * s, 3.35 * s, 0.95 * s);
        body.add(kn);
      }
      // teal diamond crystal set into the forearm (ref12's forearm gem)
      if (side === 1) {
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 * s), crystalMat);
        gem.position.set(3.8 * s, 4.5 * s, 0.55 * s);
        gem.rotation.set(0.4, 0.3, 0.2);
        body.add(gem);
      }
    }
    // --- head: craggy, heavy brow, glowing teal visor + eyes (ref12) ---
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(1.35 * s, 0), stoneMat);
    head.scale.set(1.05, 0.9, 0.95);
    head.position.set(0, 9.5 * s, 0);
    head.castShadow = true;
    body.add(head);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.7 * s, 0.55 * s, 1.3 * s), darkMat);
    jaw.position.set(0, 8.75 * s, 0.25 * s);
    body.add(jaw);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.8 * s, 0.32 * s, 0.25 * s), eyeMat);
    visor.position.set(0, 9.65 * s, 0.95 * s);
    body.add(visor);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 10, 10), eyeMat);
      eye.position.set(side * 0.48 * s, 9.65 * s, 1.02 * s);
      body.add(eye);
    }
    if (col.boss) {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.3 * s, 1.5 * s, 0.9 * s, 8), goldMat);
      crown.position.set(0, 10.7 * s, 0);
      body.add(crown);
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22 * s, 0.8 * s, 6), goldMat);
        spike.position.set(Math.cos(a) * 1.3 * s, 11.4 * s, Math.sin(a) * 1.3 * s);
        body.add(spike);
      }
    }
    // --- glowing teal crystals embedded in the stone ---
    const crystals = [
      [-2.7, 8.0, 0.7, 0.55], [3.15, 5.2, 0.7, 0.6], [0.4, 7.2, -1.25, 0.7], [1.9, 6.6, 1.0, 0.45],
    ];
    for (const [x, y, z, r] of crystals) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(r * s), crystalMat);
      c.position.set(x * s, y * s, z * s);
      c.rotation.set(rng() * 1.2, rng() * 1.2, rng() * 1.2);
      body.add(c);
    }
    // --- glowing teal rune lines traced across the chest plates (ref12) ---
    const runeGeoV = new THREE.BoxGeometry(0.16 * s, 2.3 * s, 0.08 * s);
    for (const rx of [-1.05, 1.05]) {
      const rune = new THREE.Mesh(runeGeoV, runeMat);
      rune.position.set(rx * s, 6.4 * s, 2.0 * s);
      body.add(rune);
    }
    const runeH = new THREE.Mesh(new THREE.BoxGeometry(2.7 * s, 0.16 * s, 0.08 * s), runeMat);
    runeH.position.set(0, 4.5 * s, 1.92 * s);
    body.add(runeH);
    // --- heart-sigil on the chest: large, glowing, cracked ---
    const sigil = new THREE.Mesh(new THREE.OctahedronGeometry(1.25 * s), sigilMat);
    sigil.position.set(0, 6.2 * s, 1.9 * s);
    body.add(sigil);
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 1.7 * s, 0.1 * s), darkMat);
    crack.position.set(0, 6.2 * s, 2.95 * s);
    crack.rotation.z = 0.5;
    body.add(crack);
    // pins: glowing rings at the layout offsets (pinGround gives the true
    // world position, including the pin's height dy)
    const pinMeshes = {};
    for (const p of col.pins) {
      const gp = pinGround(state, col, p);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55 * s, 0.14 * s, 8, 20), pinMat);
      ring.position.set(gp.x - col.x, gp.y, gp.z - col.z);
      ring.rotation.x = Math.PI / 2;
      body.add(ring);
      pinMeshes[p.id] = ring;
    }
    // boss rotating shield (a ring of plates with a gap = the blind spot)
    let shield = null;
    if (col.boss) {
      shield = new THREE.Group();
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        // leave a 120-degree gap centred on angle PI (the blind spot)
        const rel = Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI));
        if (Math.abs(rel) < 1.05) continue;
        const plate = new THREE.Mesh(new THREE.BoxGeometry(1.6 * s, 2.2 * s, 0.25 * s), goldMat);
        plate.position.set(Math.cos(a) * 3.4 * s, 6.0 * s, Math.sin(a) * 3.4 * s);
        plate.rotation.y = -a;
        shield.add(plate);
      }
      body.add(shield);
    }
    g.position.set(col.x, 0, col.z);
    g.userData = { body, sigil, pinMeshes, shield, size: s };
    scene.add(g);
    return g;
  }

  // ---- hazards / dynamic meshes ----
  const chainGroup = new THREE.Group();
  scene.add(chainGroup);
  const chainMat = new THREE.MeshBasicMaterial({ color: 0xffc53d });
  const chainTautMat = new THREE.MeshBasicMaterial({ color: 0xfff2a0 });
  const chainMeshes = [];
  function chainCylinder(a, b, mat) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 6), mat);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
  }

  // Hazard meshes, pooled by index (the sim's hazard entries carry no ids:
  // shockwaves {x,z,r}, shard telegraphs {x,z,t}, scarabs {x,z}, meteors
  // {x,z,t}, and one sweeping beam {z,dir} or null).
  const ringGeo = new THREE.RingGeometry(0.9, 1.1, 40);
  const shockPool = [];
  const shardPool = [];
  const scarabPool = [];
  const meteorPool = [];
  const pitMeshes = [];
  const decorGroup = new THREE.Group();
  scene.add(decorGroup);
  let beamMesh = null;
  let beamBar = null;

  function poolGet(pool, i, make) {
    if (!pool[i]) { pool[i] = make(); scene.add(pool[i].group); }
    return pool[i];
  }

  function syncHazards(state, dt) {
    // shockwaves: expanding rings (r grows 10/s, dies at 16)
    for (let i = 0; i < state.shockwaves.length; i += 1) {
      const w = state.shockwaves[i];
      const rec = poolGet(shockPool, i, () => {
        const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff8040, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
        mesh.rotation.x = -Math.PI / 2;
        const group = new THREE.Group();
        group.add(mesh);
        return { group, mesh };
      });
      rec.group.visible = true;
      rec.mesh.position.set(w.x, 0.05, w.z);
      rec.mesh.scale.setScalar(Math.max(0.1, w.r));
      rec.mesh.material.opacity = Math.max(0.05, 0.8 * (1 - w.r / 16));
    }
    for (let i = state.shockwaves.length; i < shockPool.length; i += 1) {
      if (shockPool[i]) shockPool[i].group.visible = false;
    }
    // shards: telegraph ring + falling crystal (t counts down from 0.9)
    for (let i = 0; i < state.shardTele.length; i += 1) {
      const s = state.shardTele[i];
      const rec = poolGet(shardPool, i, () => {
        const tel = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 24), new THREE.MeshBasicMaterial({ color: 0xff3b8e, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
        tel.rotation.x = -Math.PI / 2;
        const cry = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshStandardMaterial({ color: 0xff3b8e, emissive: 0xff3b8e, emissiveIntensity: 1.2 }));
        const group = new THREE.Group();
        group.add(tel);
        group.add(cry);
        return { group, tel, cry };
      });
      rec.group.visible = true;
      const frac = 1 - s.t / 0.9;
      rec.tel.position.set(s.x, 0.05, s.z);
      rec.cry.position.set(s.x, 18 * frac + 0.7, s.z);
      rec.cry.rotation.y += dt * 6;
      rec.tel.material.opacity = 0.3 + frac * 0.5;
    }
    for (let i = state.shardTele.length; i < shardPool.length; i += 1) {
      if (shardPool[i]) shardPool[i].group.visible = false;
    }
    // scarabs: dark spheres with red eyes, walking at the King
    for (let i = 0; i < state.scarabs.length; i += 1) {
      const s = state.scarabs[i];
      const rec = poolGet(scarabPool, i, () => {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1a0a1a, roughness: 0.4, metalness: 0.4 }));
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
        const group = new THREE.Group();
        group.add(body);
        group.add(eye);
        return { group, body, eye };
      });
      rec.group.visible = true;
      rec.body.position.set(s.x, 0.55, s.z);
      rec.eye.position.set(s.x, 0.75, s.z - 0.4);
    }
    for (let i = state.scarabs.length; i < scarabPool.length; i += 1) {
      if (scarabPool[i]) scarabPool[i].group.visible = false;
    }
    // meteors (boss phase 2): telegraph ring + falling rock (t from 1.2)
    for (let i = 0; i < state.meteors.length; i += 1) {
      const m = state.meteors[i];
      const rec = poolGet(meteorPool, i, () => {
        const tel = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.9, 28), new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
        tel.rotation.x = -Math.PI / 2;
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), new THREE.MeshStandardMaterial({ color: 0x662200, emissive: 0xff4400, emissiveIntensity: 1.5 }));
        const group = new THREE.Group();
        group.add(tel);
        group.add(rock);
        return { group, tel, rock };
      });
      rec.group.visible = true;
      const frac = 1 - m.t / 1.2;
      rec.tel.position.set(m.x, 0.05, m.z);
      rec.rock.position.set(m.x, 26 * frac + 1.4, m.z);
      rec.rock.rotation.y += dt * 3;
    }
    for (let i = state.meteors.length; i < meteorPool.length; i += 1) {
      if (meteorPool[i]) meteorPool[i].group.visible = false;
    }
    // the sweeping beam ring (stage 2): a glowing bar across the arena at z
    if (!beamMesh) {
      beamMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(ARENA_HALF_X * 2, 1.1),
        new THREE.MeshBasicMaterial({ color: 0x5ef2ff, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
      );
      beamMesh.rotation.x = -Math.PI / 2;
      beamMesh.position.y = 0.06;
      scene.add(beamMesh);
      beamBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, ARENA_HALF_X * 2, 6),
        new THREE.MeshBasicMaterial({ color: 0x5ef2ff, transparent: true, opacity: 0.4 }),
      );
      beamBar.rotation.z = Math.PI / 2;
      beamBar.position.y = 0.5;
      scene.add(beamBar);
    }
    const showBeam = !!state.beam;
    beamMesh.visible = showBeam;
    beamBar.visible = showBeam;
    if (showBeam) {
      beamMesh.position.z = state.beam.z;
      beamBar.position.z = state.beam.z;
      beamMesh.material.opacity = 0.55 + Math.sin(performance.now() / 120) * 0.2;
    }
  }

  // ---- stage backdrops & dressing (seeded: same stage, same world) ----
  let stageDecor = [];
  let groundTex = null;
  let skyTex = null;
  // Fix round 2 (A): brazier flame materials + positions, so update() can
  // boost the flames and park the brazier light in cover mode only.
  let brazierFlameMats = [];
  let brazierPositions = [];
  function setStageDecor(stageIdx) {
    for (const m of stageDecor) { decorGroup.remove(m); }
    stageDecor = [];
    brazierFlameMats = [];
    brazierPositions = [];
    const stage = STAGES[stageIdx];
    const rng = mulberry32(0xC0FFEE + stageIdx * 1013);
    // sky gradient + fog from the stage palette; ground texture rebuilt
    // per stage (warm stone tiles, gold runes, crystal veins)
    if (skyTex) skyTex.dispose();
    skyTex = makeSkyTexture(stage);
    scene.background = skyTex;
    scene.fog.color = hex(stage.sky[0]);
    // Fix round 2 (B, Gemini): Stage 4 fog blends the horizon into deep
    // sapphire-indigo (near 65, far 195) so the backdrop edge has nowhere
    // sharp to show. The scene.background is NOT replaced with a flat
    // colour (Gemini's literal instruction) — it is the sky-gradient
    // texture, and flattening it would kill the nebula sky.
    if (stageIdx === 3) {
      scene.fog.color.setHex(0x1b244a);
      scene.fog.near = 65;
      scene.fog.far = 195;
    } else {
      scene.fog.near = 55;
      scene.fog.far = 110;
    }
    ambient.color = hex(stage.sky[1]);
    // Fix round 2 (A, Gemini): warm hemisphere bounce per stage.
    if (stageIdx === 5) {
      hemi.color.setHex(0xffb870); hemi.groundColor.setHex(0x6e4a5e); hemi.intensity = 1.15;
    } else if (stageIdx === 3) {
      hemi.color.setHex(0x7ce8ff); hemi.groundColor.setHex(0x3d356b); hemi.intensity = 1.10;
    } else {
      hemi.color.setHex(0xffe8c8); hemi.groundColor.setHex(0x5a4a5e); hemi.intensity = 0.6;
    }
    if (groundTex) groundTex.dispose();
    groundTex = makeGroundTexture(stage, mulberry32(0x6A5510 + stageIdx * 331));
    groundMesh.material.map = groundTex;
    groundMesh.material.needsUpdate = true;
    // the reference-image vista for this stage (Fix 8)
    setBackdrop(stageIdx);
    // braziers: a ring of burning bowls at the arena edge
    const brazierPos = [[-24, -14], [24, -14], [-24, 14], [24, 14], [-25, 0], [25, 0]];
    for (const [x, z] of brazierPos) {
      brazierPositions.push([x, z]);
      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.4, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.9, flatShading: true }),
      );
      bowl.position.set(x, 0.45, z);
      decorGroup.add(bowl);
      stageDecor.push(bowl);
      const flameMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff6a00, emissiveIntensity: 2.2, transparent: true, opacity: 0.95 });
      brazierFlameMats.push(flameMat);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 1.6, 7),
        flameMat,
      );
      flame.position.set(x, 1.6, z);
      decorGroup.add(flame);
      stageDecor.push(flame);
    }
    // half-sunk ruins at the corners
    for (let i = 0; i < 5; i += 1) {
      const ruin = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.2 + rng() * 1.4, 0),
        new THREE.MeshStandardMaterial({ color: 0x6b5b4e, roughness: 0.95, flatShading: true }),
      );
      const a = (i / 5) * Math.PI * 2 + rng() * 0.5;
      ruin.position.set(Math.cos(a) * (24 + rng() * 4), 0.4, Math.sin(a) * (15 + rng() * 3));
      ruin.rotation.set(rng() * 0.6 - 0.3, rng() * 3, rng() * 0.6 - 0.3);
      ruin.scale.y = 0.55;
      decorGroup.add(ruin);
      stageDecor.push(ruin);
    }
    // lush valley dressing (ref8/ref9): moss tufts + yellow flowers at the
    // arena edge — the world is lived-in, not a bare grid
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x5fa83c, roughness: 1, flatShading: true });
    const mossMat2 = new THREE.MeshStandardMaterial({ color: 0x7ac74f, roughness: 1, flatShading: true });
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffd93d, emissive: 0xffd93d, emissiveIntensity: 0.5, roughness: 0.6, flatShading: true });
    for (let i = 0; i < 16; i += 1) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.5 + rng() * 0.4, 0.7 + rng() * 0.6, 5), i % 2 ? mossMat : mossMat2);
      const a = rng() * Math.PI * 2;
      tuft.position.set(Math.cos(a) * (20 + rng() * 8), 0.35, Math.sin(a) * (14 + rng() * 4));
      decorGroup.add(tuft);
      stageDecor.push(tuft);
    }
    for (let i = 0; i < 12; i += 1) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 5), flowerMat);
      const a = rng() * Math.PI * 2;
      fl.position.set(Math.cos(a) * (21 + rng() * 7), 0.28, Math.sin(a) * (14 + rng() * 3.5));
      decorGroup.add(fl);
      stageDecor.push(fl);
    }
    if (stageIdx === 0) {
      // crystal cave: glowing crystal clusters at the arena edges
      for (let i = 0; i < 14; i += 1) {
        const h = 2 + rng() * 4;
        const c = new THREE.Mesh(
          new THREE.ConeGeometry(0.8 + rng() * 0.7, h, 5),
          new THREE.MeshStandardMaterial({ color: 0x5ef2ff, emissive: 0x5ef2ff, emissiveIntensity: 0.9, roughness: 0.2 }),
        );
        const a = (i / 14) * Math.PI * 2;
        c.position.set(Math.cos(a) * 30, h / 2, Math.sin(a) * 22);
        c.rotation.z = (rng() - 0.5) * 0.4;
        decorGroup.add(c);
        stageDecor.push(c);
      }
    } else if (stageIdx === 1) {
      // sunset sky-bridge: a low golden sun disc on the horizon
      const sun = new THREE.Mesh(
        new THREE.CircleGeometry(9, 32),
        new THREE.MeshBasicMaterial({ color: 0xffc53d, fog: false, transparent: true, opacity: 0.95 }),
      );
      sun.position.set(-34, 22, -68);
      decorGroup.add(sun);
      stageDecor.push(sun);
      const halo = new THREE.Mesh(
        new THREE.CircleGeometry(13, 32),
        new THREE.MeshBasicMaterial({ color: 0xff7b00, fog: false, transparent: true, opacity: 0.35 }),
      );
      halo.position.set(-34, 22, -69);
      decorGroup.add(halo);
      stageDecor.push(halo);
    } else if (stageIdx === 2) {
      // underwater coral: giant glowing coral fans at the edges
      for (let i = 0; i < 10; i += 1) {
        const c = new THREE.Mesh(
          new THREE.ConeGeometry(1.6, 5 + rng() * 4, 6),
          new THREE.MeshStandardMaterial({ color: i % 2 ? 0xff3b8e : 0x5ef2ff, emissive: i % 2 ? 0xff3b8e : 0x5ef2ff, emissiveIntensity: 0.8, roughness: 0.4 }),
        );
        const a = (i / 10) * Math.PI * 2;
        c.position.set(Math.cos(a) * 29, 2.5, Math.sin(a) * 21);
        decorGroup.add(c);
        stageDecor.push(c);
      }
    } else if (stageIdx === 3) {
      // floating islands in a pink sunset sky
      for (let i = 0; i < 5; i += 1) {
        const isl = new THREE.Mesh(
          new THREE.ConeGeometry(3.5, 4, 6),
          new THREE.MeshStandardMaterial({ color: 0x7a5a9a, roughness: 0.9, flatShading: true }),
        );
        isl.position.set(-24 + i * 12, 26 + (i % 2) * 6, -34);
        isl.rotation.x = Math.PI;
        decorGroup.add(isl);
        stageDecor.push(isl);
        const top = new THREE.Mesh(
          new THREE.CylinderGeometry(3.2, 3.2, 0.8, 6),
          new THREE.MeshStandardMaterial({ color: 0x3a7a4a, roughness: 0.9 }),
        );
        top.position.set(isl.position.x, isl.position.y + 2.2, isl.position.z);
        decorGroup.add(top);
        stageDecor.push(top);
      }
    } else if (stageIdx === 4) {
      // caldera foundry: lava pools on the ground, misty giant behind
      // (the rider-facing-colossus backdrop image, Fix 8)
      for (let i = 0; i < 6; i += 1) {
        const lava = new THREE.Mesh(
          new THREE.CircleGeometry(2.5 + rng() * 2, 20),
          new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff4400, emissiveIntensity: 1.4, roughness: 0.4 }),
        );
        lava.rotation.x = -Math.PI / 2;
        lava.position.set(-24 + i * 9, 0.02, -20 + (i % 2) * 40);
        decorGroup.add(lava);
        stageDecor.push(lava);
      }
    } else {
      // floating castle citadel: castle towers flanking the vista
      for (const side of [-1, 1]) {
        const tower = new THREE.Mesh(
          new THREE.BoxGeometry(7, 26, 7),
          new THREE.MeshStandardMaterial({ color: 0x5a4a7a, roughness: 0.9, flatShading: true }),
        );
        tower.position.set(side * 30, 13, -46);
        decorGroup.add(tower);
        stageDecor.push(tower);
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(5.5, 8, 4),
          new THREE.MeshStandardMaterial({ color: 0xffc53d, roughness: 0.5, metalness: 0.4, flatShading: true }),
        );
        roof.position.set(side * 30, 30, -46);
        roof.rotation.y = Math.PI / 4;
        decorGroup.add(roof);
        stageDecor.push(roof);
      }
    }
  }

  function setStage(stageIdx, state) {
    setStageDecor(stageIdx);
    // pits
    for (const m of pitMeshes) scene.remove(m);
    pitMeshes.length = 0;
    for (const p of (state ? state.pits : [])) {
      const pit = new THREE.Mesh(
        new THREE.CircleGeometry(p.r, 28),
        new THREE.MeshBasicMaterial({ color: 0x050510 }),
      );
      pit.rotation.x = -Math.PI / 2;
      pit.position.set(p.x, 0.02, p.z);
      scene.add(pit);
      pitMeshes.push(pit);
      const rimM = new THREE.Mesh(
        new THREE.RingGeometry(p.r, p.r + 0.25, 28),
        new THREE.MeshBasicMaterial({ color: 0x8a5cff, transparent: true, opacity: 0.8 }),
      );
      rimM.rotation.x = -Math.PI / 2;
      rimM.position.set(p.x, 0.03, p.z);
      scene.add(rimM);
      pitMeshes.push(rimM);
    }
    // the stage-2 beam is a single sweeping ring (state.beam) rendered in
    // syncHazards, not a set of fixed rings — nothing to build here.
  }

  // ---- colossus meshes, keyed by id ----
  const colossusMeshes = new Map();
  function syncColossi(state) {
    const seen = new Set();
    for (const col of state.colossi) {
      seen.add(col.id);
      let g = colossusMeshes.get(col.id);
      if (!g) {
        g = buildColossus(state, col);
        colossusMeshes.set(col.id, g);
      }
      g.position.set(col.x, 0, col.z);
      const ud = g.userData;
      // marching bob + facing (march toward -z)
      const walk = col.state === 'march' ? Math.sin(col.walkPhase * 6) * 0.25 : 0;
      ud.body.position.y = walk;
      ud.body.rotation.z = col.state === 'march' ? Math.sin(col.walkPhase * 6) * 0.04 : 0;
      // topple: fall forward (rotate about the base, lying toward +z)
      const targetRot = col.state === 'toppled' ? -Math.PI / 2 : 0;
      ud.body.rotation.x += (targetRot - ud.body.rotation.x) * 0.25;
      // shattered: sink + shrink
      if (col.state === 'shattered') {
        g.scale.setScalar(Math.max(0.05, g.scale.x - 0.06));
        g.position.y -= 0.12;
      } else {
        g.scale.setScalar(1);
        g.position.y = 0;
      }
      // sigil: pulse, dim as hp falls
      const sigilFrac = col.sigilHp / col.sigilMax;
      ud.sigil.material.emissiveIntensity = 0.8 + sigilFrac * 1.2 + Math.sin(performance.now() / 300) * 0.3;
      ud.sigil.scale.setScalar(0.7 + sigilFrac * 0.5);
      // pins: colour by state
      for (const p of col.pins) {
        const mesh = ud.pinMeshes[p.id];
        if (!mesh) continue;
        mesh.material = p.state === 'chained' ? pinChainedMat : (p.state === 'free' ? pinMat : pinDoneMat);
        mesh.visible = p.state !== 'done';
      }
      // boss shield rotates with shieldAngle
      if (ud.shield) ud.shield.rotation.y = -col.shieldAngle;
    }
    for (const [id, g] of colossusMeshes) {
      if (!seen.has(id)) { scene.remove(g); colossusMeshes.delete(id); }
    }
  }

  function pinVisualPos(state, col, pinEnd) {
    const pin = col.pins.find((p) => p.id === pinEnd.pinId);
    if (!pin) return new THREE.Vector3(col.x, 2, col.z);
    const gp = pinGround(state, col, pin);
    return new THREE.Vector3(gp.x, gp.y, gp.z);
  }

  function chainEndPos(state, end) {
    if (end.type === 'pylon') return new THREE.Vector3(end.x, 4.6, end.z);
    if (end.type === 'altar') return new THREE.Vector3(end.x, 3.4, end.z);
    const col = state.colossi.find((c) => c.id === end.colossusId);
    if (!col) return new THREE.Vector3(0, 1, 0);
    return pinVisualPos(state, col, end);
  }

  function syncChains(state) {
    for (const m of chainMeshes) chainGroup.remove(m);
    chainMeshes.length = 0;
    const k = state.king;
    for (const ch of state.chains) {
      const a = chainEndPos(state, ch.a);
      const b = chainEndPos(state, ch.b);
      // slack: sag the middle down when not taut
      const sag = ch.state === 'taut' ? 0 : 1.2;
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      mid.y -= sag;
      const mat = ch.state === 'taut' ? chainTautMat : chainMat;
      chainMeshes.push(chainCylinder(a, mid, mat));
      chainMeshes.push(chainCylinder(mid, b, mat));
      for (const m of chainMeshes.slice(-2)) chainGroup.add(m);
      // a small golden link ball at each end
      for (const p of [a, b]) {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mat);
        ball.position.copy(p);
        chainGroup.add(ball);
        chainMeshes.push(ball);
      }
    }
    // the King's held chain (aim line) when aiming
    if (state.screen === 'play' && state.aim && state.aim.colossusId) {
      const col = state.colossi.find((c) => c.id === state.aim.colossusId);
      if (col) {
        const target = pinVisualPos(state, col, { pinId: state.aim.pinId });
        const hand = new THREE.Vector3(k.x, k.y + 1.3, k.z);
        const aimLine = chainCylinder(hand, target, new THREE.MeshBasicMaterial({ color: 0x5ef2ff, transparent: true, opacity: 0.5 }));
        chainGroup.add(aimLine);
        chainMeshes.push(aimLine);
      }
    }
    // Fix round 2 (C, DeepSeek Fix 1): cover-only hauling arc — a gold
    // chain visibly leaving the King's hand and arcing up to the
    // heart-sigil, the hero moment the cover was missing. This is a
    // staging decal, NOT a second taut limb-chain: the sim still holds
    // exactly one chain (HUD CHAINS 1/2), and two taut limb-chains IS the
    // topple, so no second limb-chain can exist while Aurelius stands.
    // The decal ends at the sigil (the slam target), not at a pin.
    // Drawn only while the colossus marches.
    if (camMode === 'cover') {
      const col = nearestColossus(state);
      if (col && col.state === 'march') {
        const g = colossusMeshes.get(col.id);
        if (g) {
          const sigilPos = new THREE.Vector3();
          g.userData.sigil.getWorldPosition(sigilPos);
          const [kx, kz] = stagedKingPos(state);
          const hand = new THREE.Vector3(kx, k.y + 1.3, kz);
          const mid = new THREE.Vector3().addVectors(hand, sigilPos).multiplyScalar(0.5);
          chainMeshes.push(chainCylinder(hand, mid, chainTautMat));
          chainMeshes.push(chainCylinder(mid, sigilPos, chainTautMat));
          for (const m of chainMeshes.slice(-2)) chainGroup.add(m);
          const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), chainTautMat);
          ball.position.copy(hand);
          chainGroup.add(ball);
          chainMeshes.push(ball);
        }
      }
    }
  }

  // ---- HUD ----
  const hud = {
    hp: document.getElementById('hud-hp'),
    hpBar: document.getElementById('hud-hpbar'),
    score: document.getElementById('hud-score'),
    stage: document.getElementById('hud-stage'),
    timer: document.getElementById('hud-timer'),
    chains: document.getElementById('hud-chains'),
    relics: document.getElementById('hud-relics'),
    msg: document.getElementById('hud-msg'),
    combo: document.getElementById('hud-combo'),
  };
  function updateHud(state) {
    if (!hud.hp) return;
    const k = state.king;
    hud.hp.textContent = 'HP ' + Math.max(0, Math.ceil(k.hp));
    hud.hpBar.style.width = Math.max(0, k.hp) + '%';
    hud.hpBar.style.background = k.hp > 50 ? '#5ef2a0' : (k.hp > 25 ? '#ffc53d' : '#ff4040');
    hud.score.textContent = 'SCORE ' + state.score.toLocaleString('en-US');
    const stage = STAGES[state.stageIdx];
    hud.stage.textContent = 'STAGE ' + (state.stageIdx + 1) + '/6 — ' + stage.name.toUpperCase();
    hud.timer.textContent = 'SIEGE ' + Math.max(0, Math.ceil(state.siege)) + 's';
    hud.timer.style.color = state.siege < 15 ? '#ff4040' : '#fff5e0';
    const maxC = maxChains(state);
    hud.chains.textContent = 'CHAINS ' + state.chains.length + '/' + maxC;
    hud.relics.textContent = state.relics.length ? 'RELICS: ' + state.relics.map((r) => r.name.toUpperCase()).join(' · ') : '';
    hud.msg.textContent = state.lastEvent || '';
    hud.combo.textContent = state.combos > 0 ? 'COMBOS ' + state.combos : '';
  }

  // ---- camera ----
  // Staged shots snap straight to their framing (the lerp would still be
  // converging when the screenshot is taken a few frames later).
  let camMode = 'follow';
  let camPos = new THREE.Vector3(0, 18, 34);
  let camLook = new THREE.Vector3(0, 2, -6);

  function nearestColossus(state) {
    let best = null;
    let bestD = 1e9;
    for (const col of state.colossi) {
      const d = Math.hypot(col.x - state.king.x, col.z - state.king.z);
      if (d < bestD) { bestD = d; best = col; }
    }
    return best;
  }

  // Staged cameras sit on the WORLD +z side of the action (camera z =
  // King z + back) and look toward -z, so the distant backdrop vista is
  // always behind the subject. (First passes placed the camera relative
  // to the King->colossus axis; when the King vaulted past the colossus
  // the camera flipped to the -z side and looked away from the backdrop —
  // the play frame showed sky only, no nebula.)
  // Over-the-shoulder hero framing. The King stands at the colossus's
  // feet, so a close camera (9-19m) makes Aurelius overflow the frame and
  // read as abstract dark pillars — his head out of shot, his torso a
  // wall. This pass pulls back to 26m at height 7, level on the colossus's
  // mid-height (look y 7): Aurelius fits whole (feet to crown, ~58% of
  // frame height, a readable towering character, ref12) and the King reads
  // at ~12-17% in the lower foreground, crown and red robe clear against
  // the dark stone. The look is shifted +2.5 in x so the King sits in the
  // left third.
  // Fix round 2 (C): in cover mode the King is staged in front of the
  // colossus's legs, centred under the heart-sigil (x = colossus.x,
  // z = colossus.z + 2), instead of standing between the legs where the
  // legs occlude him. Returns [kx, kz]. ("Back to camera" is not
  // achievable: the King is a billboard sprite, it always faces the camera
  // — his front, crown + robe readable, is what the frame shows.)
  function stagedKingPos(state) {
    if (camMode !== 'cover') return [state.king.x, state.king.z];
    const col = nearestColossus(state);
    if (!col) return [state.king.x, state.king.z];
    return [col.x, col.z + 2];
  }

  // Fix round 2 (D): the 17% experiment switch (GLM Fix 1). 'standard' is
  // the default framing; '17' is the closer camera + bigger sprite, run
  // only with ?shot=cover&cover17=1. Set via setCoverVariant().
  let coverVariant = 'standard';

  function coverTarget(state) {
    const k = state.king;
    const col = nearestColossus(state);
    if (!col) return { pos: new THREE.Vector3(-12, 13, 22), look: new THREE.Vector3(0, 3, 6) };
    if (coverVariant === '17') {
      return {
        pos: new THREE.Vector3(k.x + 4, k.y + 5, k.z + 20),
        look: new THREE.Vector3((k.x + col.x) / 2, 5, (k.z + col.z) / 2),
      };
    }
    const pos = new THREE.Vector3(k.x + 6, k.y + 7, k.z + 26);
    const look = new THREE.Vector3(col.x + 2.5, 7, col.z);
    return { pos, look };
  }

  // Vault-slam framing: the King mid-leap against the fallen giant, the
  // fallen body stretching behind him, nebula sky above. First passes
  // caught the vault apex (King 12m up, a dot in empty sky); this one
  // catches the vault early (vaultT 0.35-0.45, King ~6m) from 13m back,
  // so King, fallen giant and sigil share the frame.
  function playshotTarget(state) {
    const k = state.king;
    const col = nearestColossus(state);
    if (!col) return { pos: new THREE.Vector3(k.x + 7, 3, k.z + 10), look: new THREE.Vector3(k.x, k.y + 2, k.z - 4) };
    const pos = new THREE.Vector3(k.x + 6, 3, k.z + 13);
    const look = new THREE.Vector3((k.x + col.x) / 2, 4, (k.z + col.z) / 2);
    return { pos, look };
  }

  // Victory framing: the King in the lower foreground, the shattered
  // colossus looming behind him, altar in the distance. The King sits in
  // the left third (side +7) so the centred PLAY AGAIN button never
  // covers him — the first pass centred him behind the button.
  function victoryTarget(state) {
    const k = state.king;
    const col = nearestColossus(state);
    if (!col) return { pos: new THREE.Vector3(k.x + 6, 4, k.z + 12), look: new THREE.Vector3(k.x, 2, k.z - 4) };
    const pos = new THREE.Vector3(k.x + 7, k.y + 4, k.z + 10);
    const look = new THREE.Vector3((k.x + col.x) / 2 + 3, 2.5, (k.z + col.z) / 2);
    return { pos, look };
  }

  function updateCamera(state, dt) {
    if (camMode === 'cover') {
      const t = coverTarget(state);
      camPos.lerp(t.pos, 0.35);
      camLook.lerp(t.look, 0.35);
    } else if (camMode === 'playshot') {
      const t = playshotTarget(state);
      camPos.lerp(t.pos, 0.35);
      camLook.lerp(t.look, 0.35);
    } else if (camMode === 'victory') {
      const t = victoryTarget(state);
      camPos.lerp(t.pos, 0.35);
      camLook.lerp(t.look, 0.35);
    } else if (camMode === 'title') {
      camPos.lerp(new THREE.Vector3(0, 18, 34), 0.05);
      camLook.lerp(new THREE.Vector3(0, 2, -6), 0.05);
    } else {
      const k = state.king;
      const tx = k.x * 0.55;
      const tz = k.z * 0.55 + 19;
      const ty = 14 + k.y * 0.4;
      camPos.lerp(new THREE.Vector3(tx, ty, tz), 1 - Math.pow(0.001, dt));
      camLook.lerp(new THREE.Vector3(k.x * 0.85, 2 + k.y * 0.5, k.z * 0.85 - 4), 1 - Math.pow(0.001, dt));
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  function update(state, dt, input) {
    // pointer -> ground plane (for aiming)
    if (input && input.pointer) {
      const rect = canvas.getBoundingClientRect();
      const nx = ((input.mouse.x / rect.width) * 2 - 1);
      const ny = (-(input.mouse.y / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(plane, hit)) {
        input.pointer.groundX = hit.x;
        input.pointer.groundZ = hit.z;
        input.pointer.inside = true;
      } else {
        input.pointer.inside = false;
      }
    }
    // King sprite — scaled up in cover mode so he reads ~10-12% of frame
    // height (he was ~8% in the old cover); normal size everywhere else.
    // Fix round 2 (C): in cover mode he is staged in front of the legs,
    // centred under the sigil (stagedKingPos), not between the legs.
    // Fix round 2 (D): the 17% experiment uses 8.4x6.3 in cover mode.
    const k = state.king;
    const [kx, kz] = stagedKingPos(state);
    if (camMode === 'cover') kingSprite.scale.set(coverVariant === '17' ? 8.4 : 5.6, coverVariant === '17' ? 6.3 : 4.2, 1);
    else kingSprite.scale.set(2.4, 1.8, 1);
    kingSprite.position.set(kx, k.y + 0.78, kz);
    const inv = k.invuln > 0 && Math.floor(performance.now() / 120) % 2 === 0;
    kingSprite.material.opacity = inv ? 0.4 : 1;
    kingShadow.position.set(kx, 0.02, kz);
    kingShadow.scale.setScalar(Math.max(0.4, 1 - k.y * 0.03));
    kingGlow.position.set(kx, k.y + 2, kz);
    // Fix round 2 (C, Qwen Fix 3): crown glow pops in cover mode only
    // (intensity 20, distance 16; 12/12 elsewhere).
    if (camMode === 'cover') { kingGlow.intensity = 20; kingGlow.distance = 16; }
    else { kingGlow.intensity = 12; kingGlow.distance = 12; }
    // Fix round 2 (C): gold halo behind the King, cover mode only.
    kingHalo.visible = camMode === 'cover';
    if (camMode === 'cover') kingHalo.position.set(kx, k.y + 2.1, kz - 0.3);
    // Fix round 2 (A): kingLight follows the staged King; the warm fill
    // is full-strength in the staged cover/play frames and gentle
    // elsewhere (the title frame keeps its cave mood); the brazier light
    // parks at the brazier nearest the King in cover mode only, and the
    // brazier flames burn 40% hotter in the cover shot only (DeepSeek).
    kingLight.position.set(kx + 1.5, k.y + 3.0, kz + 2.0);
    fill.intensity = (camMode === 'cover' || camMode === 'playshot') ? 0.55 : 0.25;
    if (camMode === 'cover' && brazierPositions.length) {
      let best = null; let bd = Infinity;
      for (const [bx, bz] of brazierPositions) {
        const d = (bx - kx) * (bx - kx) + (bz - kz) * (bz - kz);
        if (d < bd) { bd = d; best = [bx, bz]; }
      }
      brazierLight.position.set(best[0], 1.6, best[1]);
      brazierLight.intensity = 2.5;
      for (const m of brazierFlameMats) m.emissiveIntensity = 3.1;
    } else {
      brazierLight.intensity = 0;
      for (const m of brazierFlameMats) m.emissiveIntensity = 2.2;
    }
    // Fix round 2 (B): a staged mesh whose texture entry was replaced by
    // the feathered CanvasTexture after the mesh was built gets the new
    // map; and in staged modes the backdrop plane faces the staged camera
    // (lookAt) so its edges fall outside the frustum. Live play keeps the
    // fixed plane — a billboard vista would look wrong under a moving
    // follow camera.
    if (backdropMesh && backdropStageIdx >= 0) {
      const tex = backdropTex[backdropStageIdx];
      if (tex && backdropMesh.material.map !== tex) {
        backdropMesh.material.map = tex;
        backdropMesh.material.needsUpdate = true;
      }
      if (camMode === 'cover' || camMode === 'playshot' || camMode === 'victory' || camMode === 'title') {
        backdropMesh.lookAt(camera.position.x, backdropMesh.position.y, camera.position.z);
      }
    }
    // Fix round 2 (D): measurement aid — the King's projected frame height
    // in cover mode, so the 10-12% vs 17% experiment is a number, not an
    // eye. FOV 50 deg vertical, viewport 720px.
    if (camMode === 'cover') {
      const dist = camera.position.distanceTo(kingSprite.position);
      const hPx = kingSprite.scale.y * 360 / (Math.tan(THREE.MathUtils.degToRad(25)) * dist);
      window.__kingFramePct = (hPx / 720) * 100;
    }
    // altar gem pulse
    altarGem.rotation.y += dt * 2;
    altarGem.position.y = 3.6 + Math.sin(performance.now() / 500) * 0.15;
    breach.material.opacity = 0.5 + Math.sin(performance.now() / 300) * 0.25;
    syncColossi(state);
    syncChains(state);
    syncHazards(state, dt);
    updateHud(state);
    updateCamera(state, dt);
    renderer.render(scene, camera);
  }

  return {
    update,
    setStage,
    setCoverVariant(v) { coverVariant = v; },
    backdropsReady() { return texLoaded >= texTotal; },
    setCamMode(m, state) {
      camMode = m;
      // Staged shots snap straight to their framing.
      if (state) {
        if (m === 'cover') {
          const t = coverTarget(state);
          camPos.copy(t.pos);
          camLook.copy(t.look);
        } else if (m === 'playshot') {
          const t = playshotTarget(state);
          camPos.copy(t.pos);
          camLook.copy(t.look);
        } else if (m === 'victory') {
          const t = victoryTarget(state);
          camPos.copy(t.pos);
          camLook.copy(t.look);
        } else if (m === 'title') {
          camPos.set(0, 18, 34);
          camLook.set(0, 2, -6);
        }
      } else if (m === 'title') {
        camPos.set(0, 18, 34);
        camLook.set(0, 2, -6);
      }
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
  };
}
