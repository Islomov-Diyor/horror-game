import * as THREE from 'three';
import { CH } from '../core/config.js';
import { state } from '../core/state.js';
import { LEVELS } from '../levels/index.js';
import { levelGroup } from '../core/scene.js';
import { allFloorTiles, worldToTile, tileCenter, tileAt, inMap, aStar } from '../world/map.js';
import { monsterWaypoints } from '../world/collectibles.js';
import { chaseSting, monsterFootstep } from '../audio/manager.js';
import { P } from '../player/index.js';

let _triggerGameOver = () => {};
export function setTriggerGameOver(fn) { _triggerGameOver = fn; }
function triggerGameOver() { _triggerGameOver(); }

// ═══════════════════════════════════════════════════════════════════
//  FULL-BODY 3D MONSTER RIG
// ═══════════════════════════════════════════════════════════════════
export const MONSTER = {
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

export function buildMonster() {
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

export function animateMonster(dt) {
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


// ═══════════════════════════════════════════════════════════════════
export function monsterSpawnBehindPlayer() {
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

export function updateMonsterAI(dt) {
  if (!state.game || state.jsTriggered || !MONSTER.spawned) return;
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
  const lv = LEVELS[state.currentLevel];
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
  if (P.hiding || P.noteReading || state.paused || !state.game) {
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
  const gp = pollGamepad(dt, P);
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

// ═══════════════════════════════════════════════════════════════════
//  JUMPSCARE
// ═══════════════════════════════════════════════════════════════════
const jsCv = document.getElementById('jsC'), jsCtx = jsCv.getContext('2d');
let jsAnim = false, jsStart = 0, jsCb = null;
export function resizeJs() { jsCv.width = innerWidth; jsCv.height = innerHeight; }
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
export function runJumpscare(cb) {
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