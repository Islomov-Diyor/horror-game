import * as THREE from 'three';
import { camera, audioListener } from '../core/scene.js';
import { fxMat } from '../core/postfx.js';
import { setJumpscareClip } from './anim.js';
import { deathScream } from '../audio/manager.js';

const SCREAM_URL = 'assets/audio/scream.mp3';
const DURATION = 1850;

let screamBuffer = null;
let screamLoaded = false;

const flashEl = document.getElementById('jsOver');
if (flashEl) {
  flashEl.style.background = '#000';
  flashEl.style.zIndex = '300';
  const cv = document.getElementById('jsC');
  if (cv) cv.remove();
}

let jsActive = false;
let jsStart = 0;
let jsCb = null;
let savedFov = 78;
let savedCamPos = new THREE.Vector3();
let savedCamRot = new THREE.Euler();
let activeMonster = null;
let monLungeStartPos = new THREE.Vector3();
let monLungeStartScale = new THREE.Vector3(1, 1, 1);

export async function loadScream() {
  return new Promise(resolve => {
    const loader = new THREE.AudioLoader();
    loader.load(
      SCREAM_URL,
      buf => { screamBuffer = buf; screamLoaded = true; resolve(); },
      undefined,
      () => { console.warn('[monster] scream.mp3 not found — falling back to synth scream'); resolve(); }
    );
  });
}

function playScream() {
  if (screamLoaded && screamBuffer) {
    const audio = new THREE.Audio(audioListener);
    audio.setBuffer(screamBuffer);
    audio.setVolume(1.0);
    audio.play();
  } else {
    deathScream();
  }
}

export function runJumpscare(MONSTER, cb) {
  if (jsActive) return;
  jsActive = true;
  jsStart = performance.now();
  jsCb = cb;
  activeMonster = MONSTER;
  savedFov = camera.fov;
  savedCamPos.copy(camera.position);
  savedCamRot.copy(camera.rotation);

  if (flashEl) flashEl.style.display = 'block';

  if (MONSTER && MONSTER.root && MONSTER.root.visible) {
    monLungeStartPos.copy(MONSTER.root.position);
    monLungeStartScale.copy(MONSTER.root.scale);

    const fwdX = -Math.sin(camera.rotation.y);
    const fwdZ = -Math.cos(camera.rotation.y);
    const targetX = camera.position.x + fwdX * 1.4;
    const targetZ = camera.position.z + fwdZ * 1.4;
    MONSTER.root.position.set(targetX, 0, targetZ);
    MONSTER.facing = Math.atan2(camera.position.x - targetX, camera.position.z - targetZ);
    MONSTER.root.rotation.y = MONSTER.facing;
    MONSTER.x = targetX;
    MONSTER.z = targetZ;
    MONSTER.state = 'jumpscare';
    setJumpscareClip(MONSTER);
  }

  playScream();
  requestAnimationFrame(jsFrame);
}

function jsFrame(now) {
  if (!jsActive) return;
  const elapsed = now - jsStart;
  const p = Math.min(1, elapsed / DURATION);

  const fovPunch = savedFov + 28 * Math.min(1, elapsed / 120) * (1 - 0.6 * p);
  camera.fov = fovPunch;
  camera.updateProjectionMatrix();

  if (activeMonster && activeMonster.root && activeMonster.root.visible) {
    const lt = Math.min(1, elapsed / 180);
    const s = 1 + lt * 1.6;
    const baseS = monLungeStartScale.x;
    activeMonster.root.scale.setScalar(baseS * s);
    if (lt < 1) {
      const fwdX = -Math.sin(savedCamRot.y);
      const fwdZ = -Math.cos(savedCamRot.y);
      const dist = 1.4 - lt * 0.7;
      activeMonster.root.position.x = savedCamPos.x + fwdX * dist;
      activeMonster.root.position.z = savedCamPos.z + fwdZ * dist;
    }
  }

  if (fxMat) {
    const peak = elapsed < 600 ? 1 : Math.max(0, 1 - (elapsed - 600) / 700);
    fxMat.uniforms.chase.value = Math.min(2.0, 1.4 * peak + 0.6);
    fxMat.uniforms.heartbeat.value = peak * 1.6;
    const sx = (Math.random() - 0.5) * 0.04 * peak;
    const sy = (Math.random() - 0.5) * 0.04 * peak;
    fxMat.uniforms.shake.value.set(sx, sy);
  }

  if (flashEl) {
    if (elapsed < 50) {
      flashEl.style.background = `rgba(255,255,255,${1 - elapsed / 50})`;
    } else if (elapsed < 1300) {
      const a = Math.min(0.65, (elapsed - 50) / 400);
      flashEl.style.background = `rgba(0,0,0,${a})`;
    } else {
      const t = Math.min(1, (elapsed - 1300) / 500);
      flashEl.style.background = `rgba(0,0,0,${0.65 + t * 0.35})`;
    }
  }

  if (p < 1) {
    requestAnimationFrame(jsFrame);
  } else {
    jsActive = false;
    camera.fov = savedFov;
    camera.updateProjectionMatrix();
    if (flashEl) flashEl.style.display = 'none';
    if (fxMat) {
      fxMat.uniforms.chase.value = 0;
      fxMat.uniforms.heartbeat.value = 0;
      fxMat.uniforms.shake.value.set(0, 0);
    }
    activeMonster = null;
    jsCb && jsCb();
  }
}

export function resizeJs() {}
