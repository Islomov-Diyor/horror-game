import * as THREE from 'three';
import { state } from '../core/state.js';
import { LEVELS } from '../levels/index.js';
import { allFloorTiles, worldToTile, tileCenter, tileAt, inMap, aStar } from '../world/map.js';
import { monsterWaypoints } from '../world/collectibles.js';
import { chaseSting, monsterFootstep } from '../audio/manager.js';
import { P } from '../player/index.js';

import { loadRig } from './rig.js';
import { updateAnim } from './anim.js';
import { runJumpscare as runJumpscareImpl, loadScream, resizeJs as resizeJsImpl } from './jumpscare.js';

let _triggerGameOver = () => {};
export function setTriggerGameOver(fn) { _triggerGameOver = fn; }
function triggerGameOver() { _triggerGameOver(); }

export const MONSTER = {
  root: null,
  modelRoot: null,
  mixer: null,
  actions: {},
  headBone: null,
  baseScale: 1,
  baseYOffset: 0,
  stride: { walk: null, run: null },
  currentClip: null,
  x: 0, z: 0, y: 0,
  facing: 0,
  state: 'idle',
  stateStartTime: 0,
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
  ready: false,
  loadError: null,
};

let _bootPromise = null;
export function bootMonster() {
  if (_bootPromise) return _bootPromise;
  _bootPromise = (async () => {
    try {
      await Promise.all([loadRig(MONSTER), loadScream()]);
      MONSTER.ready = true;
    } catch (err) {
      MONSTER.loadError = err;
      console.error('[monster] failed to load:', err);
      throw err;
    }
  })();
  return _bootPromise;
}

export function animateMonster(dt) {
  if (!MONSTER.root || !MONSTER.root.visible) return;
  updateAnim(MONSTER, dt);
}

export function monsterSpawnBehindPlayer() {
  if (!MONSTER.root) return;
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
  MONSTER.lungeUntil = performance.now() + 300;
  MONSTER.lungeSpeed = 0;
  MONSTER.stunCount = 0;
  const sY = 1.0 + state.currentLevel * 0.035;
  const sXZ = state.currentLevel >= 4 ? 1.05 : 1.0;
  MONSTER.root.scale.set(sXZ, sY, sXZ);
  MONSTER.root.position.y = 0;
  if (MONSTER.headBone) MONSTER.headBone.rotation.set(0, 0, 0);
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

export function updateMonsterAI(dt) {
  if (!state.game || state.jsTriggered || !MONSTER.spawned) return;
  const now = performance.now();
  const lv = LEVELS[state.currentLevel];
  const mx = MONSTER.x, mz = MONSTER.z;
  const px = P.x, pz = P.z;
  const dist = Math.hypot(px - mx, pz - mz);

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
  if (MONSTER.state === 'listening' && P.noiseLevel > 0.08 && dist < 7) {
    MONSTER.state = 'chase';
    MONSTER.lungeUntil = now + 300;
    MONSTER.lungeSpeed = 0;
    MONSTER.lastSeenPlayer = now;
    chaseSting();
  }
  P.noiseLevel = Math.max(0, P.noiseLevel - dt * 0.6);

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
      MONSTER.state = 'listening';
      MONSTER.listenStart = now;
    }
  }
  if (MONSTER.state === 'listening') {
    if (now - MONSTER.listenStart > 5000) {
      const pt = worldToTile(P.x, P.z);
      MONSTER.investigateTarget = { gx: pt.gx, gz: pt.gz };
      MONSTER.state = 'investigate';
      MONSTER.stateStartTime = now;
      repathTo(pt.gx, pt.gz);
    }
  }
  if ((MONSTER.state === 'investigate' || MONSTER.state === 'listening') &&
      now - MONSTER.lastSeenPlayer > lv.giveup) {
    MONSTER.state = 'patrol';
    monsterGotoRandomWaypoint();
  }

  if (!P.hiding && dist < 0.95 && MONSTER.state === 'chase') {
    triggerGameOver();
    return;
  }
  const lockerThresh = MONSTER.stunCount >= 2 ? 1.2 : 1.5;
  if (P.hiding && MONSTER.state === 'chase' && dist < lockerThresh && P.noiseLevel > 0.4) {
    triggerGameOver();
    return;
  }

  if ((MONSTER.state === 'patrol' || MONSTER.state === 'idle') && now > MONSTER.nextFreezeAt && now > MONSTER.freezeUntil) {
    MONSTER.freezeUntil = now + 1000 + Math.random() * 2000;
    MONSTER.nextFreezeAt = MONSTER.freezeUntil + 5000 + Math.random() * 4000;
  }
  const frozen = now < MONSTER.freezeUntil;

  let speed = lv.spd;
  if (MONSTER.state === 'chase') {
    const closeFactor = Math.max(1.0, 1.6 - dist * 0.06);
    speed *= closeFactor;
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

  MONSTER.footstepTimer += dt;
  const stepInterval = MONSTER.state === 'chase' ? 0.24 :
                       MONSTER.state === 'investigate' ? 0.45 : 0.7;
  const moving = !frozen && (MONSTER.state === 'chase' || MONSTER.state === 'investigate' || MONSTER.state === 'patrol');
  if (moving && MONSTER.footstepTimer > stepInterval) {
    monsterFootstep(dist);
    MONSTER.footstepTimer = 0;
  }
}

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

export function runJumpscare(cb) {
  runJumpscareImpl(MONSTER, cb);
}

export function resizeJs() { resizeJsImpl(); }

export function buildMonster() {
  console.warn('[monster] buildMonster() is deprecated — use bootMonster() instead');
  return bootMonster();
}
