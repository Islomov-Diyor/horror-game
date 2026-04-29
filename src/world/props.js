import * as THREE from 'three';
import { TILE, CH } from '../core/config.js';
import { allFloorTiles, tileCenter, isWall } from './map.js';

function openFloorTiles() {
  return allFloorTiles().filter(({ gx, gz }) =>
    [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz]) => !isWall(gx+dx, gz+dz))
  );
}

function pickSpread(arr, n, minGap = 2) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  const picked = [];
  for (const t of shuffled) {
    if (picked.every(p => Math.abs(p.gx - t.gx) + Math.abs(p.gz - t.gz) >= minGap))
      picked.push(t);
    if (picked.length >= n) break;
  }
  return picked;
}

function mat(color, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
}

function meshAt(geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

// ── mahalla (level 1) ──────────────────────────────────────────────
function buildChoynak() {
  const g = new THREE.Group();
  g.add(meshAt(new THREE.CylinderGeometry(0.12, 0.10, 0.18, 8), mat(0x8b6914), 0, 0.09, 0));
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.12, 6), mat(0x8b6914));
  spout.rotation.z = Math.PI / 3;
  spout.position.set(0.11, 0.11, 0);
  g.add(spout);
  g.add(meshAt(new THREE.SphereGeometry(0.065, 8, 6), mat(0x7a5c10), 0, 0.20, 0));
  return g;
}

function buildShelf() {
  const g = new THREE.Group();
  g.add(meshAt(new THREE.BoxGeometry(0.8, 0.9, 0.04), mat(0x5c3d1e), 0, 0.45, 0));
  for (let i = 0; i < 3; i++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.18), mat(0x6b4a25));
    shelf.position.set(0, 0.15 + i * 0.3, 0.07);
    g.add(shelf);
  }
  return g;
}

function buildChair() {
  const g = new THREE.Group();
  g.add(meshAt(new THREE.BoxGeometry(0.38, 0.05, 0.38), mat(0x4a3520), 0, 0.42, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.38, 0.4, 0.05), mat(0x4a3520), 0, 0.64, -0.165));
  [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.04), mat(0x3a2810));
    leg.position.set(lx, 0.21, lz);
    g.add(leg);
  });
  return g;
}

function buildFabricStrip() {
  const g = new THREE.Group();
  const colors = [0x8b1a1a, 0x1a4a8b, 0x8b7a1a];
  const c = colors[Math.floor(Math.random() * colors.length)];
  g.add(meshAt(new THREE.BoxGeometry(0.06, 0.8, 0.01), mat(c, 1.0), 0, CH - 0.4, 0));
  return g;
}

function buildOilLamp() {
  const g = new THREE.Group();
  g.add(meshAt(new THREE.CylinderGeometry(0.07, 0.09, 0.06, 8), mat(0x7a6020), 0, 0.03, 0));
  g.add(meshAt(new THREE.CylinderGeometry(0.06, 0.04, 0.08, 8), mat(0x8a7030), 0, 0.10, 0));
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0xff9900, emissive: 0xff6600, emissiveIntensity: 1.2 }));
  flame.position.set(0, 0.18, 0);
  g.add(flame);
  return g;
}

function placeMahalla(levelGroup) {
  const tiles = openFloorTiles();
  const DENSITY = Math.max(4, Math.floor(tiles.length * 0.12));
  const builders = [buildChoynak, buildShelf, buildChair, buildFabricStrip, buildOilLamp];
  const spots = pickSpread(tiles, DENSITY, 2);
  spots.forEach((t, i) => {
    const c = tileCenter(t.gx, t.gz);
    const prop = builders[i % builders.length]();
    prop.position.set(
      c.x + (Math.random() - 0.5) * (TILE * 0.4),
      0,
      c.z + (Math.random() - 0.5) * (TILE * 0.4)
    );
    prop.rotation.y = Math.random() * Math.PI * 2;
    levelGroup.add(prop);
  });
}

// ── tunnel (level 2) ───────────────────────────────────────────────
function buildPipe() {
  const g = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), mat(0x4a3a2a, 0.95));
  if (Math.random() < 0.5) pipe.rotation.z = Math.PI / 2;
  pipe.position.y = 0.22 + Math.random() * 0.4;
  g.add(pipe);
  return g;
}

function buildCrate() {
  const g = new THREE.Group();
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.38), mat(0x5c4a2e, 0.97));
  crate.position.y = 0.17;
  crate.rotation.y = (Math.random() - 0.5) * 0.4;
  g.add(crate);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.2), mat(0x4a3a22));
  lid.position.set(0.1, 0.36, 0.09);
  lid.rotation.z = 0.3;
  g.add(lid);
  return g;
}

function buildPuddle() {
  const g = new THREE.Group();
  const puddle = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5 + Math.random() * 0.4, 0.3 + Math.random() * 0.3),
    new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.7 })
  );
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.y = 0.002;
  g.add(puddle);
  return g;
}

function buildWiring() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6 + Math.random() * 0.5, 4), mat(0x1a1a1a));
    wire.rotation.z = (Math.random() - 0.5) * Math.PI;
    wire.position.set((Math.random() - 0.5) * 0.2, CH - 0.15 - Math.random() * 0.3, (Math.random() - 0.5) * 0.2);
    g.add(wire);
  }
  return g;
}

function buildWarningSign() {
  const g = new THREE.Group();
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.02), mat(0xc8a000));
  sign.position.y = 1.4;
  g.add(sign);
  return g;
}

function placeTunnel(levelGroup) {
  const tiles = openFloorTiles();
  const DENSITY = Math.max(4, Math.floor(tiles.length * 0.14));
  const builders = [buildPipe, buildCrate, buildPuddle, buildWiring, buildWarningSign];
  const spots = pickSpread(tiles, DENSITY, 2);
  spots.forEach((t, i) => {
    const c = tileCenter(t.gx, t.gz);
    const prop = builders[i % builders.length]();
    prop.position.x += c.x + (Math.random() - 0.5) * (TILE * 0.35);
    prop.position.z += c.z + (Math.random() - 0.5) * (TILE * 0.35);
    prop.rotation.y = Math.random() * Math.PI * 2;
    levelGroup.add(prop);
  });
}

// ── mahbas (level 3) ───────────────────────────────────────────────
function buildIronBars() {
  const g = new THREE.Group();
  const barMat = mat(0x2a2a2a, 0.6);
  for (let i = -1; i <= 1; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, CH * 0.7, 6), barMat);
    bar.position.set(i * 0.12, CH * 0.35, 0);
    g.add(bar);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.025, 0.025), barMat);
  rail.position.set(0, CH * 0.65, 0);
  g.add(rail);
  return g;
}

function buildBucket() {
  const g = new THREE.Group();
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.08, 0.18, 10), mat(0x3a3a3a, 0.8));
  bucket.rotation.z = Math.PI * 0.7;
  bucket.position.set(0, 0.09, 0);
  g.add(bucket);
  return g;
}

function buildScriptPlane() {
  const g = new THREE.Group();
  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x1a0a04, roughness: 1.0, transparent: true, opacity: 0.7 })
  );
  patch.position.set(0, 1.3, 0.01);
  g.add(patch);
  return g;
}

function buildChain() {
  const g = new THREE.Group();
  const linkMat = mat(0x2a2a2a, 0.7);
  for (let i = 0; i < 5; i++) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.010, 4, 8), linkMat);
    link.position.y = CH - 0.1 - i * 0.09;
    link.rotation.x = i % 2 === 0 ? 0 : Math.PI / 2;
    g.add(link);
  }
  return g;
}

function placeMahbas(levelGroup) {
  const tiles = openFloorTiles();
  const DENSITY = Math.max(4, Math.floor(tiles.length * 0.10));
  const builders = [buildIronBars, buildBucket, buildScriptPlane, buildChain];
  const spots = pickSpread(tiles, DENSITY, 3);
  spots.forEach((t, i) => {
    const c = tileCenter(t.gx, t.gz);
    const prop = builders[i % builders.length]();
    prop.position.x += c.x + (Math.random() - 0.5) * (TILE * 0.3);
    prop.position.z += c.z + (Math.random() - 0.5) * (TILE * 0.3);
    prop.rotation.y = Math.random() * Math.PI * 2;
    levelGroup.add(prop);
  });
}

// ── chuqur (level 4) ───────────────────────────────────────────────
function buildGirihFragment() {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 0.45), mat(0x3a2a1a, 1.0));
  slab.position.y = 0.015;
  slab.rotation.y = Math.random() * Math.PI / 4;
  g.add(slab);
  const lineMat = mat(0x5a3a1a, 0.9);
  [[0.1, 0, 0.45, 0.02], [0, 0.1, 0.02, 0.45]].forEach(([lx, lz, lw, ld]) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.02, ld), lineMat);
    line.position.set(lx, 0.035, lz);
    g.add(line);
  });
  return g;
}

function buildPrayerBeads() {
  const g = new THREE.Group();
  const beadMat = mat(0x6b4a00, 0.8);
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), beadMat);
    bead.position.set(Math.cos(angle) * 0.13, 0.016 + Math.sin(i) * 0.02, Math.sin(angle) * 0.13);
    g.add(bead);
  }
  return g;
}

function buildOffering() {
  const g = new THREE.Group();
  g.add(meshAt(new THREE.CylinderGeometry(0.14, 0.12, 0.02, 10), mat(0x5a4010, 0.9), 0, 0.01, 0));
  g.add(meshAt(new THREE.SphereGeometry(0.055, 8, 6), mat(0x5a1a00, 0.8), 0, 0.075, 0));
  return g;
}

function placeChuqur(levelGroup) {
  const tiles = openFloorTiles();
  const DENSITY = Math.max(3, Math.floor(tiles.length * 0.08));
  const builders = [buildGirihFragment, buildPrayerBeads, buildOffering];
  const spots = pickSpread(tiles, DENSITY, 3);
  spots.forEach((t, i) => {
    const c = tileCenter(t.gx, t.gz);
    const prop = builders[i % builders.length]();
    prop.position.x += c.x + (Math.random() - 0.5) * (TILE * 0.3);
    prop.position.z += c.z + (Math.random() - 0.5) * (TILE * 0.3);
    prop.rotation.y = Math.random() * Math.PI * 2;
    levelGroup.add(prop);
  });
}

// ── jahannam (level 5) ─────────────────────────────────────────────
function buildBurnMark() {
  const g = new THREE.Group();
  const mark = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55 + Math.random() * 0.3, 0.55 + Math.random() * 0.3),
    new THREE.MeshStandardMaterial({ color: 0x0a0000, roughness: 1.0, transparent: true, opacity: 0.85 })
  );
  mark.rotation.x = -Math.PI / 2;
  mark.position.y = 0.003;
  g.add(mark);
  const symMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, roughness: 1.0, emissive: 0x1a0000, emissiveIntensity: 0.4 });
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.005, 0.03), symMat);
    bar.rotation.y = (i / 3) * Math.PI;
    bar.position.y = 0.006;
    g.add(bar);
  }
  return g;
}

function buildAzhdahoScale() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const scale = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x1a1a00, roughness: 0.7, metalness: 0.3, transparent: true, opacity: 0.9 })
    );
    scale.rotation.x = -Math.PI / 2;
    scale.rotation.z = (i / 4) * Math.PI * 2;
    scale.position.set(Math.cos((i / 4) * Math.PI * 2) * 0.15, 0.003, Math.sin((i / 4) * Math.PI * 2) * 0.15);
    g.add(scale);
  }
  return g;
}

function buildThresholdMarking() {
  const g = new THREE.Group();
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(TILE * 0.9, 0.005, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x2a0000, roughness: 1.0, emissive: 0x0f0000, emissiveIntensity: 0.3 })
  );
  line.position.y = 0.004;
  g.add(line);
  return g;
}

function buildBoneScatter() {
  const g = new THREE.Group();
  const boneMat = mat(0x8a8070, 0.95);
  for (let i = 0; i < 3; i++) {
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.18 + Math.random() * 0.1, 6), boneMat);
    bone.position.set((Math.random() - 0.5) * 0.3, 0.02, (Math.random() - 0.5) * 0.3);
    bone.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.4, 0, Math.random() * Math.PI);
    g.add(bone);
  }
  return g;
}

function placeJahannam(levelGroup) {
  const tiles = openFloorTiles();
  const DENSITY = Math.max(3, Math.floor(tiles.length * 0.07));
  const builders = [buildBurnMark, buildAzhdahoScale, buildThresholdMarking, buildBoneScatter];
  const spots = pickSpread(tiles, DENSITY, 4);
  spots.forEach((t, i) => {
    const c = tileCenter(t.gx, t.gz);
    const prop = builders[i % builders.length]();
    prop.position.x += c.x + (Math.random() - 0.5) * (TILE * 0.25);
    prop.position.z += c.z + (Math.random() - 0.5) * (TILE * 0.25);
    prop.rotation.y = Math.random() * Math.PI * 2;
    levelGroup.add(prop);
  });
}

// ── public API ─────────────────────────────────────────────────────
const THEMES = {
  mahalla:  placeMahalla,
  tunnel:   placeTunnel,
  mahbas:   placeMahbas,
  chuqur:   placeChuqur,
  jahannam: placeJahannam,
};

export function scatterProps(levelGroup, levelConfig) {
  const fn = THEMES[levelConfig.propTheme];
  if (fn) fn(levelGroup);
}
