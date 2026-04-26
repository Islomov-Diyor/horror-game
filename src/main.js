import * as THREE from 'three';
import { TILE, CH, PLAYER_R, WALK_SPD, SPRINT_SPD, BASE_HEMI, BASE_AMBIENT, BASE_PLAYER, BASE_CEIL, BASE_FOG } from './core/config.js';

// ═══════════════════════════════════════════════════════════════════
//  LEVEL GRIDS — 5 hand-authored themes
//  '1' = wall, '0' = floor, 'S' = spawn (forced)
// ═══════════════════════════════════════════════════════════════════
const LEVEL_GRIDS = [
  // ── 1. LOBBY — open corridors, gentle introduction ──
  [
    "11111111111111111111111111",
    "10000000000000000000000001",
    "10011100111001110011100001",
    "10010000100001000010000001",
    "10010011100111001110011001",
    "10000000000000000000000001",
    "100011000S1000000011000001",
    "10001100001000001111000001",
    "10000000000000000000000001",
    "10011100111001110011100001",
    "10010000100001000010000001",
    "10010011100111001110011001",
    "10000000000000000000000001",
    "11111111111111111111111111",
  ],
  // ── 2. TUNNEL — narrow winding corridors ──
  [
    "11111111111111111111111111111",
    "10000000000000000000000000001",
    "10111111011111110111111101111",
    "10100000000000000000000000001",
    "10101111111011111110111111101",
    "10100000001000000010000000001",
    "10101111101011111010S11111101",
    "10000001000010000010100000001",
    "11111101011110111110101111101",
    "10000001000000000000101000001",
    "10111111111111111110101011101",
    "10000000000000000000001000001",
    "11111111111111111111111111111",
  ],
  // ── 3. CELLS — prison grid ──
  [
    "1111111111111111111111111",
    "1000000000000000000000001",
    "1011101110111011101110001",
    "1010001000100010001000001",
    "1010001000100010001000001",
    "1011101110111011101110101",
    "100000000000S0000000000001",
    "1011101110111011101110101",
    "1010001000100010001000001",
    "1010001000100010001000001",
    "1011101110111011101110001",
    "1000000000000000000000001",
    "1011101110111011101110101",
    "1010001000100010001000001",
    "1010001000100010001000001",
    "1011101110111011101110001",
    "1000000000000000000000001",
    "1111111111111111111111111",
  ],
  // ── 4. PIT — chaotic maze ──
  [
    "1111111111111111111111111111",
    "1000100010000100010000010001",
    "1010111010111010111011010101",
    "1010000000100010000010010101",
    "1011101111101111101110010101",
    "1000100000000000100000010001",
    "1010111011110111011101111101",
    "1010001000010000010000000001",
    "10111011S11011011011101110101",
    "1000001000000001000000010101",
    "1011111011111101110111010101",
    "1000001000001000010000010001",
    "1010111111101110111110111101",
    "1010000000000000000000000001",
    "1011111111111111111111111101",
    "1000000000000000000000000001",
    "1111111111111111111111111111",
  ],
  // ── 5. HELL — long dark halls, minimal cover ──
  [
    "1111111111111111111111111111111",
    "1000000000000000000000000000001",
    "1011111101111111111111110111101",
    "1000001000000000000000000100001",
    "1011101011110111101111110101101",
    "1000101000000100000000010101001",
    "1110101110111110111110110101101",
    "1000001000000000100000000100001",
    "1011111101111110111011111110101",
    "10000S0000000000000100000000101",
    "1011101111111011111101111110101",
    "1010000000001000000000000000001",
    "1010111011111110111011111011101",
    "1010001000000000001000001010001",
    "1011111011111111111111101111101",
    "1000000000000000000000000000001",
    "1111111111111111111111111111111",
  ],
];

const LEVELS = [
  {n:1, name:"ZANGAR",   spd:2.4, lm:1.00, fm:0.80, flickerMul:1.0, fogColor:0x1a0f04, ambientColor:0xffe2a0, hintKey:true},
  {n:2, name:"TUNNEL",   spd:2.8, lm:0.80, fm:1.15, flickerMul:1.3, fogColor:0x0d0a06, ambientColor:0xd4b680},
  {n:3, name:"MAHBAS",   spd:3.2, lm:0.62, fm:1.45, flickerMul:1.7, fogColor:0x100502, ambientColor:0xa07050},
  {n:4, name:"CHUQUR",   spd:3.6, lm:0.44, fm:1.80, flickerMul:2.2, fogColor:0x080303, ambientColor:0x804030},
  {n:5, name:"JAHANNAM", spd:4.0, lm:0.32, fm:2.15, flickerMul:3.2, fogColor:0x0a0202, ambientColor:0xaa3020},
];
let currentLevel = 0;

// ═══════════════════════════════════════════════════════════════════
//  LEVEL-AWARE TILE STATE
// ═══════════════════════════════════════════════════════════════════
let CUR_GRID = LEVEL_GRIDS[0];
let CUR_GW = CUR_GRID[0].length;
let CUR_GH = CUR_GRID.length;
let MAP_W = CUR_GW * TILE;
let MAP_H = CUR_GH * TILE;

function isWall(gx, gz) {
  if (gx < 0 || gx >= CUR_GW || gz < 0 || gz >= CUR_GH) return true;
  return CUR_GRID[gz][gx] === '1';
}
function tileAt(x, z) {
  const gx = Math.floor((x + MAP_W / 2) / TILE);
  const gz = Math.floor((z + MAP_H / 2) / TILE);
  if (gx < 0 || gx >= CUR_GW || gz < 0 || gz >= CUR_GH) return '1';
  return CUR_GRID[gz][gx] === '1' ? '1' : '0';
}
function inMap(x, z, r = PLAYER_R) {
  return tileAt(x - r, z - r) === '0' &&
         tileAt(x + r, z - r) === '0' &&
         tileAt(x - r, z + r) === '0' &&
         tileAt(x + r, z + r) === '0';
}
function tileCenter(gx, gz) {
  return { x: (gx - CUR_GW / 2 + 0.5) * TILE, z: (gz - CUR_GH / 2 + 0.5) * TILE };
}
function worldToTile(x, z) {
  return {
    gx: Math.floor((x + MAP_W / 2) / TILE),
    gz: Math.floor((z + MAP_H / 2) / TILE)
  };
}
function findSpawnTile() {
  for (let gz = 0; gz < CUR_GH; gz++) {
    for (let gx = 0; gx < CUR_GW; gx++) {
      if (CUR_GRID[gz][gx] === 'S') return { gx, gz };
    }
  }
  // fallback: first floor
  for (let gz = 0; gz < CUR_GH; gz++) {
    for (let gx = 0; gx < CUR_GW; gx++) {
      if (CUR_GRID[gz][gx] === '0') return { gx, gz };
    }
  }
  return { gx: 1, gz: 1 };
}
function allFloorTiles() {
  const a = [];
  for (let gz = 1; gz < CUR_GH - 1; gz++) {
    for (let gx = 1; gx < CUR_GW - 1; gx++) {
      const c = CUR_GRID[gz][gx];
      if (c === '0' || c === 'S') a.push({ gx, gz });
    }
  }
  return a;
}
function pickFarFloorTile(excludes, minDist) {
  const cand = [];
  for (const t of allFloorTiles()) {
    let ok = true;
    for (const e of excludes) {
      const d = Math.abs(t.gx - e.gx) + Math.abs(t.gz - e.gz);
      if (d < minDist) { ok = false; break; }
    }
    if (ok) cand.push(t);
  }
  if (!cand.length) return allFloorTiles()[0] || { gx: 1, gz: 1 };
  return cand[Math.floor(Math.random() * cand.length)];
}
function tilesAdjacentToWall() {
  // for hiding spots: a floor tile that has at least one wall neighbor
  const a = [];
  for (const t of allFloorTiles()) {
    const adj = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz]) => isWall(t.gx+dx, t.gz+dz));
    if (adj) a.push(t);
  }
  return a;
}

// ═══════════════════════════════════════════════════════════════════
//  A* PATHFINDING
// ═══════════════════════════════════════════════════════════════════
function aStar(sx, sz, gx, gz) {
  if (isWall(gx, gz) || isWall(sx, sz)) return null;
  if (sx === gx && sz === gz) return [{ gx: sx, gz: sz }];
  const key = (x, z) => x + '_' + z;
  const openMap = new Map();
  const closed = new Set();
  const startNode = { gx: sx, gz: sz, g: 0, h: Math.abs(sx-gx)+Math.abs(sz-gz), parent: null };
  openMap.set(key(sx, sz), startNode);
  let iter = 0;
  while (openMap.size && iter++ < 3000) {
    // pick lowest f
    let cur = null;
    for (const n of openMap.values()) {
      if (!cur || (n.g + n.h) < (cur.g + cur.h)) cur = n;
    }
    openMap.delete(key(cur.gx, cur.gz));
    closed.add(key(cur.gx, cur.gz));
    if (cur.gx === gx && cur.gz === gz) {
      const path = [];
      let n = cur;
      while (n) { path.unshift({ gx: n.gx, gz: n.gz }); n = n.parent; }
      return path;
    }
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cur.gx + dx, nz = cur.gz + dz;
      if (isWall(nx, nz)) continue;
      if (closed.has(key(nx, nz))) continue;
      const g = cur.g + 1;
      const k = key(nx, nz);
      const existing = openMap.get(k);
      if (existing && existing.g <= g) continue;
      openMap.set(k, { gx: nx, gz: nz, g, h: Math.abs(nx-gx)+Math.abs(nz-gz), parent: cur });
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
//  PROCEDURAL TEXTURES
// ═══════════════════════════════════════════════════════════════════
function wallTex(base, accent, dirt) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0,0,256,256);
  for (let x = 0; x < 256; x += 6) {
    g.fillStyle = (x/6)%2 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.05)';
    g.fillRect(x, 0, 3, 256);
  }
  for (let i = 0; i < 2800; i++) {
    g.fillStyle = `rgba(0,0,0,${.05 + Math.random()*.25})`;
    g.fillRect(Math.random()*256, Math.random()*256, 1+Math.random()*2, 1+Math.random()*2);
  }
  // grime patches
  for (let i = 0; i < 10; i++) {
    const cx = Math.random()*256, cy = Math.random()*256;
    const grd = g.createRadialGradient(cx, cy, 2, cx, cy, 30+Math.random()*30);
    grd.addColorStop(0, dirt); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(cx-60, cy-60, 120, 120);
  }
  // baseboard
  g.fillStyle = accent; g.fillRect(0, 240, 256, 16);
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 240, 256, 3);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function floorTex(base, accent) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0,0,256,256);
  for (let i = 0; i < 7000; i++) {
    g.fillStyle = `rgba(${20+Math.random()*40},${14+Math.random()*30},${6+Math.random()*20},${.25+Math.random()*.35})`;
    g.fillRect(Math.random()*256, Math.random()*256, 1+Math.random()*1.6, 1);
  }
  for (let i = 0; i < 6; i++) {
    const cx = Math.random()*256, cy = Math.random()*256;
    const grd = g.createRadialGradient(cx, cy, 1, cx, cy, 30+Math.random()*20);
    grd.addColorStop(0, accent); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(cx-50, cy-50, 100, 100);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function ceilingTex(base) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0,0,256,256);
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = `rgba(0,0,0,${.1+Math.random()*.18})`;
    g.fillRect(Math.random()*256, Math.random()*256, 1+Math.random()*2, 1+Math.random()*2);
  }
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2;
  g.strokeRect(1,1,254,254);
  g.beginPath(); g.moveTo(128,0); g.lineTo(128,256);
  g.moveTo(0,128); g.lineTo(256,128); g.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function paperTex() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 180;
  const g = cv.getContext('2d');
  g.fillStyle = '#e8d8aa'; g.fillRect(0,0,256,180);
  for (let i = 0; i < 800; i++) {
    g.fillStyle = `rgba(90,60,20,${.08+Math.random()*.14})`;
    g.fillRect(Math.random()*256, Math.random()*180, 1+Math.random()*2, 1);
  }
  // simulated handwriting lines
  g.strokeStyle = '#3a1a08'; g.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const y = 30 + i*24;
    g.beginPath();
    let x = 20 + Math.random()*10;
    g.moveTo(x, y);
    while (x < 236) {
      x += 6+Math.random()*12;
      g.lineTo(x, y + (Math.random()-.5)*6);
    }
    g.stroke();
  }
  // corner stain
  const grd = g.createRadialGradient(220, 30, 3, 220, 30, 60);
  grd.addColorStop(0, 'rgba(80,40,10,.4)'); grd.addColorStop(1, 'rgba(80,40,10,0)');
  g.fillStyle = grd; g.fillRect(160, 0, 96, 90);
  return new THREE.CanvasTexture(cv);
}
function signTex(text, bg = '#222', fg = '#ffdd44') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 80;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0,0,256,80);
  g.strokeStyle = fg; g.lineWidth = 2; g.strokeRect(3,3,250,74);
  g.fillStyle = fg; g.font = 'bold 22px Courier New';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 42);
  return new THREE.CanvasTexture(cv);
}

// per-level texture palettes
const LEVEL_TEX = [
  { wall:'#b89340', wAcc:'#5c3d12', wDirt:'rgba(60,35,10,.38)', floor:'#6e5320', fAcc:'rgba(20,12,4,.45)', ceil:'#a89f88' },
  { wall:'#8a6228', wAcc:'#3a2a0e', wDirt:'rgba(40,22,8,.42)',  floor:'#4a371a', fAcc:'rgba(10,6,2,.5)',   ceil:'#776552' },
  { wall:'#5f4420', wAcc:'#241508', wDirt:'rgba(30,10,5,.5)',   floor:'#2e2010', fAcc:'rgba(5,2,1,.6)',    ceil:'#4a3d2a' },
  { wall:'#3e2c15', wAcc:'#120806', wDirt:'rgba(60,5,5,.45)',   floor:'#1a1208', fAcc:'rgba(60,0,0,.4)',   ceil:'#2a1f15' },
  { wall:'#421510', wAcc:'#1a0302', wDirt:'rgba(120,10,10,.5)', floor:'#2a0a06', fAcc:'rgba(120,0,0,.55)', ceil:'#1a0604' },
];

// ═══════════════════════════════════════════════════════════════════
//  THREE.JS CORE
// ═══════════════════════════════════════════════════════════════════
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0604);
scene.fog = new THREE.FogExp2(0x0a0604, 0.030);

const camera = new THREE.PerspectiveCamera(78, innerWidth/innerHeight, .05, 120);
camera.rotation.order = 'YXZ';

const cvEl = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas: cvEl, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// ── AUDIO LISTENER (3D spatial) ─────────────────────
const audioListener = new THREE.AudioListener();
camera.add(audioListener);
scene.add(camera);

// ── LIGHTS ──────────────────────────────────────────
const hemi    = new THREE.HemisphereLight(0xffd890, 0x221100, BASE_HEMI);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffe2a0, BASE_AMBIENT);
scene.add(ambient);
const playerLight = new THREE.PointLight(0xffe4b0, BASE_PLAYER, 7);
scene.add(playerLight);

// ── FLASHLIGHT (SpotLight) ──────────────────────────
const flashlight = new THREE.SpotLight(0xffeecc, 0, 18, Math.PI / 6.5, 0.35, 1.8);
flashlight.position.set(0, 1.7, 0);
scene.add(flashlight);
const flashTarget = new THREE.Object3D();
scene.add(flashTarget);
flashlight.target = flashTarget;

// ═══════════════════════════════════════════════════════════════════
//  LEVEL OBJECT CONTAINER (cleared on level change)
// ═══════════════════════════════════════════════════════════════════
const levelGroup = new THREE.Group();
scene.add(levelGroup);

function disposeNode(node) {
  node.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}
function clearLevel() {
  disposeNode(levelGroup);
  while (levelGroup.children.length) levelGroup.remove(levelGroup.children[0]);
  ceilingLights.length = 0;
  lightPanels.length = 0;
  hidingSpots.length = 0;
  batteryPickups.length = 0;
  notePickups.length = 0;
  monsterWaypoints.length = 0;
}

// ═══════════════════════════════════════════════════════════════════
//  LEVEL BUILDER — walls, floor, ceiling, lights
// ═══════════════════════════════════════════════════════════════════
const ceilingLights = [];
const lightPanels = [];

function buildLevelGeometry() {
  const palette = LEVEL_TEX[currentLevel];
  const wTex = wallTex(palette.wall, palette.wAcc, palette.wDirt);
  const fTex = floorTex(palette.floor, palette.fAcc);
  const cTex = ceilingTex(palette.ceil);
  fTex.repeat.set(CUR_GW, CUR_GH);
  cTex.repeat.set(CUR_GW, CUR_GH);

  const wMat = new THREE.MeshStandardMaterial({ map: wTex, roughness: 0.88, metalness: 0.04 });
  const fMat = new THREE.MeshStandardMaterial({ map: fTex, roughness: 0.96 });
  const cMat = new THREE.MeshStandardMaterial({ map: cTex, roughness: 0.95 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), fMat);
  floor.rotation.x = -Math.PI/2;
  levelGroup.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), cMat);
  ceil.rotation.x = Math.PI/2;
  ceil.position.y = CH;
  levelGroup.add(ceil);

  // collect wall runs along X and Z to reduce draw calls a bit
  const wallGeo = new THREE.BoxGeometry(TILE, CH, TILE);
  for (let gz = 0; gz < CUR_GH; gz++) {
    for (let gx = 0; gx < CUR_GW; gx++) {
      if (CUR_GRID[gz][gx] !== '1') continue;
      const c = tileCenter(gx, gz);
      const wall = new THREE.Mesh(wallGeo, wMat);
      wall.position.set(c.x, CH/2, c.z);
      levelGroup.add(wall);
    }
  }

  // ceiling lights — scatter every few tiles in open areas
  const lightPanelMat = new THREE.MeshBasicMaterial({ color: 0xccb080 });
  const panelGeo = new THREE.BoxGeometry(1.6, 0.08, 0.6);
  for (let gz = 1; gz < CUR_GH - 1; gz += 3) {
    for (let gx = 1; gx < CUR_GW - 1; gx += 4) {
      if (CUR_GRID[gz][gx] !== '0' && CUR_GRID[gz][gx] !== 'S') continue;
      const c = tileCenter(gx, gz);
      const pl = new THREE.PointLight(0xffe2a0, BASE_CEIL, 14, 2);
      pl.position.set(c.x, CH - 0.35, c.z);
      levelGroup.add(pl);
      ceilingLights.push(pl);
      const panel = new THREE.Mesh(panelGeo, lightPanelMat.clone());
      panel.position.set(c.x, CH - 0.08, c.z);
      levelGroup.add(panel);
      lightPanels.push(panel);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  KEY, DOOR, PICKUPS, HIDING SPOTS, NOTES
// ═══════════════════════════════════════════════════════════════════
let keyGroup = null;
let doorGroup = null;
const hidingSpots = [];      // { mesh, gx, gz, worldX, worldZ, occupied }
const batteryPickups = [];   // { group, gx, gz, worldX, worldZ, taken }
const notePickups = [];      // { group, gx, gz, worldX, worldZ, text, title, taken }
const monsterWaypoints = []; // { gx, gz }

const NOTE_LORE = [
  { t:"1-KUN", b:"Ishdan qaytayotganimda\nnotanish eshikka kirdim.\nUndan keyin hech narsa o'zgarmadi...\nfaqat shovqinlar." },
  { t:"QOCHISHGA URINISH", b:"Devorlar yurib turadi.\nXaritani chizish foydasiz.\nKalitlar bor — ular yashirilgan.\nOvoz qilma. U eshitadi." },
  { t:"U HAQIDA", b:"Uni ko'rmadim, lekin ovozini\neshitdim. Nafas olmayapti,\nzaharlashmagan... o'ladi menimcha\nkeyingi marta chiqsam." },
  { t:"OXIRGI TILAK", b:"Agar bu xatni topsangiz\nmen allaqachon yo'q.\nLocker'lar yordam beradi.\nBatareya — sizning eng yaxshi do'stingiz." },
  { t:"QOIDALAR", b:"1. Yugurma (u eshitadi)\n2. Yorug'likni o'chir (ba'zan)\n3. Lockerga yashirin\n4. Kalitsiz chiqmaysan" },
  { t:"XATA", b:"Chiroqni yoqdim. U qaradi.\nEndi u nima yerda ekanimni biladi.\nSensiz qochib bo'lmaydi.\nYur... men ustun qoldim." },
  { t:"5-LEVEL", b:"Bu yerda yorug' yo'q.\nFaqat chiroq bor. Batareya\ntugasa — hammasi tugaydi.\nYur. Orqaga qaramay." },
  { t:"SAVOL", b:"Nega men? Nega biz?\nBu joy meni tanlaganmi\nyoki men uni? Javob yo'q.\nFaqat eshiklar, kalitlar, va u." },
];

function buildKey() {
  keyGroup = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    new THREE.MeshStandardMaterial({ color: 0xffdd33, emissive: 0xffaa00, emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.95 })
  );
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xffcc22, emissive: 0xcc8800, emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.9 })
  );
  stem.position.y = -0.3;
  stem.rotation.z = Math.PI/2;
  keyGroup.add(body);
  keyGroup.add(stem);
  const glow = new THREE.PointLight(0xffaa00, 1.8, 5);
  keyGroup.add(glow);
  levelGroup.add(keyGroup);
}

function buildDoor() {
  doorGroup = new THREE.Group();
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x228833, emissive: 0x006622, emissiveIntensity: 0.6,
    roughness: 0.45, metalness: 0.35
  });
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 0.16), doorMat);
  door.position.y = 1.4;
  doorGroup.add(door);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x114422, roughness: 0.6 });
  [[-1.05,1.4,0,0.1,2.9,0.2],[1.05,1.4,0,0.1,2.9,0.2],[0,2.85,0,2.2,0.1,0.2]].forEach(([x,y,z,w,h,d]) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), frameMat);
    f.position.set(x,y,z); doorGroup.add(f);
  });
  const doorSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 0.45),
    new THREE.MeshBasicMaterial({ map: signTex('QOCHISH','#ffffff','#008822'), transparent:true, depthWrite:false })
  );
  doorSign.position.set(0, 2.2, 0.11);
  doorGroup.add(doorSign);
  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xddbb00, metalness: 0.9, roughness: 0.25 })
  );
  handle.position.set(0.7, 1.4, 0.12);
  doorGroup.add(handle);
  const glow = new THREE.PointLight(0x00ff55, 1.6, 6);
  glow.position.set(0, 1.5, 0.5);
  doorGroup.add(glow);
  levelGroup.add(doorGroup);
}

function buildHidingSpot(gx, gz) {
  // locker: tall box inserted against nearest wall
  let wallDir = null;
  for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    if (isWall(gx+dx, gz+dz)) { wallDir = [dx, dz]; break; }
  }
  if (!wallDir) return;
  const c = tileCenter(gx, gz);
  const offX = wallDir[0] * (TILE/2 - 0.35);
  const offZ = wallDir[1] * (TILE/2 - 0.35);
  const locker = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.8, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.3, 0.45), mat);
  body.position.y = 1.15;
  locker.add(body);
  // door detail
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 2.1, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x5a4a34, roughness: 0.7 })
  );
  door.position.set(0, 1.15, 0.23);
  locker.add(door);
  // vents
  for (let i = 0; i < 5; i++) {
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.03, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    slit.position.set(0, 1.8 - i*0.08, 0.26);
    locker.add(slit);
  }
  locker.position.set(c.x + offX, 0, c.z + offZ);
  // face outward
  if (wallDir[0] === 1)  locker.rotation.y = -Math.PI/2;
  if (wallDir[0] === -1) locker.rotation.y =  Math.PI/2;
  if (wallDir[1] === 1)  locker.rotation.y =  Math.PI;
  if (wallDir[1] === 0 && wallDir[1] === 0) {}
  levelGroup.add(locker);
  hidingSpots.push({
    mesh: locker, gx, gz,
    worldX: c.x + offX * 0.3,
    worldZ: c.z + offZ * 0.3,
    occupied: false
  });
}

function buildBattery(gx, gz) {
  const c = tileCenter(gx, gz);
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.28, 12),
    new THREE.MeshStandardMaterial({ color: 0xddcc22, emissive: 0x443300, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.7 })
  );
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10),
    new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.2 })
  );
  cap.position.y = 0.17;
  g.add(body); g.add(cap);
  g.position.set(c.x, 0.35, c.z);
  const glow = new THREE.PointLight(0xffee55, 0.6, 2.5);
  g.add(glow);
  levelGroup.add(g);
  batteryPickups.push({ group: g, gx, gz, worldX: c.x, worldZ: c.z, taken: false });
}

function buildNote(gx, gz, lore) {
  const c = tileCenter(gx, gz);
  const g = new THREE.Group();
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.4),
    new THREE.MeshStandardMaterial({ map: paperTex(), roughness: 0.95, side: THREE.DoubleSide, emissive: 0x332211, emissiveIntensity: 0.2 })
  );
  paper.rotation.x = -Math.PI/2;
  paper.position.y = 0.05;
  g.add(paper);
  g.position.set(c.x, 0.01, c.z);
  const glow = new THREE.PointLight(0xffcc77, 0.4, 1.8);
  glow.position.y = 0.4;
  g.add(glow);
  levelGroup.add(g);
  notePickups.push({ group: g, gx, gz, worldX: c.x, worldZ: c.z, title: lore.t, text: lore.b, taken: false });
}

// ═══════════════════════════════════════════════════════════════════
//  FULL-BODY 3D MONSTER RIG
// ═══════════════════════════════════════════════════════════════════
const MONSTER = {
  root: null,
  parts: {},
  x: 0, z: 0, y: 0,
  facing: 0,
  phase: 0,
  stateStartTime: 0,
  state: 'idle',       // 'idle' | 'patrol' | 'investigate' | 'chase' | 'stunned'
  targetPath: null,
  pathIndex: 0,
  investigateTarget: null,
  patrolIndex: 0,
  lastSeenPlayer: 0,
  breathingSound: null,
  footstepTimer: 0,
  spawned: false,
};

function buildMonster() {
  const root = new THREE.Group();

  // Materials
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xa89e91, roughness: 0.88, metalness: 0.04, emissive: 0x120806, emissiveIntensity: 0.15
  });
  const skinDarkMat = new THREE.MeshStandardMaterial({
    color: 0x6a5e50, roughness: 0.92, metalness: 0.04
  });
  const gownMat = new THREE.MeshStandardMaterial({
    color: 0xa89a76, roughness: 0.95, metalness: 0.0, emissive: 0x1a1108, emissiveIntensity: 0.08
  });
  const gownDirtMat = new THREE.MeshStandardMaterial({
    color: 0x6a5030, roughness: 0.95
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x0a0610, roughness: 1.0, metalness: 0.0
  });
  const bloodMat = new THREE.MeshStandardMaterial({
    color: 0x4a0505, roughness: 0.35, metalness: 0.3, emissive: 0x200000, emissiveIntensity: 0.2
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3311 });

  // ── BODY (root) ──
  const body = new THREE.Group();
  body.position.y = 0.0; // feet on floor
  root.add(body);

  // Torso — tapered cylinder (shoulders wider)
  const torsoGeo = new THREE.CylinderGeometry(0.22, 0.32, 0.78, 10);
  const torso = new THREE.Mesh(torsoGeo, gownMat);
  torso.position.y = 1.25;
  body.add(torso);
  // Torso dirt overlay (smaller inner box)
  const torsoDirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.33, 0.4, 10),
    gownDirtMat
  );
  torsoDirt.position.y = 1.05;
  body.add(torsoDirt);
  // Blood drip on chest
  const chestBlood = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.35, 0.02),
    bloodMat
  );
  chestBlood.position.set(0, 1.2, 0.32);
  body.add(chestBlood);

  // ── SKIRT (ragged gown bottom) ──
  const skirtGeo = new THREE.ConeGeometry(0.48, 0.9, 12, 1, true);
  const skirt = new THREE.Mesh(skirtGeo, gownMat);
  skirt.position.y = 0.55;
  skirt.rotation.x = Math.PI;
  body.add(skirt);

  // ── NECK ──
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 0.18, 8),
    skinMat
  );
  neck.position.y = 1.72;
  body.add(neck);
  // blood slash on neck
  const neckBlood = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.03, 0.14),
    bloodMat
  );
  neckBlood.position.y = 1.67;
  body.add(neckBlood);

  // ── HEAD (pivot group so we can tilt/nod) ──
  const headPivot = new THREE.Group();
  headPivot.position.y = 1.82;
  body.add(headPivot);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 14),
    skinMat
  );
  head.scale.set(0.85, 1.05, 0.9);
  headPivot.add(head);
  // jaw (lower mouth mass)
  const jaw = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 8),
    bloodMat
  );
  jaw.scale.set(0.9, 0.5, 0.7);
  jaw.position.set(0, -0.08, 0.06);
  headPivot.add(jaw);
  // eyes (two small glowing spheres - WILL cast bloom via emissive + point lights)
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
  eyeL.position.set(-0.065, 0.02, 0.17);
  eyeR.position.set(0.065, 0.02, 0.17);
  headPivot.add(eyeL);
  headPivot.add(eyeR);
  // eye point-lights for menacing glow
  const eyeGlowL = new THREE.PointLight(0xff2200, 0.4, 2.2);
  const eyeGlowR = new THREE.PointLight(0xff2200, 0.4, 2.2);
  eyeGlowL.position.copy(eyeL.position);
  eyeGlowR.position.copy(eyeR.position);
  headPivot.add(eyeGlowL);
  headPivot.add(eyeGlowR);

  // ── HAIR (ragged strands as curved planes) ──
  const hairBulk = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    hairMat
  );
  hairBulk.position.set(0, 0.07, -0.02);
  hairBulk.scale.set(1.05, 0.85, 1.05);
  headPivot.add(hairBulk);
  // long strands
  for (let i = 0; i < 6; i++) {
    const strand = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.55),
      hairMat
    );
    const a = (i / 6) * Math.PI * 2;
    strand.position.set(Math.sin(a) * 0.15, -0.2, Math.cos(a) * 0.15);
    strand.rotation.y = a;
    strand.rotation.x = 0.2;
    headPivot.add(strand);
  }

  // ── ARMS (shoulder → upper → elbow → forearm → hand) ──
  function buildArm(side) {
    const shoulderX = side * 0.3;
    const shoulderY = 1.55;
    const shoulder = new THREE.Group();
    shoulder.position.set(shoulderX, shoulderY, 0);
    body.add(shoulder);
    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.05, 0.4, 8),
      skinMat
    );
    upper.position.y = -0.2; // hang below shoulder
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.42;
    shoulder.add(elbow);
    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.035, 0.38, 8),
      skinMat
    );
    forearm.position.y = -0.2;
    elbow.add(forearm);
    // claw hand
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      skinDarkMat
    );
    hand.position.y = -0.42;
    hand.scale.set(0.9, 1.1, 0.8);
    elbow.add(hand);
    // five claw fingers — thin cones
    for (let i = 0; i < 5; i++) {
      const claw = new THREE.Mesh(
        new THREE.ConeGeometry(0.012, 0.11, 5),
        skinDarkMat
      );
      const a = (i / 5 - 0.5) * 1.2;
      claw.position.set(Math.sin(a) * 0.06, -0.55, Math.cos(a) * 0.03);
      claw.rotation.x = Math.PI; // point down
      claw.rotation.z = a * 0.3;
      elbow.add(claw);
    }
    // blood on hand
    const handBlood = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 6, 5),
      bloodMat
    );
    handBlood.position.y = -0.48;
    handBlood.scale.set(1.1, 0.4, 1.0);
    elbow.add(handBlood);
    return { shoulder, elbow };
  }
  const armL = buildArm(-1);
  const armR = buildArm(1);

  // ── LEGS (hip → thigh → knee → shin → foot) ──
  function buildLeg(side) {
    const hipX = side * 0.12;
    const hip = new THREE.Group();
    hip.position.set(hipX, 0.88, 0);
    body.add(hip);
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.07, 0.42, 8),
      skinMat
    );
    thigh.position.y = -0.21;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.055, 0.4, 8),
      skinMat
    );
    shin.position.y = -0.21;
    knee.add(shin);
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.06, 0.22),
      skinDarkMat
    );
    foot.position.set(0, -0.44, 0.04);
    knee.add(foot);
    return { hip, knee };
  }
  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  root.add(body);
  root.visible = false;
  scene.add(root);

  MONSTER.root = root;
  MONSTER.parts = {
    body, headPivot, skirt,
    armL_shoulder: armL.shoulder, armL_elbow: armL.elbow,
    armR_shoulder: armR.shoulder, armR_elbow: armR.elbow,
    legL_hip: legL.hip, legL_knee: legL.knee,
    legR_hip: legR.hip, legR_knee: legR.knee,
    eyeGlowL, eyeGlowR
  };
}

function animateMonster(dt) {
  if (!MONSTER.root || !MONSTER.root.visible) return;
  const p = MONSTER.parts;
  // cycle speed scales with state
  let cycleRate = 2.0;
  let amp = 0.35;
  let armAmp = 0.35;
  let hunchZ = 0.0;
  let bobMul = 0.035;
  if (MONSTER.state === 'chase') { cycleRate = 6.0; amp = 0.75; armAmp = 0.9; hunchZ = 0.35; bobMul = 0.08; }
  else if (MONSTER.state === 'investigate') { cycleRate = 3.5; amp = 0.5; armAmp = 0.5; hunchZ = 0.12; bobMul = 0.05; }
  else if (MONSTER.state === 'patrol') { cycleRate = 2.5; amp = 0.4; armAmp = 0.35; }
  else if (MONSTER.state === 'idle') { cycleRate = 0.6; amp = 0.05; armAmp = 0.08; }
  else if (MONSTER.state === 'stunned') { cycleRate = 0.3; amp = 0.02; armAmp = 0.02; }

  MONSTER.phase += dt * cycleRate;
  const wave = Math.sin(MONSTER.phase);
  const wave2 = Math.sin(MONSTER.phase + Math.PI);

  // legs — opposing swing
  p.legL_hip.rotation.x = wave * amp;
  p.legR_hip.rotation.x = wave2 * amp;
  // knee bend only on back swing (phase when leg is going backward)
  p.legL_knee.rotation.x = Math.max(0, -wave * amp * 1.1);
  p.legR_knee.rotation.x = Math.max(0, -wave2 * amp * 1.1);

  // arms — opposing to legs
  p.armL_shoulder.rotation.x = wave2 * armAmp;
  p.armR_shoulder.rotation.x = wave * armAmp;
  // elbow — chase has thrashing arms
  if (MONSTER.state === 'chase') {
    p.armL_elbow.rotation.x = -0.3 + Math.sin(MONSTER.phase*2) * 0.4;
    p.armR_elbow.rotation.x = -0.3 + Math.sin(MONSTER.phase*2 + 1) * 0.4;
  } else {
    p.armL_elbow.rotation.x = -0.3 + Math.max(0, wave2 * 0.4);
    p.armR_elbow.rotation.x = -0.3 + Math.max(0, wave * 0.4);
  }

  // hunched forward when chasing
  p.body.rotation.x = hunchZ + Math.abs(wave) * 0.04;

  // bob
  p.body.position.y = Math.abs(wave) * bobMul;

  // head sway
  p.headPivot.rotation.y = Math.sin(MONSTER.phase * 0.4) * 0.2;
  // head tilt more when idle (searching)
  if (MONSTER.state === 'idle' || MONSTER.state === 'patrol') {
    p.headPivot.rotation.z = Math.sin(MONSTER.phase * 0.3) * 0.1;
  } else {
    p.headPivot.rotation.z = 0;
  }

  // skirt sway
  p.skirt.rotation.z = Math.sin(MONSTER.phase * 0.6) * 0.05;

  // eye glow intensity modulation
  const eyeBase = MONSTER.state === 'chase' ? 1.2 : MONSTER.state === 'investigate' ? 0.7 : 0.45;
  const flicker = 0.9 + Math.random() * 0.2;
  p.eyeGlowL.intensity = eyeBase * flicker;
  p.eyeGlowR.intensity = eyeBase * flicker;

  // apply world transform
  MONSTER.root.position.set(MONSTER.x, 0, MONSTER.z);
  MONSTER.root.rotation.y = MONSTER.facing;
}

buildMonster();

// ═══════════════════════════════════════════════════════════════════
//  PLAYER STATE
// ═══════════════════════════════════════════════════════════════════
const P = {
  x: 0, y: 1.7, z: 0,
  yaw: 0, pitch: 0,
  keys: {},
  hasKey: false,
  stamina: 1.0,
  battery: 1.0,
  flashOn: false,
  hiding: false,
  hideSpot: null,
  noteReading: false,
  noteCurrent: null,
  notesFoundThisLevel: 0,
  notesTotalThisLevel: 0,
  // sound emission — how recently player made noise (for AI hearing)
  noiseLevel: 0,
  bobPhase: 0,
};
let GAME = false, PAUSED = false;
let startTime = 0, levelStartTime = 0, totalTime = 0;
let flashTimer = 0, nextFlicker = 9, flickering = false, flickerEnd = 0;
let jsTriggered = false;

// ═══════════════════════════════════════════════════════════════════
//  DUST particles (level-scoped — rebuilt on each level)
// ═══════════════════════════════════════════════════════════════════
let dustGeo = null;
function buildDust() {
  const DCOUNT = Math.min(240, Math.floor(MAP_W * MAP_H / 20));
  const pos = new Float32Array(DCOUNT * 3);
  for (let i = 0; i < DCOUNT; i++) {
    pos[i*3]   = (Math.random() - 0.5) * MAP_W;
    pos[i*3+1] = Math.random() * CH;
    pos[i*3+2] = (Math.random() - 0.5) * MAP_H;
  }
  dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(dustGeo,
    new THREE.PointsMaterial({ color: 0xddc090, size: 0.03, transparent: true, opacity: 0.4 }));
  levelGroup.add(points);
}
function updateDust(dt) {
  if (!dustGeo) return;
  const d = dustGeo.attributes.position.array;
  const n = d.length / 3;
  for (let i = 0; i < n; i++) {
    d[i*3+1] -= dt * 0.05;
    d[i*3]   += (Math.random() - 0.5) * dt * 0.08;
    if (d[i*3+1] < 0) {
      d[i*3]   = (Math.random() - 0.5) * MAP_W;
      d[i*3+1] = CH;
      d[i*3+2] = (Math.random() - 0.5) * MAP_H;
    }
  }
  dustGeo.attributes.position.needsUpdate = true;
}

// ═══════════════════════════════════════════════════════════════════
//  AUDIO — trimmed essentials, spatial where it matters
// ═══════════════════════════════════════════════════════════════════
let AC = null;
let masterGain = null;
let userVolume = 0.7;

function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    AC.resume();
    masterGain = AC.createGain();
    masterGain.gain.value = userVolume;
    masterGain.connect(AC.destination);
  } catch (e) { AC = null; }
}

function osc(freq, type, vol, dur, dest) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g); g.connect(dest || masterGain);
  o.start(); o.stop(AC.currentTime + dur);
}
function noise(vol, dur, lo, hi, dest) {
  if (!AC) return;
  const buf = AC.createBuffer(1, Math.max(1, Math.floor(AC.sampleRate * dur)), AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  f.type = 'bandpass'; f.frequency.value = (lo + hi)/2; f.Q.value = 0.6;
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  s.buffer = buf; s.connect(f); f.connect(g); g.connect(dest || masterGain);
  s.start();
}

// ── ambient drone (always on when game is running) ──
let ambientNodes = [];
function startAmbient() {
  if (!AC) return;
  stopAmbient();
  const a = AC.createGain();
  a.gain.value = 0.45;
  a.connect(masterGain);
  ambientNodes.push(a);
  // two detuned saw drones
  [38.0, 47.3].forEach((f, i) => {
    const o = AC.createOscillator(), g = AC.createGain(), fl = AC.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f;
    const lfo = AC.createOscillator(), lfoG = AC.createGain();
    lfo.type = 'sine'; lfo.frequency.value = 0.08 + i*0.03; lfoG.gain.value = 1.2;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    fl.type = 'lowpass'; fl.frequency.value = 300;
    g.gain.value = 0.06;
    o.connect(fl); fl.connect(g); g.connect(a);
    lfo.start(); o.start();
    ambientNodes.push(o, lfo);
  });
}
function stopAmbient() {
  ambientNodes.forEach(n => { try { if (n.stop) n.stop(); } catch(e){} });
  ambientNodes = [];
}

// ── tense layer (fades in when monster is close but not chasing) ──
let tenseGain = null, tenseOsc = null;
function startTenseLayer() {
  if (!AC || tenseGain) return;
  tenseGain = AC.createGain();
  tenseGain.gain.value = 0.0;
  tenseGain.connect(masterGain);
  tenseOsc = AC.createOscillator();
  tenseOsc.type = 'sawtooth';
  tenseOsc.frequency.value = 55;
  const flt = AC.createBiquadFilter();
  flt.type = 'lowpass'; flt.frequency.value = 400;
  tenseOsc.connect(flt); flt.connect(tenseGain);
  tenseOsc.start();
}
function stopTenseLayer() {
  if (tenseOsc) { try { tenseOsc.stop(); } catch(e){} tenseOsc = null; }
  if (tenseGain) { try { tenseGain.disconnect(); } catch(e){} tenseGain = null; }
}

// ── chase layer (sharper strings when actively chased) ──
let chaseGain = null, chaseOscs = [];
function startChaseLayer() {
  if (!AC || chaseGain) return;
  chaseGain = AC.createGain();
  chaseGain.gain.value = 0.0;
  chaseGain.connect(masterGain);
  [110, 146.8, 220].forEach(f => {
    const o = AC.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = f;
    const g = AC.createGain(); g.gain.value = 0.04;
    const flt = AC.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 600; flt.Q.value = 2.5;
    o.connect(flt); flt.connect(g); g.connect(chaseGain);
    o.start();
    chaseOscs.push(o);
  });
}
function stopChaseLayer() {
  chaseOscs.forEach(o => { try { o.stop(); } catch(e){} });
  chaseOscs = [];
  if (chaseGain) { try { chaseGain.disconnect(); } catch(e){} chaseGain = null; }
}

// ── MONSTER SPATIAL AUDIO (panner) ──
let monsterPanner = null, monsterBreathOsc = null, monsterBreathGain = null;
function startMonsterSound() {
  if (!AC || monsterPanner) return;
  monsterPanner = AC.createPanner();
  monsterPanner.panningModel = 'HRTF';
  monsterPanner.distanceModel = 'inverse';
  monsterPanner.refDistance = 1.5;
  monsterPanner.maxDistance = 30;
  monsterPanner.rolloffFactor = 2.0;
  monsterPanner.connect(masterGain);
  // breathing: filtered noise with LFO
  const src = AC.createOscillator();
  src.type = 'sawtooth';
  src.frequency.value = 40;
  monsterBreathGain = AC.createGain();
  monsterBreathGain.gain.value = 0.0;
  const flt = AC.createBiquadFilter();
  flt.type = 'bandpass'; flt.frequency.value = 180; flt.Q.value = 3;
  // LFO on breath gain for rhythmic inhale/exhale
  const lfo = AC.createOscillator();
  lfo.type = 'sine'; lfo.frequency.value = 0.6;
  const lfoG = AC.createGain(); lfoG.gain.value = 0.08;
  lfo.connect(lfoG); lfoG.connect(monsterBreathGain.gain);
  src.connect(flt); flt.connect(monsterBreathGain); monsterBreathGain.connect(monsterPanner);
  src.start(); lfo.start();
  monsterBreathOsc = src;
}
function stopMonsterSound() {
  if (monsterBreathOsc) { try { monsterBreathOsc.stop(); } catch(e){} monsterBreathOsc = null; }
  if (monsterBreathGain) { try { monsterBreathGain.disconnect(); } catch(e){} monsterBreathGain = null; }
  if (monsterPanner) { try { monsterPanner.disconnect(); } catch(e){} monsterPanner = null; }
}
function updateMonsterAudio(dist, camX, camZ, camYaw) {
  if (!AC || !monsterPanner) return;
  // set listener position/orientation to camera
  if (AC.listener.positionX) {
    AC.listener.positionX.value = camX;
    AC.listener.positionY.value = 1.7;
    AC.listener.positionZ.value = camZ;
    AC.listener.forwardX.value = -Math.sin(camYaw);
    AC.listener.forwardY.value = 0;
    AC.listener.forwardZ.value = -Math.cos(camYaw);
    AC.listener.upX.value = 0; AC.listener.upY.value = 1; AC.listener.upZ.value = 0;
  } else if (AC.listener.setPosition) {
    AC.listener.setPosition(camX, 1.7, camZ);
    AC.listener.setOrientation(-Math.sin(camYaw), 0, -Math.cos(camYaw), 0, 1, 0);
  }
  if (monsterPanner.positionX) {
    monsterPanner.positionX.value = MONSTER.x;
    monsterPanner.positionY.value = 1.4;
    monsterPanner.positionZ.value = MONSTER.z;
  } else if (monsterPanner.setPosition) {
    monsterPanner.setPosition(MONSTER.x, 1.4, MONSTER.z);
  }
  // breathing volume ramps up as monster gets close
  if (monsterBreathGain) {
    const target = MONSTER.spawned
      ? Math.max(0, Math.min(0.6, (12 - dist) / 12)) * (MONSTER.state === 'chase' ? 1.4 : 1.0)
      : 0;
    monsterBreathGain.gain.setTargetAtTime(target, AC.currentTime, 0.3);
  }
}

// ── one-shot SFX ──
function heartbeat(v) {
  osc(52, 'sine', v, 0.1);
  setTimeout(() => osc(42, 'sine', v*0.6, 0.08), 130);
}
function keyPickupSound() {
  osc(880, 'sine', 0.18, 0.12);
  setTimeout(() => osc(1320, 'sine', 0.14, 0.15), 80);
  setTimeout(() => osc(1760, 'sine', 0.1,  0.2),  180);
}
function batteryPickupSound() {
  osc(660, 'triangle', 0.14, 0.15);
  setTimeout(() => osc(990, 'triangle', 0.1, 0.2), 90);
}
function notePickupSound() {
  noise(0.08, 0.25, 400, 2400);
}
function doorOpenSound() {
  for (let i = 0; i < 6; i++) setTimeout(() => osc(200+i*80, 'sawtooth', 0.08, 0.3), i*60);
  setTimeout(() => { for (let i = 0; i < 4; i++) setTimeout(() => osc(440+i*220, 'sine', 0.12, 0.4), i*100); }, 400);
}
function flashClick() {
  osc(1400, 'square', 0.04, 0.03);
}
function lockerClose() {
  noise(0.1, 0.2, 80, 500);
  setTimeout(() => osc(120, 'sine', 0.08, 0.15), 60);
}
function chaseSting() {
  for (let i = 0; i < 4; i++) {
    const o = AC ? AC.createOscillator() : null;
    if (!o) return;
    const g = AC.createGain();
    o.type = i < 2 ? 'sawtooth' : 'square';
    const fStart = 180 + i * 40 + Math.random() * 60;
    o.frequency.setValueAtTime(fStart, AC.currentTime);
    o.frequency.exponentialRampToValueAtTime(25, AC.currentTime + 1.8);
    g.gain.setValueAtTime(0.35 / (i+1), AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 1.8);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(AC.currentTime + 1.8);
  }
  noise(0.3, 0.5, 40, 600);
}
function deathScream() {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(380, AC.currentTime);
  o.frequency.linearRampToValueAtTime(820, AC.currentTime + 0.4);
  o.frequency.linearRampToValueAtTime(180, AC.currentTime + 1.6);
  f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2;
  g.gain.setValueAtTime(0, AC.currentTime);
  g.gain.linearRampToValueAtTime(0.18, AC.currentTime + 0.2);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 2.0);
  o.connect(f); f.connect(g); g.connect(masterGain);
  o.start(); o.stop(AC.currentTime + 2.0);
}
let footstepAlt = false;
function monsterFootstep(dist) {
  if (!AC || !monsterPanner) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'triangle';
  o.frequency.value = footstepAlt ? 70 : 60;
  footstepAlt = !footstepAlt;
  const vol = Math.max(0.04, Math.min(0.35, (20 - dist) / 40));
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.18);
  o.connect(g); g.connect(monsterPanner);
  o.start(); o.stop(AC.currentTime + 0.18);
}

// ═══════════════════════════════════════════════════════════════════
//  POST-PROCESSING — custom pipeline (no external examples)
//  Pass 1: render scene to RT
//  Pass 2: full-screen quad applies bloom-ish (threshold) + grain + vignette
//          + chromatic aberration + scanline (intensified during chase)
// ═══════════════════════════════════════════════════════════════════
let fxRT = null, fxScene = null, fxCam = null, fxMat = null;
let fxEnabled = true;

function initPostFX() {
  const w = renderer.domElement.width;
  const h = renderer.domElement.height;
  fxRT = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType
  });
  fxScene = new THREE.Scene();
  fxCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  fxMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: fxRT.texture },
      time:     { value: 0 },
      chase:    { value: 0 },
      resolution:{ value: new THREE.Vector2(w, h) },
      vignetteStrength: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float time;
      uniform float chase;
      uniform vec2  resolution;
      uniform float vignetteStrength;
      varying vec2  vUv;

      float rand(vec2 co) {
        return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
      }

      void main() {
        vec2 uv = vUv;
        // chromatic aberration — shift channels proportional to distance from center
        vec2 center = vec2(0.5, 0.5);
        vec2 dir = uv - center;
        float dist = length(dir);
        float caAmount = 0.0025 + chase * 0.012;
        vec3 col;
        col.r = texture2D(tDiffuse, uv - dir * caAmount).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uv + dir * caAmount).b;

        // cheap bloom: sample a blurred pass using neighbors then threshold
        vec3 blurSum = vec3(0.0);
        float texelX = 1.0 / resolution.x;
        float texelY = 1.0 / resolution.y;
        for (int i = -2; i <= 2; i++) {
          for (int j = -2; j <= 2; j++) {
            blurSum += texture2D(tDiffuse, uv + vec2(float(i)*texelX*2.0, float(j)*texelY*2.0)).rgb;
          }
        }
        blurSum /= 25.0;
        vec3 bright = max(blurSum - vec3(0.45), vec3(0.0));
        col += bright * (1.2 + chase * 0.8);

        // scanlines — sharper during chase
        float scan = sin(uv.y * resolution.y * 1.5) * 0.06 * (0.4 + chase * 1.2);
        col -= scan;

        // film grain
        float n = rand(uv + vec2(time * 0.2, -time * 0.13));
        col += (n - 0.5) * (0.10 + chase * 0.06);

        // chase red tint
        col.r += chase * 0.12 * (0.5 + 0.5 * sin(time * 8.0));
        col *= 1.0 - chase * 0.08;

        // vignette
        float vig = smoothstep(0.85, 0.2, dist);
        col *= mix(1.0, vig, 0.65 * vignetteStrength);

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fxMat);
  fxScene.add(quad);
}
initPostFX();

function resizePostFX() {
  const w = renderer.domElement.width, h = renderer.domElement.height;
  fxRT.setSize(w, h);
  if (fxMat) fxMat.uniforms.resolution.value.set(w, h);
}

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  resizePostFX();
  resizeJs();
});

// ═══════════════════════════════════════════════════════════════════
//  INPUT — keyboard, mouse, gamepad, mobile
// ═══════════════════════════════════════════════════════════════════
let mouseSens = 1.0;
let canPointerLock = true;

cvEl.addEventListener('click', () => {
  if (GAME && !PAUSED && !P.hiding && !P.noteReading) cvEl.requestPointerLock();
});
document.addEventListener('mousemove', e => {
  if (!GAME || PAUSED || P.noteReading || document.pointerLockElement !== cvEl) return;
  P.yaw   -= (e.movementX || 0) * .0022 * mouseSens;
  P.pitch -= (e.movementY || 0) * .0022 * mouseSens;
  P.pitch  = Math.max(-1.1, Math.min(1.1, P.pitch));
});

document.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    if (P.noteReading) { closeNote(); return; }
    if (GAME && !PAUSED) { pauseGame(); return; }
  }
  if (e.code === 'KeyE') {
    if (P.noteReading) { closeNote(); return; }
    handleInteract();
    return;
  }
  if (e.code === 'KeyF' && GAME && !PAUSED) {
    toggleFlashlight();
    return;
  }
  P.keys[e.code] = true;
});
document.addEventListener('keyup', e => P.keys[e.code] = false);

// Gamepad
let gamepadIndex = -1;
window.addEventListener('gamepadconnected', e => {
  gamepadIndex = e.gamepad.index;
  showHud('Gamepad ulandi: ' + e.gamepad.id, 3000);
});
window.addEventListener('gamepaddisconnected', () => { gamepadIndex = -1; });
let gpPrev = { a: false, b: false, y: false, x: false, start: false, lb: false };
function pollGamepad(dt) {
  if (gamepadIndex < 0) return { mx: 0, mz: 0, sprint: false };
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = gps[gamepadIndex];
  if (!gp) return { mx: 0, mz: 0, sprint: false };
  // left stick — move
  const lx = Math.abs(gp.axes[0]) > 0.15 ? gp.axes[0] : 0;
  const ly = Math.abs(gp.axes[1]) > 0.15 ? gp.axes[1] : 0;
  // right stick — look
  const rx = Math.abs(gp.axes[2]) > 0.12 ? gp.axes[2] : 0;
  const ry = Math.abs(gp.axes[3]) > 0.12 ? gp.axes[3] : 0;
  if (GAME && !PAUSED && !P.noteReading) {
    P.yaw   -= rx * dt * 2.4 * mouseSens;
    P.pitch -= ry * dt * 2.0 * mouseSens;
    P.pitch  = Math.max(-1.1, Math.min(1.1, P.pitch));
  }
  const sprint = gp.buttons[6]?.pressed || gp.buttons[10]?.pressed;
  const a = !!gp.buttons[0]?.pressed, b = !!gp.buttons[1]?.pressed;
  const y = !!gp.buttons[3]?.pressed, x = !!gp.buttons[2]?.pressed;
  const start = !!gp.buttons[9]?.pressed;
  if (a && !gpPrev.a) { handleInteract(); }
  if (x && !gpPrev.x) { toggleFlashlight(); }
  if (start && !gpPrev.start) {
    if (P.noteReading) closeNote();
    else if (GAME && !PAUSED) pauseGame();
    else if (PAUSED) resumeGame();
  }
  gpPrev = { a, b, x, y, start, lb: false };
  return { mx: lx, mz: ly, sprint: !!sprint };
}

// ── Mobile controls ──
const JS = { active: false, x: 0, y: 0, id: -1, ox: 0, oy: 0 };
let mobFlashPressed = false, mobSprintPressed = false;

(function setupMobile() {
  const isMob = /Android|iPhone|iPad|Touch/i.test(navigator.userAgent) ||
    window.matchMedia('(pointer:coarse)').matches;
  if (!isMob) return;
  document.getElementById('mob').style.display = 'block';
  const zone = document.getElementById('jZone'), knob = document.getElementById('jKnob'), R = 60;
  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.changedTouches[0], rect = zone.getBoundingClientRect();
    JS.active = true; JS.id = t.identifier; JS.ox = rect.left + R; JS.oy = rect.top + R;
  }, { passive: false });
  zone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== JS.id) continue;
      const dx = t.clientX - JS.ox, dy = t.clientY - JS.oy;
      const d = Math.sqrt(dx*dx + dy*dy);
      const nx = d > R ? (dx/d)*R : dx, ny = d > R ? (dy/d)*R : dy;
      JS.x = nx / R; JS.y = ny / R;
      knob.style.transform = `translate(calc(-50% + ${nx}px),calc(-50% + ${ny}px))`;
    }
  }, { passive: false });
  ['touchend','touchcancel'].forEach(ev => zone.addEventListener(ev, e => {
    for (const t of e.changedTouches) if (t.identifier === JS.id) {
      JS.active = false; JS.x = 0; JS.y = 0;
      knob.style.transform = 'translate(-50%,-50%)';
    }
  }));
  const lz = document.getElementById('lZone');
  let lA = false, lx = 0, ly = 0;
  lz.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; lx = t.clientX; ly = t.clientY; lA = true; }, { passive:false });
  lz.addEventListener('touchmove', e => {
    e.preventDefault(); if (!lA || !GAME || PAUSED) return;
    const t = e.changedTouches[0];
    P.yaw   -= (t.clientX - lx) * .005 * mouseSens;
    P.pitch -= (t.clientY - ly) * .005 * mouseSens;
    P.pitch  = Math.max(-1.1, Math.min(1.1, P.pitch));
    lx = t.clientX; ly = t.clientY;
  }, { passive: false });
  lz.addEventListener('touchend', () => lA = false);

  document.getElementById('mobFlash').addEventListener('touchstart', e => {
    e.preventDefault(); toggleFlashlight();
  }, { passive: false });
  document.getElementById('mobInteract').addEventListener('touchstart', e => {
    e.preventDefault(); handleInteract();
  }, { passive: false });
  const sprintBtn = document.getElementById('mobSprint');
  sprintBtn.addEventListener('touchstart', e => { e.preventDefault(); mobSprintPressed = true; }, { passive: false });
  sprintBtn.addEventListener('touchend',   () => { mobSprintPressed = false; });
})();

// ═══════════════════════════════════════════════════════════════════
//  FLASHLIGHT + BATTERY
// ═══════════════════════════════════════════════════════════════════
let flashlightIntensity = 1.4;

function toggleFlashlight() {
  if (!GAME || PAUSED || P.hiding) return;
  if (P.battery <= 0 && !P.flashOn) { showHud('BATAREYA TUGADI', 1600); return; }
  P.flashOn = !P.flashOn;
  flashClick();
  // flashlight click = noise event — monster can investigate
  if (P.flashOn) raiseNoise(0.4);
}

function updateFlashlight(dt) {
  if (P.flashOn) {
    P.battery -= dt * 0.025; // ~40s to empty
    if (P.battery <= 0) { P.battery = 0; P.flashOn = false; flashClick(); showHud('BATAREYA TUGADI', 2000); }
  }
  const target = (P.flashOn && !P.hiding) ? flashlightIntensity : 0;
  flashlight.intensity += (target - flashlight.intensity) * Math.min(1, dt * 8);
  flashlight.position.set(P.x, P.y - 0.1, P.z);
  const fx = P.x - Math.sin(P.yaw) * Math.cos(P.pitch);
  const fy = P.y - 0.1 + Math.sin(P.pitch);
  const fz = P.z - Math.cos(P.yaw) * Math.cos(P.pitch);
  flashTarget.position.set(fx, fy, fz);
  document.getElementById('batteryFill').style.width = (P.battery * 100).toFixed(0) + '%';
  const fill = document.getElementById('batteryFill');
  fill.style.background = P.battery < 0.2 ? 'linear-gradient(90deg,#cc2200,#ff6644)' : 'linear-gradient(90deg,#ffcc22,#ffeeaa)';
  document.getElementById('flashIco').querySelector('.label').textContent = '🔦 ' + (P.flashOn ? 'ON' : 'OFF');
}

// ═══════════════════════════════════════════════════════════════════
//  STAMINA
// ═══════════════════════════════════════════════════════════════════
function updateStamina(dt, sprinting, moving) {
  if (sprinting && moving) {
    P.stamina -= dt * 0.28;
    if (P.stamina < 0) P.stamina = 0;
  } else {
    P.stamina += dt * (moving ? 0.12 : 0.22);
    if (P.stamina > 1) P.stamina = 1;
  }
  const fill = document.getElementById('staminaFill');
  fill.style.width = (P.stamina * 100).toFixed(0) + '%';
  fill.style.background = P.stamina < 0.25
    ? 'linear-gradient(90deg,#cc4422,#ff8866)'
    : 'linear-gradient(90deg,#33dd77,#88ff99)';
}

// ═══════════════════════════════════════════════════════════════════
//  HIDING SPOTS
// ═══════════════════════════════════════════════════════════════════
function findNearestHideSpot() {
  let best = null, bestD = 1.6;
  for (const h of hidingSpots) {
    const d = Math.hypot(P.x - h.worldX, P.z - h.worldZ);
    if (d < bestD) { bestD = d; best = h; }
  }
  return best;
}

function enterHide(spot) {
  P.hiding = true; P.hideSpot = spot; spot.occupied = true;
  P.x = spot.worldX; P.z = spot.worldZ;
  P.flashOn = false; // can't flashlight while hiding
  lockerClose();
  document.getElementById('hideOverlay').style.display = 'flex';
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
}
function exitHide() {
  if (!P.hiding) return;
  if (P.hideSpot) P.hideSpot.occupied = false;
  P.hiding = false; P.hideSpot = null;
  lockerClose();
  document.getElementById('hideOverlay').style.display = 'none';
  if (GAME && !PAUSED) cvEl.requestPointerLock();
}

// ═══════════════════════════════════════════════════════════════════
//  NOTE READING
// ═══════════════════════════════════════════════════════════════════
function openNote(note) {
  P.noteReading = true;
  P.noteCurrent = note;
  document.getElementById('noteTitle').textContent = note.title;
  document.getElementById('noteBody').textContent = note.text;
  document.getElementById('noteReader').style.display = 'flex';
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
}
function closeNote() {
  P.noteReading = false;
  document.getElementById('noteReader').style.display = 'none';
  if (GAME && !PAUSED) cvEl.requestPointerLock();
}

// ═══════════════════════════════════════════════════════════════════
//  INTERACTION (E / gamepad A / mobile button)
// ═══════════════════════════════════════════════════════════════════
function handleInteract() {
  if (!GAME || PAUSED) return;
  // In hide spot — exit
  if (P.hiding) { exitHide(); return; }
  // Nearby note
  for (const n of notePickups) {
    if (n.taken) continue;
    const d = Math.hypot(P.x - n.worldX, P.z - n.worldZ);
    if (d < 1.0) {
      n.taken = true;
      n.group.visible = false;
      P.notesFoundThisLevel++;
      updateNoteCount();
      notePickupSound();
      openNote(n);
      return;
    }
  }
  // Nearby hide spot
  const h = findNearestHideSpot();
  if (h && !h.occupied) { enterHide(h); return; }
}

function updateInteractHud() {
  if (P.hiding || P.noteReading || PAUSED) {
    document.getElementById('interactHud').style.display = 'none';
    return;
  }
  const hud = document.getElementById('interactHud');
  for (const n of notePickups) {
    if (n.taken) continue;
    const d = Math.hypot(P.x - n.worldX, P.z - n.worldZ);
    if (d < 1.0) { hud.textContent = '[ E ] — xatni o\'qish'; hud.style.display = 'block'; return; }
  }
  const h = findNearestHideSpot();
  if (h && !h.occupied) { hud.textContent = '[ E ] — yashirinish'; hud.style.display = 'block'; return; }
  hud.style.display = 'none';
}

function updateNoteCount() {
  document.getElementById('noteCount').textContent = P.notesFoundThisLevel + ' / ' + P.notesTotalThisLevel;
}

// ═══════════════════════════════════════════════════════════════════
//  NOISE (player makes noise when sprinting / opening flashlight)
// ═══════════════════════════════════════════════════════════════════
function raiseNoise(amount) {
  P.noiseLevel = Math.max(P.noiseLevel, amount);
}

// ═══════════════════════════════════════════════════════════════════
//  MONSTER AI
// ═══════════════════════════════════════════════════════════════════
function monsterSpawnBehindPlayer() {
  // find farthest accessible tile
  const candidates = allFloorTiles();
  const pt = worldToTile(P.x, P.z);
  let best = null, bestScore = -1;
  for (const t of candidates) {
    const d = Math.abs(t.gx - pt.gx) + Math.abs(t.gz - pt.gz);
    if (d > bestScore) { bestScore = d; best = t; }
  }
  const c = tileCenter(best.gx, best.gz);
  MONSTER.x = c.x; MONSTER.z = c.z;
  MONSTER.y = 0;
  MONSTER.root.visible = true;
  MONSTER.spawned = true;
  MONSTER.state = 'chase';
  MONSTER.stateStartTime = performance.now();
}

function monsterGotoRandomWaypoint() {
  if (!monsterWaypoints.length) return;
  MONSTER.patrolIndex = (MONSTER.patrolIndex + 1) % monsterWaypoints.length;
  const wp = monsterWaypoints[MONSTER.patrolIndex];
  repathTo(wp.gx, wp.gz);
}

function repathTo(gx, gz) {
  const mt = worldToTile(MONSTER.x, MONSTER.z);
  MONSTER.targetPath = aStar(mt.gx, mt.gz, gx, gz);
  MONSTER.pathIndex = 0;
}

function monsterCanSeePlayer() {
  if (!MONSTER.spawned) return false;
  // simple LOS: step from monster to player; any wall blocks it
  const mx = MONSTER.x, mz = MONSTER.z;
  const px = P.x, pz = P.z;
  const dx = px - mx, dz = pz - mz;
  const dist = Math.hypot(dx, dz);
  if (dist > 18) return false; // visibility cap
  const steps = Math.ceil(dist / 0.4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sx = mx + dx * t, sz = mz + dz * t;
    if (tileAt(sx, sz) === '1') return false;
  }
  return true;
}

function updateMonsterAI(dt) {
  if (!GAME || jsTriggered || !MONSTER.spawned) return;
  const mx = MONSTER.x, mz = MONSTER.z;
  const px = P.x, pz = P.z;
  const dist = Math.hypot(px - mx, pz - mz);

  // ── Player making noise while sprinting triggers investigation ──
  if (P.noiseLevel > 0 && MONSTER.state !== 'chase' && !P.hiding) {
    const pt = worldToTile(P.x, P.z);
    // monster only investigates if noise is close enough
    if (dist < 12 * (1 + P.noiseLevel)) {
      MONSTER.investigateTarget = { gx: pt.gx, gz: pt.gz };
      MONSTER.state = 'investigate';
      MONSTER.stateStartTime = performance.now();
      repathTo(pt.gx, pt.gz);
    }
  }
  // noise decays
  P.noiseLevel = Math.max(0, P.noiseLevel - dt * 0.6);

  // ── Sight check: if monster sees player (and player not hiding) → chase ──
  if (!P.hiding && monsterCanSeePlayer()) {
    if (MONSTER.state !== 'chase') {
      MONSTER.state = 'chase';
      MONSTER.stateStartTime = performance.now();
      chaseSting();
      MONSTER.lastSeenPlayer = performance.now();
    }
  } else if (MONSTER.state === 'chase') {
    // lost sight — stay in chase briefly, then degrade to investigate at last known pos
    if (performance.now() - MONSTER.lastSeenPlayer > 3500) {
      MONSTER.state = 'investigate';
      const pt = worldToTile(P.x, P.z);
      MONSTER.investigateTarget = { gx: pt.gx, gz: pt.gz };
      repathTo(pt.gx, pt.gz);
    }
  }
  if (MONSTER.state === 'chase') MONSTER.lastSeenPlayer = performance.now();

  // ── Collision with player ──
  if (!P.hiding && dist < 0.95 && MONSTER.state === 'chase') {
    triggerGameOver();
    return;
  }
  // Hiding: if monster is standing next to locker, small chance to detect (based on noise)
  if (P.hiding && MONSTER.state === 'chase' && dist < 1.5 && P.noiseLevel > 0.4) {
    triggerGameOver();
    return;
  }

  // ── Movement ──
  const lv = LEVELS[currentLevel];
  let speed = lv.spd;
  if (MONSTER.state === 'chase') speed *= 1.1;
  else if (MONSTER.state === 'investigate') speed *= 0.7;
  else if (MONSTER.state === 'patrol') speed *= 0.55;
  else if (MONSTER.state === 'idle') speed = 0;
  else if (MONSTER.state === 'stunned') speed = 0;

  if (MONSTER.state === 'chase') {
    // direct chase with simple wall-slide
    const dx = px - mx, dz = pz - mz;
    const len = Math.max(0.01, Math.hypot(dx, dz));
    const step = speed * dt;
    const nx = mx + (dx/len) * step;
    const nz = mz + (dz/len) * step;
    if (inMap(nx, mz, 0.4)) MONSTER.x = nx;
    else if (inMap(mx, nz, 0.4)) MONSTER.z = nz;
    else if (inMap(nx, mz + 0.4, 0.4)) { MONSTER.z += 0.06; MONSTER.x = nx; }
    else if (inMap(nx, mz - 0.4, 0.4)) { MONSTER.z -= 0.06; MONSTER.x = nx; }
    if (inMap(MONSTER.x, nz, 0.4)) MONSTER.z = nz;
    MONSTER.facing = Math.atan2(dx, dz);
  } else if (MONSTER.state === 'patrol' || MONSTER.state === 'investigate') {
    // follow path
    if (!MONSTER.targetPath || MONSTER.pathIndex >= MONSTER.targetPath.length) {
      if (MONSTER.state === 'investigate') {
        // reached investigation target — return to patrol
        MONSTER.state = 'patrol';
        monsterGotoRandomWaypoint();
      } else {
        monsterGotoRandomWaypoint();
      }
    } else {
      const node = MONSTER.targetPath[MONSTER.pathIndex];
      const target = tileCenter(node.gx, node.gz);
      const dx = target.x - mx, dz = target.z - mz;
      const len = Math.hypot(dx, dz);
      if (len < 0.3) {
        MONSTER.pathIndex++;
      } else {
        const step = speed * dt;
        MONSTER.x += (dx/len) * step;
        MONSTER.z += (dz/len) * step;
        MONSTER.facing = Math.atan2(dx, dz);
      }
    }
  }

  // footstep sounds on step intervals
  MONSTER.footstepTimer += dt;
  const stepInterval = MONSTER.state === 'chase' ? 0.28 : MONSTER.state === 'investigate' ? 0.45 : 0.7;
  if (MONSTER.state !== 'idle' && MONSTER.state !== 'stunned' && MONSTER.footstepTimer > stepInterval) {
    monsterFootstep(dist);
    MONSTER.footstepTimer = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PLAYER MOVEMENT
// ═══════════════════════════════════════════════════════════════════
function updatePlayer(dt) {
  if (P.hiding || P.noteReading || PAUSED || !GAME) {
    camera.position.set(P.x, P.y, P.z);
    camera.rotation.y = P.yaw;
    camera.rotation.x = P.pitch;
    playerLight.position.set(P.x, P.y, P.z);
    return;
  }
  const sY = Math.sin(P.yaw), cY = Math.cos(P.yaw);
  let mx = 0, mz = 0;
  if (P.keys['KeyW'] || P.keys['ArrowUp'])   { mx -= sY; mz -= cY; }
  if (P.keys['KeyS'] || P.keys['ArrowDown']) { mx += sY; mz += cY; }
  if (P.keys['KeyA'] || P.keys['ArrowLeft']) { mx -= cY; mz += sY; }
  if (P.keys['KeyD'] || P.keys['ArrowRight']){ mx += cY; mz -= sY; }
  if (JS.active) { mx += JS.x * (-sY) + JS.y * (-cY);
                   mz += JS.x * (-cY) + JS.y * ( sY);
                   // no: simpler to just use forward/strafe from joystick
                 }
  // gamepad movement (overrides if stick pressed)
  const gp = pollGamepad(dt);
  if (Math.abs(gp.mx) > 0.01 || Math.abs(gp.mz) > 0.01) {
    mx = 0; mz = 0;
    mx += gp.mx * cY + gp.mz * (-sY);
    mz += gp.mx * (-sY) + gp.mz * (-cY);
  }
  if (JS.active) {
    mx = JS.x * cY + JS.y * (-sY);
    mz = JS.x * (-sY) + JS.y * (-cY);
  }

  const len = Math.sqrt(mx*mx + mz*mz);
  const moving = len > 0.08;
  const wantSprint = (P.keys['ShiftLeft'] || P.keys['ShiftRight'] || gp.sprint || mobSprintPressed);
  const canSprint = wantSprint && moving && P.stamina > 0.02;
  const sprinting = canSprint;
  const speed = sprinting ? SPRINT_SPD : WALK_SPD;

  if (moving) {
    const invL = 1 / len;
    const vx = mx * invL * speed * dt;
    const vz = mz * invL * speed * dt;
    if (inMap(P.x + vx, P.z, PLAYER_R)) P.x += vx;
    if (inMap(P.x, P.z + vz, PLAYER_R)) P.z += vz;
    P.bobPhase += dt * (sprinting ? 10 : 6);
    const bob = Math.sin(P.bobPhase) * (sprinting ? 0.08 : 0.045);
    P.y = 1.7 + bob;
    // sprinting raises noise considerably
    if (sprinting) raiseNoise(0.5);
    else           raiseNoise(0.04);
  } else {
    P.y += (1.7 - P.y) * Math.min(1, dt * 6);
  }
  camera.position.set(P.x, P.y, P.z);
  camera.rotation.y = P.yaw;
  camera.rotation.x = P.pitch;
  playerLight.position.set(P.x, P.y, P.z);

  updateStamina(dt, sprinting, moving);
}

// ═══════════════════════════════════════════════════════════════════
//  LIGHTING — level settings + flicker
// ═══════════════════════════════════════════════════════════════════
let userBrightness = 1.0;

function applyLevelLighting() {
  const lv = LEVELS[currentLevel];
  hemi.intensity    = BASE_HEMI    * lv.lm * userBrightness;
  ambient.intensity = BASE_AMBIENT * lv.lm * userBrightness;
  playerLight.intensity = BASE_PLAYER * lv.lm * userBrightness;
  hemi.color.setHex(lv.ambientColor);
  ceilingLights.forEach(l => l.intensity = BASE_CEIL * lv.lm * userBrightness);
  scene.fog.color.setHex(lv.fogColor);
  scene.background.setHex(lv.fogColor);
  scene.fog.density = BASE_FOG * lv.fm;
  // panel dimming
  const pi = Math.max(0.15, lv.lm);
  const r = Math.floor(0xcc * pi), gg = Math.floor(0xb0 * pi), b = Math.floor(0x80 * pi);
  const col = (r << 16) | (gg << 8) | b;
  lightPanels.forEach(p => p.material.color.setHex(col));
}

function updateFlicker(dt) {
  flashTimer += dt;
  const lv = LEVELS[currentLevel];
  if (!flickering && flashTimer > nextFlicker) {
    flickering = true;
    flickerEnd = flashTimer + 0.08 + Math.random() * 0.22;
    noise(0.05, 0.12, 80, 4000);
  }
  if (flickering) {
    const on = Math.random() < 0.55;
    const k = on ? 1 : 0.3;
    ceilingLights.forEach(l => l.intensity = BASE_CEIL * lv.lm * userBrightness * k);
    if (flashTimer > flickerEnd) {
      flickering = false;
      ceilingLights.forEach(l => l.intensity = BASE_CEIL * lv.lm * userBrightness);
      flashTimer = 0;
      nextFlicker = (10 + Math.random() * 14) / lv.flickerMul;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  JUMPSCARE
// ═══════════════════════════════════════════════════════════════════
const jsCv = document.getElementById('jsC'), jsCtx = jsCv.getContext('2d');
let jsAnim = false, jsStart = 0, jsCb = null;
function resizeJs() { jsCv.width = innerWidth; jsCv.height = innerHeight; }
resizeJs();
function drawJsFace(p) {
  const W = jsCv.width, H = jsCv.height;
  jsCtx.clearRect(0,0,W,H);
  const sh = (1 - p) * 25;
  jsCtx.save();
  jsCtx.translate((Math.random()-.5)*sh, (Math.random()-.5)*sh);
  jsCtx.fillStyle = '#000';
  jsCtx.fillRect(-sh*2, -sh*2, W+sh*4, H+sh*4);
  const cx = W/2, cy = H/2, r = Math.min(W,H) * .44 * (0.18 + p*0.9);
  const grd = jsCtx.createRadialGradient(cx, cy, r*.1, cx, cy, r*2.2);
  grd.addColorStop(0, 'rgba(160,10,10,.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  jsCtx.fillStyle = grd; jsCtx.fillRect(0,0,W,H);
  // head
  jsCtx.fillStyle = '#b0a89a';
  jsCtx.beginPath(); jsCtx.ellipse(cx, cy-r*.08, r*.78, r, 0, 0, Math.PI*2); jsCtx.fill();
  // hair
  jsCtx.fillStyle = '#05030a';
  jsCtx.beginPath(); jsCtx.ellipse(cx, cy-r*.7, r*.85, r*.5, 0, 0, Math.PI*2); jsCtx.fill();
  // eyes
  if (p > .1) {
    const ea = Math.min(1, (p-.1)/.22);
    jsCtx.fillStyle = `rgba(0,0,0,${ea})`;
    jsCtx.beginPath(); jsCtx.ellipse(cx-r*.28, cy-r*.12, r*.18, r*.13, 0, 0, Math.PI*2); jsCtx.fill();
    jsCtx.beginPath(); jsCtx.ellipse(cx+r*.28, cy-r*.12, r*.18, r*.13, 0, 0, Math.PI*2); jsCtx.fill();
    const eg1 = jsCtx.createRadialGradient(cx-r*.28, cy-r*.12, 1, cx-r*.28, cy-r*.12, r*.15);
    eg1.addColorStop(0, `rgba(255,80,40,${ea})`);
    eg1.addColorStop(0.5, `rgba(200,10,0,${ea*0.8})`);
    eg1.addColorStop(1, 'rgba(60,0,0,0)');
    jsCtx.fillStyle = eg1; jsCtx.fillRect(cx-r*.45, cy-r*.28, r*.34, r*.32);
    const eg2 = jsCtx.createRadialGradient(cx+r*.28, cy-r*.12, 1, cx+r*.28, cy-r*.12, r*.15);
    eg2.addColorStop(0, `rgba(255,80,40,${ea})`);
    eg2.addColorStop(0.5, `rgba(200,10,0,${ea*0.8})`);
    eg2.addColorStop(1, 'rgba(60,0,0,0)');
    jsCtx.fillStyle = eg2; jsCtx.fillRect(cx+r*.11, cy-r*.28, r*.34, r*.32);
  }
  // mouth
  if (p > .28) {
    const ma = Math.min(1, (p-.28)/.22);
    jsCtx.fillStyle = `rgba(10,0,0,${ma})`;
    jsCtx.beginPath(); jsCtx.ellipse(cx, cy+r*.23, r*.5, r*.15, 0, 0, Math.PI*2); jsCtx.fill();
    jsCtx.fillStyle = `rgba(200,186,160,${ma})`;
    for (let i = 0; i < 11; i++) {
      const tx = cx - r*.44 + i*r*.09;
      jsCtx.beginPath();
      jsCtx.moveTo(tx - r*.03, cy + r*.16);
      jsCtx.lineTo(tx + r*.03, cy + r*.16);
      jsCtx.lineTo(tx, cy + r*.32);
      jsCtx.fill();
    }
    jsCtx.fillStyle = `rgba(200,16,10,${ma})`;
    jsCtx.beginPath();
    jsCtx.moveTo(cx - r*.48, cy + r*.18);
    jsCtx.bezierCurveTo(cx - r*.3, cy + r*.55, cx + r*.3, cy + r*.55, cx + r*.48, cy + r*.18);
    jsCtx.bezierCurveTo(cx + r*.2, cy + r*.3, cx - r*.2, cy + r*.3, cx - r*.48, cy + r*.18);
    jsCtx.fill();
  }
  if (p > .05) {
    jsCtx.strokeStyle = `rgba(200,0,0,${p*.25})`;
    jsCtx.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
      jsCtx.beginPath();
      jsCtx.moveTo(Math.random()*W, Math.random()*H);
      jsCtx.lineTo(Math.random()*W, Math.random()*H);
      jsCtx.stroke();
    }
  }
  jsCtx.restore();
}
function runJumpscare(cb) {
  jsAnim = true; jsStart = performance.now(); jsCb = cb;
  document.getElementById('jsOver').style.display = 'block';
  requestAnimationFrame(jsFrame);
}
function jsFrame(now) {
  if (!jsAnim) return;
  const p = Math.min(1, (now - jsStart)/2300);
  drawJsFace(p);
  if (p < 1) requestAnimationFrame(jsFrame);
  else { jsAnim = false; document.getElementById('jsOver').style.display = 'none'; jsCb && jsCb(); }
}

// ═══════════════════════════════════════════════════════════════════
//  GAME OVER / LEVEL FLOW
// ═══════════════════════════════════════════════════════════════════
let hudTimer = null;
function showHud(msg, ms = 3000) {
  const h = document.getElementById('hud');
  h.textContent = msg; h.style.opacity = '1';
  clearTimeout(hudTimer);
  hudTimer = setTimeout(() => h.style.opacity = '0', ms);
}

function fmtTime(s) {
  const m = Math.floor(s/60), ss = s % 60;
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

function triggerGameOver() {
  if (jsTriggered) return;
  jsTriggered = true; GAME = false;
  deathScream();
  hemi.intensity = 0.05;
  ambient.intensity = 0.03;
  ceilingLights.forEach(l => l.intensity = 0);
  stopAmbient(); stopTenseLayer(); stopChaseLayer();
  setTimeout(() => runJumpscare(showGameOver), 260);
}

function showGameOver() {
  const s = Math.floor((Date.now() - levelStartTime)/1000);
  document.getElementById('goTime').textContent = `Level ${LEVELS[currentLevel].n} — ${fmtTime(s)}`;
  document.getElementById('gameOver').style.display = 'flex';
  document.getElementById('bottomBar').style.display = 'none';
  document.getElementById('levelHud').style.display = 'none';
  document.getElementById('timerHud').style.display = 'none';
  document.body.classList.remove('chase');
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
}

function levelComplete() {
  if (!GAME) return;
  GAME = false;
  const s = Math.floor((Date.now() - levelStartTime)/1000);
  totalTime += s;
  stopAmbient(); stopTenseLayer(); stopChaseLayer(); stopMonsterSound();
  document.body.classList.remove('chase');
  document.getElementById('bottomBar').style.display = 'none';
  document.getElementById('levelHud').style.display = 'none';
  document.getElementById('timerHud').style.display = 'none';
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
  // save best time
  const prev = getBestTime(currentLevel);
  const newBest = (prev === null || s < prev);
  if (newBest) setBestTime(currentLevel, s);
  if (currentLevel >= LEVELS.length - 1) {
    document.getElementById('fwMsg').textContent =
      `Barcha 5 levelni tugatdingiz!\nJami vaqt: ${fmtTime(totalTime)}\n\nEng yaxshi vaqtlar:\n` +
      LEVELS.map((lv, i) => ` L${lv.n}: ${fmtTime(getBestTime(i)||0)}`).join('\n');
    document.getElementById('finalWin').style.display = 'flex';
  } else {
    document.getElementById('lcTitle').textContent = `LEVEL ${LEVELS[currentLevel].n} TUGADI`;
    let msg = `Vaqt: ${fmtTime(s)}\nXatlar: ${P.notesFoundThisLevel}/${P.notesTotalThisLevel}\nKeyingi level: ${LEVELS[currentLevel+1].name} (${LEVELS[currentLevel+1].n}/5)`;
    document.getElementById('lcMsg').textContent = msg;
    document.getElementById('lcBest').textContent = newBest
      ? '★ YANGI REKORD!'
      : (prev !== null ? `Eng yaxshi: ${fmtTime(prev)}` : '');
    document.getElementById('levelComplete').style.display = 'flex';
  }
}

function nextLevel() {
  document.getElementById('levelComplete').style.display = 'none';
  currentLevel++;
  resetState();
  cvEl.requestPointerLock();
}

function restartFromLevel1() {
  ['gameOver','levelComplete','finalWin'].forEach(id => document.getElementById(id).style.display = 'none');
  currentLevel = 0;
  totalTime = 0;
  resetState();
  cvEl.requestPointerLock();
}

function quitToMenu() {
  GAME = false; PAUSED = false;
  document.getElementById('pauseMenu').style.display = 'none';
  document.getElementById('startScreen').style.display = 'flex';
  document.getElementById('bottomBar').style.display = 'none';
  document.getElementById('levelHud').style.display = 'none';
  document.getElementById('timerHud').style.display = 'none';
  document.body.classList.remove('chase');
  stopAmbient(); stopTenseLayer(); stopChaseLayer(); stopMonsterSound();
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
}

function pauseGame() {
  if (!GAME || PAUSED) return;
  PAUSED = true;
  document.getElementById('pauseMenu').style.display = 'flex';
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
}
function resumeGame() {
  if (!PAUSED) return;
  PAUSED = false;
  document.getElementById('pauseMenu').style.display = 'none';
  document.getElementById('settingsModal').style.display = 'none';
  if (GAME) cvEl.requestPointerLock();
}

// ═══════════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════════
function openSettings() {
  // hydrate from stored values
  document.getElementById('sSens').value = mouseSens;
  document.getElementById('sVol').value = userVolume;
  document.getElementById('sBright').value = userBrightness;
  document.getElementById('sFx').value = fxEnabled ? '1' : '0';
  document.getElementById('sFlash').value = flashlightIntensity;
  document.getElementById('settingsModal').style.display = 'flex';
}
function closeSettings() {
  document.getElementById('settingsModal').style.display = 'none';
  saveSettings();
}
document.addEventListener('DOMContentLoaded', () => {});
function bindSettings() {
  document.getElementById('sSens').addEventListener('input', e => mouseSens = parseFloat(e.target.value));
  document.getElementById('sVol').addEventListener('input', e => {
    userVolume = parseFloat(e.target.value);
    if (masterGain) masterGain.gain.value = userVolume;
  });
  document.getElementById('sBright').addEventListener('input', e => {
    userBrightness = parseFloat(e.target.value);
    applyLevelLighting();
  });
  document.getElementById('sFx').addEventListener('change', e => {
    fxEnabled = e.target.value === '1';
  });
  document.getElementById('sFlash').addEventListener('input', e => flashlightIntensity = parseFloat(e.target.value));
}
function loadSettings() {
  try {
    const j = JSON.parse(localStorage.getItem('br_settings') || '{}');
    if (j.sens) mouseSens = j.sens;
    if (j.vol !== undefined) userVolume = j.vol;
    if (j.bright) userBrightness = j.bright;
    if (j.fx !== undefined) fxEnabled = !!j.fx;
    if (j.flash) flashlightIntensity = j.flash;
  } catch(e) {}
}
function saveSettings() {
  try {
    localStorage.setItem('br_settings', JSON.stringify({
      sens: mouseSens, vol: userVolume, bright: userBrightness, fx: fxEnabled, flash: flashlightIntensity
    }));
  } catch(e) {}
}
loadSettings();
bindSettings();

// ═══════════════════════════════════════════════════════════════════
//  BEST TIMES (per-level localStorage)
// ═══════════════════════════════════════════════════════════════════
function getBestTime(levelIdx) {
  try {
    const j = JSON.parse(localStorage.getItem('br_bestTimes') || '{}');
    return j[levelIdx] || null;
  } catch(e) { return null; }
}
function setBestTime(levelIdx, seconds) {
  try {
    const j = JSON.parse(localStorage.getItem('br_bestTimes') || '{}');
    j[levelIdx] = seconds;
    localStorage.setItem('br_bestTimes', JSON.stringify(j));
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════════
//  RESET LEVEL STATE
// ═══════════════════════════════════════════════════════════════════
function resetState() {
  clearLevel();
  CUR_GRID = LEVEL_GRIDS[currentLevel];
  CUR_GW = CUR_GRID[0].length;
  CUR_GH = CUR_GRID.length;
  MAP_W = CUR_GW * TILE;
  MAP_H = CUR_GH * TILE;

  buildLevelGeometry();
  buildDust();

  // spawn location
  const SP = findSpawnTile();
  const sc = tileCenter(SP.gx, SP.gz);
  P.x = sc.x; P.y = 1.7; P.z = sc.z;
  P.yaw = 0; P.pitch = 0;
  P.hasKey = false;
  P.stamina = 1.0;
  P.battery = 1.0;
  P.flashOn = false;
  P.hiding = false; P.hideSpot = null;
  P.noteReading = false; P.noteCurrent = null;
  P.noiseLevel = 0;

  // floor tiles for placement, excluding spawn
  const floorTiles = allFloorTiles().filter(t => !(t.gx === SP.gx && t.gz === SP.gz));

  // key — far from spawn
  const kt = pickFarFloorTile([SP], 6);
  const kc = tileCenter(kt.gx, kt.gz);
  buildKey();
  keyGroup.position.set(kc.x, 0.6, kc.z);

  // door — far from both
  const dt = pickFarFloorTile([SP, kt], 7);
  const dc = tileCenter(dt.gx, dt.gz);
  buildDoor();
  doorGroup.position.set(dc.x, 0, dc.z);
  doorGroup.rotation.y = Math.atan2(-dc.x, -dc.z);

  // hiding spots (3-5, adjacent to wall, far from spawn/key/door)
  const hideCandidates = tilesAdjacentToWall()
    .filter(t => {
      if (t.gx === SP.gx && t.gz === SP.gz) return false;
      if (t.gx === kt.gx && t.gz === kt.gz) return false;
      if (t.gx === dt.gx && t.gz === dt.gz) return false;
      return Math.hypot(t.gx - SP.gx, t.gz - SP.gz) > 2;
    });
  shuffle(hideCandidates);
  const numHiding = 3 + currentLevel;
  for (let i = 0; i < Math.min(numHiding, hideCandidates.length); i++) {
    buildHidingSpot(hideCandidates[i].gx, hideCandidates[i].gz);
  }

  // batteries (2-4)
  const usedTiles = new Set();
  usedTiles.add(SP.gx+'_'+SP.gz);
  usedTiles.add(kt.gx+'_'+kt.gz);
  usedTiles.add(dt.gx+'_'+dt.gz);
  hidingSpots.forEach(h => usedTiles.add(h.gx+'_'+h.gz));
  const batteryPool = floorTiles.filter(t => !usedTiles.has(t.gx+'_'+t.gz));
  shuffle(batteryPool);
  const numBatteries = Math.max(2, 4 - Math.floor(currentLevel/2));
  for (let i = 0; i < Math.min(numBatteries, batteryPool.length); i++) {
    buildBattery(batteryPool[i].gx, batteryPool[i].gz);
    usedTiles.add(batteryPool[i].gx+'_'+batteryPool[i].gz);
  }

  // notes (3 per level) using shuffled lore pool
  const notePool = floorTiles.filter(t => !usedTiles.has(t.gx+'_'+t.gz));
  shuffle(notePool);
  const noteCount = 3;
  const loreShuffled = NOTE_LORE.slice(); shuffle(loreShuffled);
  P.notesTotalThisLevel = Math.min(noteCount, notePool.length);
  P.notesFoundThisLevel = 0;
  for (let i = 0; i < P.notesTotalThisLevel; i++) {
    buildNote(notePool[i].gx, notePool[i].gz, loreShuffled[i % loreShuffled.length]);
    usedTiles.add(notePool[i].gx+'_'+notePool[i].gz);
  }

  // monster patrol waypoints (4 across map)
  const wpPool = floorTiles.slice();
  shuffle(wpPool);
  for (let i = 0; i < Math.min(4, wpPool.length); i++) {
    monsterWaypoints.push({ gx: wpPool[i].gx, gz: wpPool[i].gz });
  }

  // monster — placed far away, not active until key picked up
  MONSTER.spawned = false;
  MONSTER.state = 'idle';
  MONSTER.root.visible = false;
  MONSTER.targetPath = null;
  MONSTER.pathIndex = 0;

  // lighting
  applyLevelLighting();

  // timers
  flashTimer = 0;
  nextFlicker = (10 + Math.random() * 8) / LEVELS[currentLevel].flickerMul;
  flickering = false;
  jsTriggered = false;

  // HUD reset
  document.getElementById('keyHudNew').style.display = 'none';
  document.getElementById('levelHud').style.display = 'block';
  document.getElementById('levelHud').textContent = `LEVEL ${LEVELS[currentLevel].n} / 5 — ${LEVELS[currentLevel].name}`;
  document.getElementById('timerHud').style.display = 'block';
  document.getElementById('bottomBar').style.display = 'flex';
  document.getElementById('hud').style.opacity = '0';
  document.body.classList.remove('chase');
  updateNoteCount();

  // audio
  if (AC) { startAmbient(); startTenseLayer(); startChaseLayer(); startMonsterSound(); }

  levelStartTime = Date.now();
  if (currentLevel === 0) startTime = levelStartTime;
  GAME = true; PAUSED = false;

  showHud(`LEVEL ${LEVELS[currentLevel].n} — kalitni top, eshikni och`, 5500);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ═══════════════════════════════════════════════════════════════════
//  KEY/DOOR INTERACTION (per-frame, called from main)
// ═══════════════════════════════════════════════════════════════════
function updateKeyAndDoor(dt) {
  if (!GAME || PAUSED || jsTriggered) return;

  // Key visual
  if (keyGroup && keyGroup.visible) {
    keyGroup.rotation.y += dt * 1.6;
    keyGroup.position.y = 0.6 + Math.sin(performance.now()*0.002) * 0.12;
  }
  // Battery pickups rotate
  for (const b of batteryPickups) {
    if (b.taken) continue;
    b.group.rotation.y += dt * 1.2;
    b.group.position.y = 0.35 + Math.sin(performance.now()*0.0025 + b.gx) * 0.08;
    const d = Math.hypot(P.x - b.worldX, P.z - b.worldZ);
    if (d < 0.9) {
      b.taken = true;
      b.group.visible = false;
      P.battery = Math.min(1, P.battery + 0.5);
      batteryPickupSound();
      showHud('BATAREYA +50%', 1800);
    }
  }
  // Note hover
  for (const n of notePickups) {
    if (n.taken) continue;
    n.group.position.y = 0.01 + Math.sin(performance.now()*0.002 + n.gx*0.3) * 0.05;
  }

  // KEY pickup
  if (!P.hasKey && keyGroup && keyGroup.visible) {
    const kd = Math.hypot(P.x - keyGroup.position.x, P.z - keyGroup.position.z);
    if (kd < 1.2) {
      P.hasKey = true;
      keyGroup.visible = false;
      keyPickupSound();
      chaseSting();
      showHud('KALIT OLINDI! YUGUR — yashil eshikni top!', 4500);
      document.getElementById('keyHudNew').style.display = 'flex';
      monsterSpawnBehindPlayer();
    }
  }

  // DOOR
  if (doorGroup) {
    const dd = Math.hypot(P.x - doorGroup.position.x, P.z - doorGroup.position.z);
    if (dd < 1.6) {
      if (P.hasKey) {
        doorOpenSound();
        levelComplete();
        return;
      } else if (dd < 1.2) {
        showHud('ESHIK QULFLANGAN — kalit kerak!', 1500);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  DYNAMIC MUSIC MIX
// ═══════════════════════════════════════════════════════════════════
function updateMusicMix(dt) {
  if (!AC) return;
  const dist = MONSTER.spawned ? Math.hypot(P.x - MONSTER.x, P.z - MONSTER.z) : 99;
  const isChase = MONSTER.state === 'chase';
  const isInvestigate = MONSTER.state === 'investigate';
  const tenseTarget = MONSTER.spawned && !isChase ? Math.max(0, Math.min(0.35, (15 - dist) / 15)) : 0;
  const chaseTarget = isChase ? 0.35 : (isInvestigate ? 0.12 : 0);
  if (tenseGain) tenseGain.gain.setTargetAtTime(tenseTarget, AC.currentTime, 0.5);
  if (chaseGain) chaseGain.gain.setTargetAtTime(chaseTarget, AC.currentTime, 0.3);

  // heartbeat when monster near or chasing
  if (MONSTER.spawned && dist < 14) {
    heartTimer += dt;
    const rate = isChase ? 2.8 : Math.max(0.6, (15 - dist) / 7);
    if (heartTimer > 0.85 / rate) {
      heartbeat(Math.min(0.2, 0.08 + (10 - dist)/70));
      heartTimer = 0;
    }
  }

  // Chase CSS pulse
  if (isChase) document.body.classList.add('chase');
  else         document.body.classList.remove('chase');
}
let heartTimer = 0;

// ═══════════════════════════════════════════════════════════════════
//  GAME LOOP
// ═══════════════════════════════════════════════════════════════════
let last = 0, raf = 0;
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min((now - last)/1000, 0.05);
  last = now;
  if (GAME && !PAUSED && !P.noteReading) {
    updatePlayer(dt);
    updateFlashlight(dt);
    updateFlicker(dt);
    updateKeyAndDoor(dt);
    updateMonsterAI(dt);
    animateMonster(dt);
    updateDust(dt);
    updateMonsterAudio(Math.hypot(P.x - MONSTER.x, P.z - MONSTER.z), P.x, P.z, P.yaw);
    updateMusicMix(dt);
    updateInteractHud();
    // timer hud
    const s = Math.floor((Date.now() - levelStartTime)/1000);
    document.getElementById('timerHud').textContent = `⏱ ${fmtTime(s)}   🗒 ${P.notesFoundThisLevel}/${P.notesTotalThisLevel}${P.hasKey?'   🔑':''}`;
  }
  // render
  if (fxEnabled && fxMat) {
    fxMat.uniforms.time.value = now * 0.001;
    const chaseU = MONSTER.state === 'chase' ? 1.0 : (MONSTER.state === 'investigate' ? 0.25 : 0);
    fxMat.uniforms.chase.value += (chaseU - fxMat.uniforms.chase.value) * 0.06;
    fxMat.uniforms.vignetteStrength.value = P.hiding ? 1.6 : 1.0;
    renderer.setRenderTarget(fxRT);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(fxScene, fxCam);
  } else {
    renderer.render(scene, camera);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════════
function startGame() {
  initAudio();
  document.getElementById('startScreen').style.display = 'none';
  cvEl.requestPointerLock();
  currentLevel = 0;
  totalTime = 0;
  resetState();
  last = performance.now();
  if (!raf) loop(last);
}

function downloadGame() {
  const b = new Blob([document.documentElement.outerHTML], { type: 'text/html' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b);
  a.download = 'backrooms-qochish-5level.html'; a.click();
}

// click-through on start screen (but not on buttons)
document.getElementById('startScreen').addEventListener('click', e => {
  if (e.target.tagName === 'BUTTON') return;
  if (e.target.id === 'instructions') return;
  startGame();
});

// initial black render
renderer.render(scene, camera);

