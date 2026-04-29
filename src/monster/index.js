import * as THREE from 'three';
import { CH } from '../core/config.js';
import { state } from '../core/state.js';
import { LEVELS } from '../levels/index.js';
import { scene, levelGroup, camera } from '../core/scene.js';
import { allFloorTiles, worldToTile, tileCenter, tileAt, inMap, aStar } from '../world/map.js';
import { monsterWaypoints } from '../world/collectibles.js';
import { chaseSting, monsterFootstep } from '../audio/manager.js';
import { P } from '../player/index.js';

let _triggerGameOver = () => {};
export function setTriggerGameOver(fn) { _triggerGameOver = fn; }
function triggerGameOver() { _triggerGameOver(); }

// ═══════════════════════════════════════════════════════════════════
//  MOMO MONSTER RIG — pale, oversized head, long arms, fixed grin
// ═══════════════════════════════════════════════════════════════════
export const MONSTER = {
  root: null,
  parts: {},
  x: 0, z: 0, y: 0,
  facing: 0,
  phase: 0,
  stateStartTime: 0,
  state: 'idle',       // 'idle' | 'patrol' | 'listening' | 'investigate' | 'chase' | 'stunned'
  targetPath: null,
  pathIndex: 0,
  investigateTarget: null,
  patrolIndex: 0,
  lastSeenPlayer: 0,
  lostSightAt: 0,
  listenStart: 0,
  freezeUntil: 0,
  nextFreezeAt: 0,
  twitchUntil: 0,
  nextTwitchAt: 0,
  lungeUntil: 0,
  lungeSpeed: 0,
  stunCount: 0,
  footstepTimer: 0,
  spawned: false,
};

export function buildMonster() {
  const root = new THREE.Group();

  // ── Materials ──
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd4cfc8, roughness: 0.85, metalness: 0.02, emissive: 0x0a0808, emissiveIntensity: 0.08
  });
  const skinDarkMat = new THREE.MeshStandardMaterial({
    color: 0x8a857c, roughness: 0.92, metalness: 0.03
  });
  const gownMat = new THREE.MeshStandardMaterial({
    color: 0x6a5e54, roughness: 0.96, metalness: 0.0
  });
  const gownDirtMat = new THREE.MeshStandardMaterial({
    color: 0x3a3028, roughness: 0.95
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x05030a, roughness: 1.0, metalness: 0.0
  });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xe8e6dd, roughness: 0.45, metalness: 0.05, emissive: 0x222020, emissiveIntensity: 0.4
  });
  const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const mouthMat = new THREE.MeshStandardMaterial({
    color: 0x6e3a3a, roughness: 0.75, emissive: 0x180808, emissiveIntensity: 0.2
  });

  // ── BODY container ──
  const body = new THREE.Group();
  body.position.y = 0.0;
  root.add(body);

  // Torso — narrower than before
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.26, 0.78, 10),
    gownMat
  );
  torso.position.y = 1.25;
  body.add(torso);
  const torsoDirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.27, 0.4, 10),
    gownDirtMat
  );
  torsoDirt.position.y = 1.05;
  body.add(torsoDirt);

  // ── SKIRT ──
  const skirt = new THREE.Mesh(
    new THREE.ConeGeometry(0.46, 0.9, 12, 1, true),
    gownMat
  );
  skirt.position.y = 0.55;
  skirt.rotation.x = Math.PI;
  body.add(skirt);

  // ── NECK — taller, thinner ──
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 0.28, 8),
    skinMat
  );
  neck.position.y = 1.78;
  body.add(neck);

  // ── HEAD pivot (oversized, wider) ──
  const headPivot = new THREE.Group();
  headPivot.position.y = 1.96;
  body.add(headPivot);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 18, 16),
    skinMat
  );
  head.scale.set(1.35, 1.05, 1.0); // 35% wider — Momo proportions
  headPivot.add(head);

  // Faint shadow under cheekbones
  const cheekShadow = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x554840, transparent: true, opacity: 0.45 })
  );
  cheekShadow.position.set(0, -0.05, 0.18);
  cheekShadow.scale.set(2.2, 0.6, 0.4);
  headPivot.add(cheekShadow);

  // ── EYES — large white sclera with dark pupil ──
  function buildEye(side) {
    const sclera = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 14, 12),
      eyeWhiteMat
    );
    sclera.position.set(side * 0.115, 0.025, 0.21);
    sclera.scale.set(1.0, 1.05, 0.9);
    headPivot.add(sclera);
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.034, 10, 8),
      eyePupilMat
    );
    pupil.position.set(side * 0.115, 0.02, 0.275);
    headPivot.add(pupil);
    // dark eye socket ring
    const socketRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.085, 0.018, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0x1a0808, transparent: true, opacity: 0.55 })
    );
    socketRing.position.set(side * 0.115, 0.02, 0.21);
    socketRing.rotation.y = side * 0.15;
    headPivot.add(socketRing);
    return { sclera, pupil };
  }
  const eyeL = buildEye(-1);
  const eyeR = buildEye(1);

  // small dim red point lights for far-away menace
  const eyeGlowL = new THREE.PointLight(0xff5544, 0.18, 1.4);
  const eyeGlowR = new THREE.PointLight(0xff5544, 0.18, 1.4);
  eyeGlowL.position.set(-0.115, 0.02, 0.27);
  eyeGlowR.position.set( 0.115, 0.02, 0.27);
  headPivot.add(eyeGlowL);
  headPivot.add(eyeGlowR);

  // ── MOUTH — fixed wide grin (curved torus arc) ──
  const mouthShape = new THREE.Shape();
  // crescent grin path
  mouthShape.moveTo(-0.16, 0);
  mouthShape.bezierCurveTo(-0.12, -0.06, 0.12, -0.06, 0.16, 0);
  mouthShape.bezierCurveTo(0.10, -0.02, -0.10, -0.02, -0.16, 0);
  const mouth = new THREE.Mesh(
    new THREE.ShapeGeometry(mouthShape),
    mouthMat
  );
  mouth.position.set(0, -0.13, 0.225);
  mouth.rotation.x = -0.15;
  headPivot.add(mouth);
  // grin upper lip line
  const lipLine = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.005, 4, 18, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x2a0a0a })
  );
  lipLine.position.set(0, -0.13, 0.226);
  lipLine.rotation.z = Math.PI; // grin curves up at the corners
  headPivot.add(lipLine);

  // tiny nostril dots
  const nostrilMat = new THREE.MeshBasicMaterial({ color: 0x1a0808 });
  const nostrilL = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), nostrilMat);
  const nostrilR = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), nostrilMat);
  nostrilL.position.set(-0.03, -0.04, 0.27);
  nostrilR.position.set( 0.03, -0.04, 0.27);
  headPivot.add(nostrilL);
  headPivot.add(nostrilR);

  // ── HAIR — dense long strands, drape forward ──
  const hairBulk = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 14, 12),
    hairMat
  );
  hairBulk.position.set(0, 0.06, -0.04);
  hairBulk.scale.set(1.1, 0.9, 1.05);
  headPivot.add(hairBulk);
  // 12 long strands
  for (let i = 0; i < 12; i++) {
    const strand = new THREE.Mesh(
      new THREE.PlaneGeometry(0.07, 0.78),
      hairMat
    );
    const a = (i / 12) * Math.PI * 2;
    const r = 0.18 + Math.random() * 0.04;
    strand.position.set(Math.sin(a) * r, -0.32, Math.cos(a) * r);
    strand.rotation.y = a;
    strand.rotation.x = 0.15 + Math.random() * 0.15;
    headPivot.add(strand);
  }
  // forehead bangs (3 short strands)
  for (let i = 0; i < 4; i++) {
    const bang = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 0.32),
      hairMat
    );
    bang.position.set((i - 1.5) * 0.07, 0.1, 0.22);
    bang.rotation.x = -0.1;
    headPivot.add(bang);
  }

  // ── ARMS — 30% longer ──
  function buildArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.26, 1.55, 0);
    body.add(shoulder);
    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.045, 0.52, 8),
      skinMat
    );
    upper.position.y = -0.26;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.55;
    shoulder.add(elbow);
    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.03, 0.5, 8),
      skinMat
    );
    forearm.position.y = -0.26;
    elbow.add(forearm);
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 6),
      skinDarkMat
    );
    hand.position.y = -0.55;
    hand.scale.set(0.9, 1.2, 0.8);
    elbow.add(hand);
    // 5 thin claw fingers
    for (let i = 0; i < 5; i++) {
      const claw = new THREE.Mesh(
        new THREE.ConeGeometry(0.011, 0.12, 5),
        skinDarkMat
      );
      const a = (i / 5 - 0.5) * 1.2;
      claw.position.set(Math.sin(a) * 0.055, -0.68, Math.cos(a) * 0.03);
      claw.rotation.x = Math.PI;
      claw.rotation.z = a * 0.3;
      elbow.add(claw);
    }
    return { shoulder, elbow };
  }
  const armL = buildArm(-1);
  const armR = buildArm(1);

  // ── LEGS ──
  function buildLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, 0.88, 0);
    body.add(hip);
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.065, 0.42, 8),
      skinMat
    );
    thigh.position.y = -0.21;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.05, 0.4, 8),
      skinMat
    );
    shin.position.y = -0.21;
    knee.add(shin);
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.05, 0.2),
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

// ═══════════════════════════════════════════════════════════════════
//  ANIMATION — wrong-movement signatures
// ═══════════════════════════════════════════════════════════════════
export function animateMonster(dt) {
  if (!MONSTER.root || !MONSTER.root.visible) return;
  const p = MONSTER.parts;
  const now = performance.now();
  const frozen = now < MONSTER.freezeUntil;
  const stunned = MONSTER.state === 'stunned';

  // motion params per state
  let cycleRate = 2.0, amp = 0.35, armAmp = 0.35, hunchZ = 0.0, bobMul = 0.035;
  if (MONSTER.state === 'chase')        { cycleRate = 7.0; amp = 0.85; armAmp = 1.0; hunchZ = 0.4; bobMul = 0.09; }
  else if (MONSTER.state === 'investigate') { cycleRate = 3.5; amp = 0.5; armAmp = 0.5; hunchZ = 0.18; bobMul = 0.05; }
  else if (MONSTER.state === 'patrol')   { cycleRate = 2.6; amp = 0.42; armAmp = 0.38; }
  else if (MONSTER.state === 'listening'){ cycleRate = 0.0; amp = 0.0; armAmp = 0.0; hunchZ = 0.05; bobMul = 0.0; }
  else if (MONSTER.state === 'idle')     { cycleRate = 0.5; amp = 0.04; armAmp = 0.06; }
  else if (stunned)                      { cycleRate = 0.0; amp = 0.0; armAmp = 0.0; }
  if (frozen)                            { cycleRate = 0.0; amp = 0.0; armAmp = 0.0; }

  MONSTER.phase += dt * cycleRate;
  const wave  = Math.sin(MONSTER.phase);
  const wave2 = Math.sin(MONSTER.phase + Math.PI);

  // legs
  p.legL_hip.rotation.x = wave  * amp;
  p.legR_hip.rotation.x = wave2 * amp;
  p.legL_knee.rotation.x = Math.max(0, -wave  * amp * 1.1);
  p.legR_knee.rotation.x = Math.max(0, -wave2 * amp * 1.1);

  // arms — chase has thrashing
  if (stunned) {
    // stun pose — arms wide, head dropped
    p.armL_shoulder.rotation.x = -0.2;
    p.armR_shoulder.rotation.x = -0.2;
    p.armL_shoulder.rotation.z = -1.2;
    p.armR_shoulder.rotation.z =  1.2;
    p.armL_elbow.rotation.x = -0.2;
    p.armR_elbow.rotation.x = -0.2;
  } else {
    p.armL_shoulder.rotation.z = 0;
    p.armR_shoulder.rotation.z = 0;
    p.armL_shoulder.rotation.x = wave2 * armAmp;
    p.armR_shoulder.rotation.x = wave  * armAmp;
    if (MONSTER.state === 'chase') {
      p.armL_elbow.rotation.x = -0.4 + Math.sin(MONSTER.phase * 2) * 0.5;
      p.armR_elbow.rotation.x = -0.4 + Math.sin(MONSTER.phase * 2 + 1) * 0.5;
    } else {
      p.armL_elbow.rotation.x = -0.3 + Math.max(0, wave2 * 0.4);
      p.armR_elbow.rotation.x = -0.3 + Math.max(0, wave  * 0.4);
    }
  }

  // hunched torso — leans into chase
  p.body.rotation.x = hunchZ + Math.abs(wave) * 0.04;
  // bob
  p.body.position.y = Math.abs(wave) * bobMul;

  // ── HEAD logic — over-rotation, freeze-stare, listening rotation ──
  if (stunned) {
    p.headPivot.rotation.x = 0.7;
    p.headPivot.rotation.y = 0;
    p.headPivot.rotation.z = 0.3;
  } else if (frozen) {
    // lock head toward player
    const dx = P.x - MONSTER.x, dz = P.z - MONSTER.z;
    const desired = Math.atan2(dx, dz) - MONSTER.facing;
    // clamp to ±2.4 rad (over-rotation allowed)
    let yaw = desired;
    while (yaw >  Math.PI) yaw -= Math.PI * 2;
    while (yaw < -Math.PI) yaw += Math.PI * 2;
    yaw = Math.max(-2.4, Math.min(2.4, yaw));
    p.headPivot.rotation.y += (yaw - p.headPivot.rotation.y) * Math.min(1, dt * 6);
    p.headPivot.rotation.x = -0.05;
    p.headPivot.rotation.z = 0;
  } else if (MONSTER.state === 'listening') {
    // slow full rotation while listening
    const t = (now - MONSTER.listenStart) / 1000;
    p.headPivot.rotation.y = (t * (Math.PI * 2 / 4)) % (Math.PI * 2); // 4s full circle
    if (p.headPivot.rotation.y > Math.PI) p.headPivot.rotation.y -= Math.PI * 2;
    p.headPivot.rotation.x = 0;
    p.headPivot.rotation.z = 0;
  } else if (MONSTER.state === 'investigate') {
    // head leads body — extra rotation toward target
    const targetYaw = Math.sin(MONSTER.phase * 0.5) * 0.6;
    p.headPivot.rotation.y += (targetYaw - p.headPivot.rotation.y) * Math.min(1, dt * 4);
    p.headPivot.rotation.z = Math.sin(MONSTER.phase * 0.4) * 0.08;
  } else if (MONSTER.state === 'idle' || MONSTER.state === 'patrol') {
    p.headPivot.rotation.y = Math.sin(MONSTER.phase * 0.4) * 0.25;
    p.headPivot.rotation.z = Math.sin(MONSTER.phase * 0.3) * 0.12;
  } else {
    // chase — head locked forward, slight bob
    p.headPivot.rotation.y *= 0.92;
    p.headPivot.rotation.z *= 0.92;
  }

  // skirt sway
  p.skirt.rotation.z = Math.sin(MONSTER.phase * 0.6) * 0.05;

  // eye glow — bright in chase, dim otherwise
  const eyeBase = MONSTER.state === 'chase' ? 0.9 :
                  MONSTER.state === 'investigate' ? 0.4 :
                  MONSTER.state === 'listening' ? 0.3 : 0.18;
  const flicker = 0.85 + Math.random() * 0.3;
  p.eyeGlowL.intensity = eyeBase * flicker;
  p.eyeGlowR.intensity = eyeBase * flicker;

  // ── TWITCHY IDLE — random body jerks ──
  let twitchYaw = 0;
  if (MONSTER.state === 'idle' || MONSTER.state === 'patrol') {
    if (now > MONSTER.nextTwitchAt && now > MONSTER.twitchUntil) {
      MONSTER.twitchUntil = now + 100;
      MONSTER.nextTwitchAt = now + 2000 + Math.random() * 2500;
      MONSTER._twitchAmount = (Math.random() - 0.5) * 0.6;
    }
    if (now < MONSTER.twitchUntil) twitchYaw = MONSTER._twitchAmount || 0;
  }

  // apply world transform
  MONSTER.root.position.set(MONSTER.x, 0, MONSTER.z);
  MONSTER.root.rotation.y = MONSTER.facing + twitchYaw;
}


// ═══════════════════════════════════════════════════════════════════
//  SPAWN
// ═══════════════════════════════════════════════════════════════════
export function monsterSpawnBehindPlayer() {
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
  MONSTER.lastSeenPlayer = performance.now();
  MONSTER.lungeUntil = performance.now() + 300; // initial lunge burst
  MONSTER.lungeSpeed = 0;
  MONSTER.stunCount = 0;
  // per-level scale
  const lv = LEVELS[state.currentLevel];
  const sY = 1.0 + state.currentLevel * 0.035;
  const sXZ = state.currentLevel >= 4 ? 1.05 : 1.0;
  MONSTER.root.scale.set(sXZ, sY, sXZ);
  // reset rig pose offsets
  MONSTER.parts.headPivot.rotation.set(0, 0, 0);
  MONSTER.freezeUntil = 0;
  MONSTER.nextFreezeAt = performance.now() + 4000;
  MONSTER.twitchUntil = 0;
  MONSTER.nextTwitchAt = performance.now() + 1500;
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
  const mx = MONSTER.x, mz = MONSTER.z;
  const px = P.x, pz = P.z;
  const dx = px - mx, dz = pz - mz;
  const dist = Math.hypot(dx, dz);
  if (dist > 20) return false;
  const steps = Math.ceil(dist / 0.4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sx = mx + dx * t, sz = mz + dz * t;
    if (tileAt(sx, sz) === '1') return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════
//  AI UPDATE — listening, prediction, lunge, freeze-stare
// ═══════════════════════════════════════════════════════════════════
export function updateMonsterAI(dt) {
  if (!state.game || state.jsTriggered || !MONSTER.spawned) return;
  const now = performance.now();
  const lv = LEVELS[state.currentLevel];
  const mx = MONSTER.x, mz = MONSTER.z;
  const px = P.x, pz = P.z;
  const dist = Math.hypot(px - mx, pz - mz);

  // ── Noise → investigate (only when not chasing) ──
  if (P.noiseLevel > 0 && MONSTER.state !== 'chase' && MONSTER.state !== 'stunned' && !P.hiding) {
    if (dist < 12 * (1 + P.noiseLevel)) {
      const pt = worldToTile(P.x, P.z);
      MONSTER.investigateTarget = { gx: pt.gx, gz: pt.gz };
      if (MONSTER.state !== 'investigate') {
        MONSTER.state = 'investigate';
        MONSTER.stateStartTime = now;
      }
      repathTo(pt.gx, pt.gz);
    }
  }
  // listening hears noise within 6u
  if (MONSTER.state === 'listening' && P.noiseLevel > 0.08 && dist < 7) {
    MONSTER.state = 'chase';
    MONSTER.lungeUntil = now + 300;
    MONSTER.lungeSpeed = 0;
    MONSTER.lastSeenPlayer = now;
    chaseSting();
  }
  P.noiseLevel = Math.max(0, P.noiseLevel - dt * 0.6);

  // ── Sight check ──
  if (!P.hiding && monsterCanSeePlayer()) {
    if (MONSTER.state !== 'chase') {
      MONSTER.state = 'chase';
      MONSTER.stateStartTime = now;
      MONSTER.lungeUntil = now + 300;
      MONSTER.lungeSpeed = 0;
      chaseSting();
    }
    MONSTER.lastSeenPlayer = now;
    MONSTER.lostSightAt = 0;
  } else if (MONSTER.state === 'chase') {
    if (!MONSTER.lostSightAt) MONSTER.lostSightAt = now;
    const timeLost = now - MONSTER.lostSightAt;
    if (timeLost > 700 && timeLost < 850) {
      const pt = worldToTile(P.x, P.z);
      repathTo(pt.gx, pt.gz);
    }
    if (timeLost > 1500 && MONSTER.state === 'chase') {
      // transition to listening
      MONSTER.state = 'listening';
      MONSTER.listenStart = now;
    }
  }
  // listening timeout
  if (MONSTER.state === 'listening') {
    if (now - MONSTER.listenStart > 5000) {
      const pt = worldToTile(P.x, P.z);
      MONSTER.investigateTarget = { gx: pt.gx, gz: pt.gz };
      MONSTER.state = 'investigate';
      MONSTER.stateStartTime = now;
      repathTo(pt.gx, pt.gz);
    }
  }
  // overall give-up: no sight for `giveup` ms drops to patrol
  if ((MONSTER.state === 'investigate' || MONSTER.state === 'listening') &&
      now - MONSTER.lastSeenPlayer > lv.giveup) {
    MONSTER.state = 'patrol';
    monsterGotoRandomWaypoint();
  }

  // ── Collision with player ──
  if (!P.hiding && dist < 0.95 && MONSTER.state === 'chase') {
    triggerGameOver();
    return;
  }
  // hiding detection — softens after stuns
  const lockerThresh = MONSTER.stunCount >= 2 ? 1.2 : 1.5;
  if (P.hiding && MONSTER.state === 'chase' && dist < lockerThresh && P.noiseLevel > 0.4) {
    triggerGameOver();
    return;
  }

  // ── Freeze-stare during patrol/idle ──
  if ((MONSTER.state === 'patrol' || MONSTER.state === 'idle') && now > MONSTER.nextFreezeAt && now > MONSTER.freezeUntil) {
    MONSTER.freezeUntil = now + 1000 + Math.random() * 2000;
    MONSTER.nextFreezeAt = MONSTER.freezeUntil + 5000 + Math.random() * 4000;
  }
  const frozen = now < MONSTER.freezeUntil;

  // ── Movement ──
  let speed = lv.spd;
  if (MONSTER.state === 'chase') {
    const closeFactor = Math.max(1.0, 1.6 - dist * 0.06);
    speed *= closeFactor;
    // lunge burst — accel from 0 to full over 0.3s
    if (now < MONSTER.lungeUntil) {
      const t = 1 - (MONSTER.lungeUntil - now) / 300;
      MONSTER.lungeSpeed = speed * t;
      speed = MONSTER.lungeSpeed;
    }
  }
  else if (MONSTER.state === 'investigate') speed *= 0.7;
  else if (MONSTER.state === 'patrol')      speed *= 0.55;
  else                                       speed = 0;
  if (frozen) speed = 0;

  if (MONSTER.state === 'chase' && speed > 0) {
    // PREDICTION — chase where player is going
    const lead = lv.pred || 0;
    const tx = px + P.vx * lead;
    const tz = pz + P.vz * lead;
    const dx = tx - mx, dz = tz - mz;
    const len = Math.max(0.01, Math.hypot(dx, dz));
    const step = speed * dt;
    const nx = mx + (dx/len) * step;
    const nz = mz + (dz/len) * step;
    if (inMap(nx, mz, 0.4)) MONSTER.x = nx;
    else if (inMap(mx, nz, 0.4)) MONSTER.z = nz;
    else if (inMap(nx, mz + 0.4, 0.4)) { MONSTER.z += 0.06; MONSTER.x = nx; }
    else if (inMap(nx, mz - 0.4, 0.4)) { MONSTER.z -= 0.06; MONSTER.x = nx; }
    if (inMap(MONSTER.x, nz, 0.4)) MONSTER.z = nz;
    // face direct player position (not predicted) so it looks right
    MONSTER.facing = Math.atan2(px - mx, pz - mz);
  } else if ((MONSTER.state === 'patrol' || MONSTER.state === 'investigate') && speed > 0) {
    if (!MONSTER.targetPath || MONSTER.pathIndex >= MONSTER.targetPath.length) {
      if (MONSTER.state === 'investigate') {
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

  // footstep cadence
  MONSTER.footstepTimer += dt;
  const stepInterval = MONSTER.state === 'chase' ? 0.24 :
                       MONSTER.state === 'investigate' ? 0.45 : 0.7;
  const moving = !frozen && (MONSTER.state === 'chase' || MONSTER.state === 'investigate' || MONSTER.state === 'patrol');
  if (moving && MONSTER.footstepTimer > stepInterval) {
    monsterFootstep(dist);
    MONSTER.footstepTimer = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  STUN — called when player throws a bottle
// ═══════════════════════════════════════════════════════════════════
export function stunMonster() {
  if (!MONSTER.spawned || MONSTER.state === 'stunned') return;
  MONSTER.state = 'stunned';
  MONSTER.stateStartTime = performance.now();
  MONSTER.stunCount++;
  setTimeout(() => {
    if (MONSTER.state === 'stunned') {
      MONSTER.state = 'chase';
      MONSTER.lungeUntil = performance.now() + 300;
      MONSTER.lungeSpeed = 0;
      MONSTER.lastSeenPlayer = performance.now();
      chaseSting();
    }
  }, 4000);
}

// ═══════════════════════════════════════════════════════════════════
//  JUMPSCARE — 3D lunge to camera + canvas overlay + scream
// ═══════════════════════════════════════════════════════════════════
const jsCv = document.getElementById('jsC'), jsCtx = jsCv.getContext('2d');
let jsAnim = false, jsStart = 0, jsCb = null;
let jsLungeStartScale = null;
let jsLungeStartPos = null;

export function resizeJs() { jsCv.width = innerWidth; jsCv.height = innerHeight; }
resizeJs();

function drawJsFace(p) {
  const W = jsCv.width, H = jsCv.height;
  jsCtx.clearRect(0, 0, W, H);
  const sh = (1 - p) * 22;
  jsCtx.save();
  jsCtx.translate((Math.random() - .5) * sh, (Math.random() - .5) * sh);
  // black shroud fading in
  jsCtx.fillStyle = `rgba(0,0,0,${Math.min(1, p * 1.6)})`;
  jsCtx.fillRect(-sh*2, -sh*2, W + sh*4, H + sh*4);
  // red rim
  const cx = W/2, cy = H/2, r = Math.min(W, H) * .46 * (0.18 + p * 0.95);
  const rim = jsCtx.createRadialGradient(cx, cy, r * .1, cx, cy, r * 2.2);
  rim.addColorStop(0, 'rgba(180,10,10,.55)');
  rim.addColorStop(1, 'rgba(0,0,0,0)');
  jsCtx.fillStyle = rim; jsCtx.fillRect(0, 0, W, H);
  // pale Momo head
  jsCtx.fillStyle = '#cbc5b8';
  jsCtx.beginPath();
  jsCtx.ellipse(cx, cy - r * .04, r * 1.0, r * 1.05, 0, 0, Math.PI*2);
  jsCtx.fill();
  // hair frame
  jsCtx.fillStyle = '#04030a';
  jsCtx.beginPath();
  jsCtx.ellipse(cx, cy - r * .55, r * 1.15, r * .65, 0, 0, Math.PI*2);
  jsCtx.fill();
  // hair sides hanging
  jsCtx.beginPath();
  jsCtx.ellipse(cx - r * .85, cy + r * .15, r * .35, r * 1.1, 0, 0, Math.PI*2);
  jsCtx.fill();
  jsCtx.beginPath();
  jsCtx.ellipse(cx + r * .85, cy + r * .15, r * .35, r * 1.1, 0, 0, Math.PI*2);
  jsCtx.fill();
  // big white eyes
  if (p > .05) {
    const ea = Math.min(1, (p - .05) / .2);
    // sclera
    jsCtx.fillStyle = `rgba(232,228,220,${ea})`;
    jsCtx.beginPath(); jsCtx.ellipse(cx - r*.32, cy - r*.05, r*.22, r*.24, 0, 0, Math.PI*2); jsCtx.fill();
    jsCtx.beginPath(); jsCtx.ellipse(cx + r*.32, cy - r*.05, r*.22, r*.24, 0, 0, Math.PI*2); jsCtx.fill();
    // dark pupil
    jsCtx.fillStyle = `rgba(0,0,0,${ea})`;
    jsCtx.beginPath(); jsCtx.ellipse(cx - r*.32, cy - r*.04, r*.085, r*.09, 0, 0, Math.PI*2); jsCtx.fill();
    jsCtx.beginPath(); jsCtx.ellipse(cx + r*.32, cy - r*.04, r*.085, r*.09, 0, 0, Math.PI*2); jsCtx.fill();
    // dark socket rim
    jsCtx.strokeStyle = `rgba(60,30,30,${ea*.7})`;
    jsCtx.lineWidth = r * .03;
    jsCtx.beginPath(); jsCtx.ellipse(cx - r*.32, cy - r*.05, r*.23, r*.25, 0, 0, Math.PI*2); jsCtx.stroke();
    jsCtx.beginPath(); jsCtx.ellipse(cx + r*.32, cy - r*.05, r*.23, r*.25, 0, 0, Math.PI*2); jsCtx.stroke();
  }
  // wide grin
  if (p > .15) {
    const ma = Math.min(1, (p - .15) / .25);
    jsCtx.strokeStyle = `rgba(80,20,20,${ma})`;
    jsCtx.lineWidth = r * .04;
    jsCtx.beginPath();
    jsCtx.moveTo(cx - r*.42, cy + r*.3);
    jsCtx.bezierCurveTo(cx - r*.2, cy + r*.5, cx + r*.2, cy + r*.5, cx + r*.42, cy + r*.3);
    jsCtx.stroke();
    jsCtx.fillStyle = `rgba(60,15,15,${ma * .5})`;
    jsCtx.beginPath();
    jsCtx.moveTo(cx - r*.4, cy + r*.32);
    jsCtx.bezierCurveTo(cx - r*.18, cy + r*.46, cx + r*.18, cy + r*.46, cx + r*.4, cy + r*.32);
    jsCtx.bezierCurveTo(cx + r*.18, cy + r*.36, cx - r*.18, cy + r*.36, cx - r*.4, cy + r*.32);
    jsCtx.fill();
  }
  // nostril dots
  if (p > .12) {
    jsCtx.fillStyle = `rgba(15,5,5,${Math.min(1,(p-.12)/.2)})`;
    jsCtx.beginPath(); jsCtx.ellipse(cx - r*.06, cy + r*.12, r*.025, r*.04, 0, 0, Math.PI*2); jsCtx.fill();
    jsCtx.beginPath(); jsCtx.ellipse(cx + r*.06, cy + r*.12, r*.025, r*.04, 0, 0, Math.PI*2); jsCtx.fill();
  }
  // scratch lines
  if (p > .04) {
    jsCtx.strokeStyle = `rgba(160,0,0,${p*.3})`;
    jsCtx.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      jsCtx.beginPath();
      jsCtx.moveTo(Math.random() * W, Math.random() * H);
      jsCtx.lineTo(Math.random() * W, Math.random() * H);
      jsCtx.stroke();
    }
  }
  // white flash spike at the start
  if (p < 0.08) {
    jsCtx.fillStyle = `rgba(255,255,255,${(0.08 - p) * 6})`;
    jsCtx.fillRect(0, 0, W, H);
  }
  jsCtx.restore();
}

export function runJumpscare(cb) {
  jsAnim = true; jsStart = performance.now(); jsCb = cb;
  document.getElementById('jsOver').style.display = 'block';
  // capture monster current scale/pos so we can lunge it toward camera
  if (MONSTER.root && MONSTER.root.visible) {
    jsLungeStartScale = MONSTER.root.scale.clone();
    jsLungeStartPos = MONSTER.root.position.clone();
  } else {
    jsLungeStartScale = null;
    jsLungeStartPos = null;
  }
  requestAnimationFrame(jsFrame);
}

function jsFrame(now) {
  if (!jsAnim) return;
  const elapsed = now - jsStart;
  // 3D monster lunges fast toward camera in first 0.15s
  if (jsLungeStartScale && jsLungeStartPos && MONSTER.root && MONSTER.root.visible) {
    const lt = Math.min(1, elapsed / 150);
    const s = 1 + lt * 7;
    MONSTER.root.scale.set(jsLungeStartScale.x * s, jsLungeStartScale.y * s, jsLungeStartScale.z * s);
    // lerp toward camera position
    if (camera) {
      MONSTER.root.position.x = jsLungeStartPos.x + (camera.position.x - jsLungeStartPos.x) * lt * 0.7;
      MONSTER.root.position.z = jsLungeStartPos.z + (camera.position.z - jsLungeStartPos.z) * lt * 0.7;
    }
  }
  const p = Math.min(1, elapsed / 2300);
  drawJsFace(p);
  if (p < 1) requestAnimationFrame(jsFrame);
  else {
    jsAnim = false;
    document.getElementById('jsOver').style.display = 'none';
    jsCb && jsCb();
  }
}
