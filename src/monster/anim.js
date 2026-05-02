import * as THREE from 'three';
import { LEVELS } from '../levels/index.js';
import { state } from '../core/state.js';
import { P } from '../player/index.js';

const STATE_TO_CLIP = {
  idle:        { kind: 'idle',   speed: 0.9,  fade: 0.4  },
  listening:   { kind: 'idle',   speed: 0.55, fade: 0.6  },
  patrol:      { kind: 'walk',   speed: 1.0,  fade: 0.4  },
  investigate: { kind: 'walk',   speed: 1.25, fade: 0.3  },
  chase:       { kind: 'run',    speed: 1.0,  fade: 0.18 },
  stunned:     { kind: 'idle',   speed: 0.0,  fade: 0.2  },
  jumpscare:   { kind: 'attack', speed: 1.1,  fade: 0.0  },
};

const _vec = new THREE.Vector3();

function setActive(MONSTER, kind, fade) {
  const next = MONSTER.actions[kind];
  if (!next) return;
  if (MONSTER.currentClip === kind) return;
  const curr = MONSTER.currentClip ? MONSTER.actions[MONSTER.currentClip] : null;
  if (curr) {
    curr.action.crossFadeTo(next.action, fade, false);
  } else {
    next.action.reset();
  }
  next.action.setEffectiveWeight(1);
  next.action.play();
  MONSTER.currentClip = kind;
}

function preferredKind(MONSTER) {
  const map = STATE_TO_CLIP[MONSTER.state] || STATE_TO_CLIP.idle;
  if (map.kind === 'run' && !MONSTER.actions.run && MONSTER.actions.walk) return 'walk';
  if (map.kind === 'walk' && !MONSTER.actions.walk && MONSTER.actions.run) return 'run';
  if (!MONSTER.actions[map.kind] && MONSTER.actions.idle) return 'idle';
  return map.kind;
}

export function setJumpscareClip(MONSTER) {
  const a = MONSTER.actions.attack || MONSTER.actions.run || MONSTER.actions.idle;
  if (!a) return;
  if (MONSTER.actions.attack) {
    MONSTER.actions.attack.action.reset();
    MONSTER.actions.attack.action.setEffectiveWeight(1);
    MONSTER.actions.attack.action.play();
  }
  MONSTER.currentClip = MONSTER.actions.attack ? 'attack' : MONSTER.currentClip;
}

export function updateAnim(MONSTER, dt) {
  if (!MONSTER.mixer || !MONSTER.root) return;
  const now = performance.now();
  const frozen = now < MONSTER.freezeUntil;
  const stunned = MONSTER.state === 'stunned';

  const map = STATE_TO_CLIP[MONSTER.state] || STATE_TO_CLIP.idle;
  const kind = preferredKind(MONSTER);
  setActive(MONSTER, kind, map.fade);

  let timeScale = map.speed;
  const lv = LEVELS[state.currentLevel];
  if ((kind === 'walk' || kind === 'run') && MONSTER.stride && MONSTER.stride[kind]) {
    let groundSpeed = lv.spd;
    if (MONSTER.state === 'investigate') groundSpeed *= 0.7;
    else if (MONSTER.state === 'patrol') groundSpeed *= 0.55;
    timeScale = Math.max(0.4, Math.min(2.4, groundSpeed / MONSTER.stride[kind]));
  }
  if (frozen || stunned) timeScale = 0;
  const action = MONSTER.actions[kind] && MONSTER.actions[kind].action;
  if (action) action.timeScale = timeScale;

  MONSTER.mixer.update(dt);

  if (MONSTER.headBone) {
    const head = MONSTER.headBone;
    if (frozen) {
      const dx = P.x - MONSTER.x, dz = P.z - MONSTER.z;
      const desired = Math.atan2(dx, dz) - MONSTER.facing;
      let yaw = desired;
      while (yaw >  Math.PI) yaw -= Math.PI * 2;
      while (yaw < -Math.PI) yaw += Math.PI * 2;
      yaw = Math.max(-2.2, Math.min(2.2, yaw));
      head.rotation.y += (yaw - head.rotation.y) * Math.min(1, dt * 6);
    } else if (MONSTER.state === 'listening') {
      const t = (now - MONSTER.listenStart) / 1000;
      let y = (t * (Math.PI * 2 / 4)) % (Math.PI * 2);
      if (y > Math.PI) y -= Math.PI * 2;
      head.rotation.y += (y - head.rotation.y) * Math.min(1, dt * 4);
    } else {
      head.rotation.y *= 0.92;
    }
  }

  let twitchYaw = 0;
  if (MONSTER.state === 'idle' || MONSTER.state === 'patrol') {
    if (now > MONSTER.nextTwitchAt && now > MONSTER.twitchUntil) {
      MONSTER.twitchUntil = now + 100;
      MONSTER.nextTwitchAt = now + 2200 + Math.random() * 2500;
      MONSTER._twitchAmount = (Math.random() - 0.5) * 0.5;
    }
    if (now < MONSTER.twitchUntil) twitchYaw = MONSTER._twitchAmount || 0;
  }

  MONSTER.root.position.set(MONSTER.x, 0, MONSTER.z);
  MONSTER.root.rotation.y = MONSTER.facing + twitchYaw;
}
