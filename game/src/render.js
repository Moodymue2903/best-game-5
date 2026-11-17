// CROWNBOUND — renderer. Three.js (vendored ESM). Fixed follow camera,
// procedural stone colossi, the v4 Ape King cutout as a billboard sprite
// (NEVER redrawn in code), gold chains, telegraphed hazards, per-stage
// backdrops from the user's five reference images + a foundry.
import * as THREE from '../vendor/three.module.min.js';
import { CROWNBOUND_STAGES as STAGES, ARENA_HALF_X, ARENA_HALF_Z } from './config.js';
import { pinGround, maxChains } from './sim.js';

function hex(c) { return new THREE.Color(c); }

export function createRenderer(canvas, kingTextureUrl) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(1280, 720, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = hex('#10255e');
  scene.fog = new THREE.Fog(hex('#10255e'), 55, 110);

  const camera = new THREE.PerspectiveCamera(50, 1280 / 720, 0.1, 300);
  camera.position.set(0, 18, 34);
  camera.lookAt(0, 2, -6);

  // ---- lights ----
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xfff2cc, 1.0);
  key.position.set(18, 30, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -32; key.shadow.camera.right = 32;
  key.shadow.camera.top = 24; key.shadow.camera.bottom = -24;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5ef2ff, 0.35);
  rim.position.set(-20, 12, -18);
  scene.add(rim);

  // ---- ground ----
  const groundCanvas = document.createElement('canvas');
  groundCanvas.width = 512; groundCanvas.height = 512;
  const gc = groundCanvas.getContext('2d');
  const grad = gc.createRadialGradient(256, 256, 40, 256, 256, 360);
  grad.addColorStop(0, '#2a3f7a');
  grad.addColorStop(0.6, '#1c2f63');
  grad.addColorStop(1, '#10255e');
  gc.fillStyle = grad;
  gc.fillRect(0, 0, 512, 512);
  gc.strokeStyle = 'rgba(255,197,61,0.35)';
  gc.lineWidth = 3;
  for (let i = 0; i <= 8; i += 1) {
    gc.beginPath(); gc.moveTo((i * 512) / 8, 0); gc.lineTo((i * 512) / 8, 512); gc.stroke();
    gc.beginPath(); gc.moveTo(0, (i * 512) / 8); gc.lineTo(512, (i * 512) / 8); gc.stroke();
  }
  gc.strokeStyle = 'rgba(255,197,61,0.6)';
  gc.lineWidth = 6;
  gc.strokeRect(6, 6, 500, 500);
  const groundTex = new THREE.CanvasTexture(groundCanvas);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF_X * 2 + 8, ARENA_HALF_Z * 2 + 8),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.9, metalness: 0.05 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

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
  const kingTex = new THREE.TextureLoader().load(kingTextureUrl);
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

  // ---- colossus factory ----
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6b6f7d, roughness: 0.85, metalness: 0.15 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a3d4a, roughness: 0.9, metalness: 0.1 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3b8e, emissive: 0xff3b8e, emissiveIntensity: 2.0 });
  const sigilMat = new THREE.MeshStandardMaterial({ color: 0xffc53d, emissive: 0xffc53d, emissiveIntensity: 1.6, roughness: 0.3 });
  const pinMat = new THREE.MeshStandardMaterial({ color: 0x5ef2ff, emissive: 0x5ef2ff, emissiveIntensity: 1.8, roughness: 0.2 });
  const pinChainedMat = new THREE.MeshStandardMaterial({ color: 0xffc53d, emissive: 0xffc53d, emissiveIntensity: 1.8, roughness: 0.2 });
  const pinDoneMat = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0x222222, roughness: 0.6 });

  function buildColossus(state, col) {
    const size = col.size;
    const s = size / 14; // scale relative to the standard colossus
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    // legs
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * s, 0.7 * s, 3.2 * s, 8), darkMat);
      leg.position.set(side * 1.1 * s, 1.6 * s, 0);
      leg.castShadow = true;
      body.add(leg);
    }
    // torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(4.4 * s, 5.2 * s, 2.6 * s), stoneMat);
    torso.position.set(0, 5.8 * s, 0);
    torso.castShadow = true;
    body.add(torso);
    // shoulders / arms
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.6 * s, 4.6 * s, 8), stoneMat);
      arm.position.set(side * 2.6 * s, 5.6 * s, 0);
      arm.castShadow = true;
      body.add(arm);
      const fist = new THREE.Mesh(new THREE.BoxGeometry(1.1 * s, 1.1 * s, 1.1 * s), darkMat);
      fist.position.set(side * 2.6 * s, 3.0 * s, 0);
      body.add(fist);
    }
    // head
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.0 * s, 1.8 * s, 1.8 * s), darkMat);
    head.position.set(0, 9.4 * s, 0);
    head.castShadow = true;
    body.add(head);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 10, 10), eyeMat);
      eye.position.set(side * 0.5 * s, 9.5 * s, 0.95 * s);
      body.add(eye);
    }
    if (col.boss) {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.3 * s, 1.5 * s, 0.9 * s, 8), goldMat);
      crown.position.set(0, 10.7 * s, 0);
      body.add(crown);
    }
    // heart-sigil on the chest
    const sigil = new THREE.Mesh(new THREE.OctahedronGeometry(0.85 * s), sigilMat);
    sigil.position.set(0, 6.2 * s, 1.4 * s);
    body.add(sigil);
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

  // ---- stage backdrops ----
  let stageDecor = [];
  function setStageDecor(stageIdx) {
    for (const m of stageDecor) { decorGroup.remove(m); }
    stageDecor = [];
    const stage = STAGES[stageIdx];
    // sky is a 4-colour palette [dark, mid, accent1, accent2]; the scene
    // background + fog take the dark end.
    scene.background = hex(stage.sky[0]);
    scene.fog.color = hex(stage.sky[0]);
    ambient.color = hex(stage.sky[1]);
    if (stageIdx === 0) {
      // crystal cave: glowing crystal clusters at the arena edges
      for (let i = 0; i < 14; i += 1) {
        const h = 2 + Math.random() * 4;
        const c = new THREE.Mesh(
          new THREE.ConeGeometry(0.8 + Math.random() * 0.7, h, 5),
          new THREE.MeshStandardMaterial({ color: 0x5ef2ff, emissive: 0x5ef2ff, emissiveIntensity: 0.9, roughness: 0.2 }),
        );
        const a = (i / 14) * Math.PI * 2;
        c.position.set(Math.cos(a) * 30, h / 2, Math.sin(a) * 22);
        c.rotation.z = (Math.random() - 0.5) * 0.4;
        decorGroup.add(c);
        stageDecor.push(c);
      }
    } else if (stageIdx === 1) {
      // nebula: a ringed planet high in the sky + stars
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(9, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0x8a5cff, emissive: 0x4a2a8a, emissiveIntensity: 0.6, roughness: 0.7 }),
      );
      planet.position.set(-28, 34, -42);
      decorGroup.add(planet);
      stageDecor.push(planet);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(12, 16, 48),
        new THREE.MeshBasicMaterial({ color: 0xffc53d, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
      );
      ring.position.copy(planet.position);
      ring.rotation.x = Math.PI / 2.4;
      decorGroup.add(ring);
      stageDecor.push(ring);
    } else if (stageIdx === 2) {
      // underwater coral: giant glowing coral fans at the edges
      for (let i = 0; i < 10; i += 1) {
        const c = new THREE.Mesh(
          new THREE.ConeGeometry(1.6, 5 + Math.random() * 4, 6),
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
          new THREE.MeshStandardMaterial({ color: 0x7a5a9a, roughness: 0.9 }),
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
      // the giant in the mist: a colossal dark silhouette far behind the altar
      const giant = new THREE.Mesh(
        new THREE.BoxGeometry(16, 46, 10),
        new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 1, transparent: true, opacity: 0.75 }),
      );
      giant.position.set(14, 23, -52);
      decorGroup.add(giant);
      stageDecor.push(giant);
      const gHead = new THREE.Mesh(
        new THREE.BoxGeometry(7, 6, 7),
        new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 1, transparent: true, opacity: 0.75 }),
      );
      gHead.position.set(14, 48, -52);
      decorGroup.add(gHead);
      stageDecor.push(gHead);
    } else {
      // foundry: lava pools + ember glow
      for (let i = 0; i < 6; i += 1) {
        const lava = new THREE.Mesh(
          new THREE.CircleGeometry(2.5 + Math.random() * 2, 20),
          new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff4400, emissiveIntensity: 1.4, roughness: 0.4 }),
        );
        lava.rotation.x = -Math.PI / 2;
        lava.position.set(-24 + i * 9, 0.02, -20 + (i % 2) * 40);
        decorGroup.add(lava);
        stageDecor.push(lava);
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
  let camMode = 'follow';
  let camPos = new THREE.Vector3(0, 18, 34);
  let camLook = new THREE.Vector3(0, 2, -6);
  function updateCamera(state, dt) {
    if (camMode === 'cover') {
      camPos.lerp(new THREE.Vector3(-12, 13, 22), 0.08);
      camLook.lerp(new THREE.Vector3(0, 3, 6), 0.08);
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
    // King sprite
    const k = state.king;
    kingSprite.position.set(k.x, k.y + 0.78, k.z);
    const inv = k.invuln > 0 && Math.floor(performance.now() / 120) % 2 === 0;
    kingSprite.material.opacity = inv ? 0.4 : 1;
    kingShadow.position.set(k.x, 0.02, k.z);
    kingShadow.scale.setScalar(Math.max(0.4, 1 - k.y * 0.03));
    kingGlow.position.set(k.x, k.y + 2, k.z);
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
    setCamMode(m) {
      camMode = m;
      // Staged shots snap straight to their framing (the lerp would still
      // be converging when the screenshot is taken a few frames later).
      if (m === 'cover') {
        camPos.set(-12, 13, 22);
        camLook.set(0, 3, 6);
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
