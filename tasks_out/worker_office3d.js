import * as THREE from './three.module.min.js';

let active = null;

function disposeActive() {
  if (!active) return;
  const a = active;
  active = null;
  a.cleanup();
}

export function dispose3d() {
  disposeActive();
}

function normalizeBoard(data) {
  if (data && Array.isArray(data.workers)) return data.workers;
  return [{
    name: (data && data.window && data.window.model) || 'missingno',
    model: data && data.window ? data.window.model : undefined,
    window: data ? data.window : undefined,
    tasks: data && Array.isArray(data.tasks) ? data.tasks : [],
    recent_ticks: data && Array.isArray(data.recent_ticks) ? data.recent_ticks : []
  }];
}

function taskTitle(t) {
  if (typeof t === 'string') return t;
  if (!t) return '';
  return String(t.title || t.name || t.label || '');
}

function taskStatus(t) {
  if (typeof t === 'string') return '';
  if (!t) return '';
  return String(t.status || t.state || t.result || '');
}

function isTaskDone(t) {
  if (typeof t === 'string') return false;
  if (!t) return false;
  const s = taskStatus(t).toLowerCase();
  if (t.done === true) return true;
  return s === 'done' || s === 'completed' || s === 'complete' || s === 'finished';
}

function isTaskFailed(t) {
  const s = taskStatus(t).toLowerCase();
  return s === 'failed' || s === 'cancelled' || s === 'canceled' || s === 'error';
}

function workerName(w, i) {
  return String((w && (w.name || w.id || w.model)) || ('worker-' + i));
}

function workerDone(w) {
  const tasks = (w && Array.isArray(w.tasks)) ? w.tasks : [];
  if (!tasks.length) return false;
  return tasks.every(isTaskDone);
}

export function init3d(container, apiBase) {
  if (active) dispose3d();

  const app = {
    container,
    apiBase: apiBase || '',
    disposed: false,
    raf: 0,
    pollTimer: 0,
    resizeObs: null,
    onResize: null,
    reducedMotion: false
  };
  active = app;

  app.reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080818);
  scene.fog = new THREE.Fog(0x080818, 20, 90);
  app.scene = scene;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  app.renderer = renderer;

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 960;
    const h = container.clientHeight || window.innerHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  app.onResize = resize;
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) {
    app.resizeObs = new ResizeObserver(resize);
    app.resizeObs.observe(container);
  }

  // sky sphere
  const skyGeo = new THREE.SphereGeometry(60, 32, 16);
  const skyPos = skyGeo.attributes.position;
  const skyCol = new Float32Array(skyPos.count * 3);
  for (let i = 0; i < skyPos.count; i++) {
    const y = skyPos.getY(i) / 60;
    const t = (y + 1) * 0.5;
    skyCol[i * 3] = 0.03 + 0.08 * t;
    skyCol[i * 3 + 1] = 0.03 + 0.07 * t;
    skyCol[i * 3 + 2] = 0.12 + 0.35 * t;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCol, 3));
  const skyMesh = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true, fog: false }));
  scene.add(skyMesh);

  // stars
  const starCount = 300;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const az = Math.random() * Math.PI * 2;
    const el = Math.random() * (Math.PI * 0.5);
    const r = 32 + Math.random() * 22;
    starPos[i * 3] = r * Math.cos(el) * Math.cos(az);
    starPos[i * 3 + 1] = r * Math.sin(el);
    starPos[i * 3 + 2] = r * Math.cos(el) * Math.sin(az);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.45, sizeAttenuation: true })));

  // moon
  const moon = new THREE.Mesh(new THREE.SphereGeometry(2, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0xcfd8e3, emissive: 0xcfd8e3, emissiveIntensity: 1.0, roughness: 0.2 }));
  moon.position.set(18, 32, -24);
  scene.add(moon);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(13, 14, 13);
  camera.lookAt(0, 0, 0);
  const camRadius = Math.hypot(camera.position.x, camera.position.z);
  let camAngle = Math.atan2(camera.position.z, camera.position.x);
  app.camera = camera;

  // lighting
  scene.add(new THREE.AmbientLight(0x334466, 0.5));
  const moonLight = new THREE.DirectionalLight(0xcfd8ff, 0.85);
  moonLight.position.set(20, 40, 10);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  moonLight.shadow.camera.left = -22;
  moonLight.shadow.camera.right = 22;
  moonLight.shadow.camera.top = 22;
  moonLight.shadow.camera.bottom = -22;
  moonLight.shadow.camera.near = 0.5;
  moonLight.shadow.camera.far = 100;
  scene.add(moonLight);

  // materials
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x3fa45a, roughness: 0.9 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x2a2a33, flatShading: true, roughness: 1.0 });
  const torchMat = new THREE.MeshStandardMaterial({ color: 0xff9933, emissive: 0xff6611, emissiveIntensity: 0.6 });
  const emberMat = new THREE.PointsMaterial({ color: 0xff7733, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.7 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.8 });
  const hutMat = new THREE.MeshStandardMaterial({ color: 0x6b4f32, roughness: 0.85 });
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x000000, emissiveIntensity: 0 });
  const campStoneMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.95 });

  const islandGroup = new THREE.Group();
  scene.add(islandGroup);

  // floor tiles (max 20x20)
  const MAXN = 20;
  const tileCount = MAXN * MAXN;
  const tileGeo = new THREE.BoxGeometry(1, 0.15, 1);
  const tileMesh = new THREE.InstancedMesh(tileGeo, woodMat, tileCount);
  tileMesh.castShadow = false;
  tileMesh.receiveShadow = true;
  islandGroup.add(tileMesh);

  const dummy = new THREE.Object3D();

  let totalDone = 0;
  let torchCorners = [];
  const torchCones = [];
  const torchLights = [];
  const torchGroup = new THREE.Group();
  islandGroup.add(torchGroup);

  const grassGeo = new THREE.BoxGeometry(1, 0.12, 1);
  const grassMeshes = [];

  const undersideRadius = 1;
  const undersideGeo = new THREE.ConeGeometry(undersideRadius, 6, 12, 4);
  const up = undersideGeo.attributes.position;
  for (let i = 0; i < up.count; i++) {
    up.setX(i, up.getX(i) + (Math.random() - 0.5) * 0.25 * up.getX(i));
    up.setZ(i, up.getZ(i) + (Math.random() - 0.5) * 0.25 * up.getZ(i));
    up.setY(i, up.getY(i) + (Math.random() - 0.5) * 0.4);
  }
  undersideGeo.computeVertexNormals();
  const undersideMesh = new THREE.Mesh(undersideGeo, rockMat);
  undersideMesh.rotation.x = Math.PI;
  undersideMesh.position.y = -1.4;
  islandGroup.add(undersideMesh);

  // bobbing rocks
  const rocks = [];
  for (let i = 0; i < 3; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), rockMat);
    const a = (i / 3) * Math.PI * 2;
    rock.position.set(Math.cos(a) * 2.6, -3.2, Math.sin(a) * 2.6);
    rock.userData.baseY = rock.position.y;
    islandGroup.add(rock);
    rocks.push(rock);
  }

  // torches
  const torchConeGeo = new THREE.ConeGeometry(0.12, 0.4, 8);
  for (let i = 0; i < 4; i++) {
    const cone = new THREE.Mesh(torchConeGeo, torchMat);
    cone.castShadow = true;
    torchGroup.add(cone);
    torchCones.push(cone);
    const light = new THREE.PointLight(0xff9933, 1.9, 8);
    torchGroup.add(light);
    torchLights.push(light);
  }

  // campfire
  const campfireGroup = new THREE.Group();
  islandGroup.add(campfireGroup);
  const stoneGeo = new THREE.BoxGeometry(0.22, 0.12, 0.22);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(stoneGeo, campStoneMat);
    stone.position.set(Math.cos(a) * 0.75, 0.06, Math.sin(a) * 0.75);
    stone.rotation.y = a;
    campfireGroup.add(stone);
  }
  const flameGeo = new THREE.BoxGeometry(0.28, 0.5, 0.28);
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff4a0a, emissiveIntensity: 2.0 });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.y = 0.32;
  campfireGroup.add(flame);

  // huts
  const hutGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  const winGeo = new THREE.PlaneGeometry(0.34, 0.24);
  const huts = [];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const radius = 4.2;
    const hut = new THREE.Mesh(hutGeo, hutMat);
    hut.position.set(Math.cos(angle) * radius, 0.4, Math.sin(angle) * radius);
    hut.rotation.y = angle + Math.PI;
    hut.castShadow = true;
    hut.receiveShadow = true;
    islandGroup.add(hut);
    const wplane = new THREE.Mesh(winGeo, windowMat.clone());
    wplane.position.set(0, 0.1, 0.41);
    hut.add(wplane);
    huts.push({ mesh: hut, windowMat: wplane.material, project: i + 1 });
  }

  // embers
  const particlesPerTorch = 20;
  const emberCount = particlesPerTorch * 4;
  const emberPos = new Float32Array(emberCount * 3);
  const emberTorch = new Uint8Array(emberCount);
  const emberVel = new Float32Array(emberCount);
  for (let i = 0; i < emberCount; i++) {
    emberTorch[i] = Math.floor(i / particlesPerTorch);
    emberVel[i] = 0.35 + Math.random() * 0.45;
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(emberGeo, emberMat);
  scene.add(embers);

  function resetEmber(i) {
    const t = torchCorners[emberTorch[i]];
    if (!t) return;
    const o = i * 3;
    emberPos[o] = t.x + (Math.random() - 0.5) * 0.4;
    emberPos[o + 1] = 0.18 + Math.random() * 0.25;
    emberPos[o + 2] = t.z + (Math.random() - 0.5) * 0.4;
  }
  for (let i = 0; i < emberCount; i++) resetEmber(i);

  function applyGrowth() {
    const steps = Math.min(8, Math.floor(totalDone / 2));
    const n = 4 + steps * 2;
    let idx = 0;
    for (let x = 0; x < n; x++) {
      for (let z = 0; z < n; z++) {
        dummy.position.set(x - (n - 1) / 2, 0, z - (n - 1) / 2);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        tileMesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    for (; idx < tileCount; idx++) {
      dummy.position.set(0, -999, 0);
      dummy.scale.set(0.0001, 0.0001, 0.0001);
      dummy.updateMatrix();
      tileMesh.setMatrixAt(idx, dummy.matrix);
    }
    tileMesh.instanceMatrix.needsUpdate = true;

    const c = n / 2 + 0.45;
    const corners = [[-c, 0, -c], [c, 0, -c], [c, 0, c], [-c, 0, c]];
    torchCorners = corners.map((cc) => new THREE.Vector3(cc[0], 0, cc[2]));
    torchCorners.forEach((tc, i) => {
      torchCones[i].position.copy(tc);
      torchCones[i].position.y = 0.2;
      torchLights[i].position.copy(tc);
      torchLights[i].position.y = 0.7;
    });

    // grass ring
    grassMeshes.forEach((m) => islandGroup.remove(m));
    grassMeshes.length = 0;
    const half = n / 2 + 0.55;
    const len = n + 1.4;
    const mkGrass = (x, z, ry) => {
      const m = new THREE.Mesh(grassGeo, grassMat);
      m.position.set(x, 0.06, z);
      m.rotation.y = ry;
      m.scale.set(len, 1, 0.32);
      islandGroup.add(m);
      grassMeshes.push(m);
    };
    mkGrass(0, -(half + 0.15), 0);
    mkGrass(0, half + 0.15, 0);
    mkGrass(-(half + 0.15), 0, Math.PI / 2);
    mkGrass(half + 0.15, 0, Math.PI / 2);

    const span = (n / 2) * 1.45 + 1.4;
    undersideMesh.scale.x = span;
    undersideMesh.scale.z = span;
  }

  const avatars = new Map();
  const campSlots = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    campSlots.push(new THREE.Vector3(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8));
  }

  function createNameTexture(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(name).slice(0, 18), 64, 16);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  function createAvatar(w, index, name) {
    const group = new THREE.Group();
    const bodyColor = (index % 2 === 0) ? 0xd4af37 : 0x8b5cf6;
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.65 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffddbb, roughness: 0.7 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), legMat);
    legs.position.y = 0.25;
    legs.castShadow = true;
    group.add(legs);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.4), bodyMat);
    body.position.y = 0.8;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), headMat);
    head.position.y = 1.3;
    head.castShadow = true;
    group.add(head);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35),
      new THREE.MeshBasicMaterial({ map: createNameTexture(name), transparent: true, depthWrite: false }));
    plate.position.y = 1.85;
    group.add(plate);
    // sprite-ish billboard
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: (new THREE.CanvasTexture((() => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 32;
      const cx = c.getContext('2d'); cx.font = '10px monospace'; cx.textAlign = 'center';
      cx.textBaseline = 'middle'; cx.fillStyle = '#ffffff'; cx.fillText(String(name).slice(0, 18), 64, 16);
      return c;
    })())), transparent: true }));
    sprite.scale.set(1.5, 0.375, 1);
    sprite.position.y = 1.85;
    group.add(sprite);
    // remove plane to keep simple? keep both small cost; remove duplicate? keep sprite only? 
    group.remove(plate);
    scene.add(group);
    return {
      name,
      group,
      index,
      done: false,
      tasks: (w && w.tasks) || [],
      targetIndex: Math.floor(Math.random() * 4),
      slotIndex: 0,
      phase: Math.random() * 6
    };
  }

  function updateWorkers(workers) {
    const names = new Set(workers.map((w, i) => workerName(w, i)));
    for (const [nm, av] of [...avatars.entries()]) {
      if (!names.has(nm)) {
        scene.remove(av.group);
        avatars.delete(nm);
      }
    }
    workers.forEach((w, i) => {
      const name = workerName(w, i);
      let av = avatars.get(name);
      if (!av) {
        av = createAvatar(w, i, name);
        avatars.set(name, av);
      }
      av.tasks = (w && Array.isArray(w.tasks)) ? w.tasks : [];
      av.done = workerDone(w);
    });
    let slot = 0;
    for (const av of avatars.values()) {
      if (av.done) {
        av.slotIndex = Math.min(slot, campSlots.length - 1);
        slot++;
      }
    }
  }

  function updateProjects(workers) {
    const projectSet = new Set();
    workers.forEach((w) => {
      const tasks = (w && Array.isArray(w.tasks)) ? w.tasks : [];
      tasks.forEach((t) => {
        const title = taskTitle(t);
        const m = title.match(/^\s*P(\d)\s*:/i);
        if (!m) return;
        if (isTaskDone(t) || isTaskFailed(t)) return;
        projectSet.add(Number(m[1]));
      });
    });
    huts.forEach((h) => {
      const glow = projectSet.has(h.project);
      h.windowMat.emissive.setHex(glow ? 0xffaa33 : 0x000000);
      h.windowMat.emissiveIntensity = glow ? 1.5 : 0;
      h.windowMat.color.setHex(glow ? 0xffdd88 : 0x111111);
    });
  }

  async function poll() {
    if (app.disposed) return;
    try {
      const res = await fetch((app.apiBase || '') + '/api/board');
      if (!res.ok) return;
      const data = await res.json();
      const workers = normalizeBoard(data);
      totalDone = workers.reduce((s, w) => s + (Array.isArray(w.tasks) ? w.tasks.filter(isTaskDone).length : 0), 0);
      applyGrowth();
      updateWorkers(workers);
      updateProjects(workers);
    } catch (e) {
      // keep scene alive
    }
  }

  app.cleanup = () => {
    app.disposed = true;
    cancelAnimationFrame(app.raf);
    clearInterval(app.pollTimer);
    if (app.resizeObs) app.resizeObs.disconnect();
    window.removeEventListener('resize', app.onResize);
    app.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    app.renderer.dispose();
    app.container.innerHTML = '';
  };

  applyGrowth();
  poll();
  app.pollTimer = setInterval(poll, 5000);

  let last = performance.now();
  function frame(now) {
    if (app.disposed) return;
    const dt = Math.min(0.08, (now - last) / 1000);
    last = now;

    if (!app.reducedMotion) {
      camAngle += 0.02 * dt;
      camera.position.x = camRadius * Math.cos(camAngle);
      camera.position.z = camRadius * Math.sin(camAngle);
      camera.position.y = 14;
      camera.lookAt(0, 0.5, 0);
    }

    torchCones.forEach((cone, i) => {
      const f = 1.8 + 0.55 * Math.sin(now * 0.004 + i * 1.7);
      torchLights[i].intensity = f;
    });

    // embers
    for (let i = 0; i < emberCount; i++) {
      const o = i * 3;
      emberPos[o + 1] += emberVel[i] * dt;
      emberPos[o] += Math.sin(now * 0.001 + i) * 0.012 * dt;
      if (emberPos[o + 1] > 2.1) resetEmber(i);
    }
    emberGeo.attributes.position.needsUpdate = true;

    rocks.forEach((rock, i) => {
      rock.position.y = rock.userData.baseY + Math.sin(now * 0.0012 + i) * 0.12;
    });

    flame.scale.y = 1 + 0.12 * Math.sin(now * 0.008);
    flame.material.emissiveIntensity = 1.7 + 0.6 * Math.sin(now * 0.011);

    for (const av of avatars.values()) {
      const target = av.done
        ? (campSlots[av.slotIndex] || new THREE.Vector3(0, 0, 0))
        : (torchCorners[av.targetIndex] || new THREE.Vector3(0, 0, 0));
      const tp = new THREE.Vector3(target.x, 0, target.z);
      av.group.position.lerp(tp, 1 - Math.exp(-dt * 2.4));
      const dist = av.group.position.distanceTo(tp);
      const bob = dist > 0.02 ? Math.abs(Math.sin(now * 0.006 + av.phase)) * 0.09 : 0;
      av.group.position.y = 0.05 + bob;
      if (!av.done && dist < 0.18 && Math.random() < 0.03) {
        av.targetIndex = Math.floor(Math.random() * 4);
      }
    }

    renderer.render(scene, camera);
    app.raf = requestAnimationFrame(frame);
  }

  resize();
  app.raf = requestAnimationFrame(frame);

  container.style.display = (container.style.display === 'none') ? '' : container.style.display;
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);
  resize();
}

// keep apiBase default export-friendly
export default { init3d, dispose3d };
