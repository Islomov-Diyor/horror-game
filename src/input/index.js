import { state } from '../core/state.js';
import { cvEl } from '../core/scene.js';

export const JS = { active: false, x: 0, y: 0, id: -1, ox: 0, oy: 0 };
export let mobSprintPressed = false;

let gamepadIndex = -1;
let gpPrev = { a: false, b: false, y: false, x: false, start: false, lb: false };

export function pollGamepad(dt, P) {
  if (gamepadIndex < 0) return { mx: 0, mz: 0, sprint: false };
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = gps[gamepadIndex];
  if (!gp) return { mx: 0, mz: 0, sprint: false };
  const lx = Math.abs(gp.axes[0]) > 0.15 ? gp.axes[0] : 0;
  const ly = Math.abs(gp.axes[1]) > 0.15 ? gp.axes[1] : 0;
  const rx = Math.abs(gp.axes[2]) > 0.12 ? gp.axes[2] : 0;
  const ry = Math.abs(gp.axes[3]) > 0.12 ? gp.axes[3] : 0;
  if (state.game && !state.paused && !P.noteReading) {
    P.yaw   -= rx * dt * 2.4 * state.mouseSens;
    P.pitch -= ry * dt * 2.0 * state.mouseSens;
    P.pitch  = Math.max(-1.1, Math.min(1.1, P.pitch));
  }
  const sprint = gp.buttons[6]?.pressed || gp.buttons[10]?.pressed;
  const a = !!gp.buttons[0]?.pressed, b = !!gp.buttons[1]?.pressed;
  const y = !!gp.buttons[3]?.pressed, x = !!gp.buttons[2]?.pressed;
  const start = !!gp.buttons[9]?.pressed;
  if (a && !gpPrev.a) { _cbs.handleInteract(); }
  if (x && !gpPrev.x) { _cbs.toggleFlashlight(); }
  if (start && !gpPrev.start) {
    if (P.noteReading) _cbs.closeNote();
    else if (state.game && !state.paused) _cbs.pauseGame();
    else if (state.paused) _cbs.resumeGame();
  }
  gpPrev = { a, b, x, y, start, lb: false };
  return { mx: lx, mz: ly, sprint: !!sprint };
}

const _cbs = {};

export function setupInput(P, callbacks) {
  Object.assign(_cbs, callbacks);

  cvEl.addEventListener('click', () => {
    if (state.game && !state.paused && !P.hiding && !P.noteReading) cvEl.requestPointerLock();
  });

  document.addEventListener('mousemove', e => {
    if (!state.game || state.paused || P.noteReading || document.pointerLockElement !== cvEl) return;
    P.yaw   -= (e.movementX || 0) * .0022 * state.mouseSens;
    P.pitch -= (e.movementY || 0) * .0022 * state.mouseSens;
    P.pitch  = Math.max(-1.1, Math.min(1.1, P.pitch));
  });

  document.addEventListener('keydown', e => {
    if (e.code === 'Escape') {
      if (P.noteReading) { _cbs.closeNote(); return; }
      if (state.game && !state.paused) { _cbs.pauseGame(); return; }
    }
    if (e.code === 'KeyE') {
      if (P.noteReading) { _cbs.closeNote(); return; }
      _cbs.handleInteract();
      return;
    }
    if (e.code === 'KeyF' && state.game && !state.paused) {
      _cbs.toggleFlashlight();
      return;
    }
    P.keys[e.code] = true;
  });
  document.addEventListener('keyup', e => P.keys[e.code] = false);

  window.addEventListener('gamepadconnected', e => {
    gamepadIndex = e.gamepad.index;
    _cbs.showHud('Gamepad ulandi: ' + e.gamepad.id, 3000);
  });
  window.addEventListener('gamepaddisconnected', () => { gamepadIndex = -1; });

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
  lz.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; lx = t.clientX; ly = t.clientY; lA = true; }, { passive: false });
  lz.addEventListener('touchmove', e => {
    e.preventDefault(); if (!lA || !state.game || state.paused) return;
    const t = e.changedTouches[0];
    P.yaw   -= (t.clientX - lx) * .005 * state.mouseSens;
    P.pitch -= (t.clientY - ly) * .005 * state.mouseSens;
    P.pitch  = Math.max(-1.1, Math.min(1.1, P.pitch));
    lx = t.clientX; ly = t.clientY;
  }, { passive: false });
  lz.addEventListener('touchend', () => lA = false);

  document.getElementById('mobFlash').addEventListener('touchstart', e => {
    e.preventDefault(); _cbs.toggleFlashlight();
  }, { passive: false });
  document.getElementById('mobInteract').addEventListener('touchstart', e => {
    e.preventDefault(); _cbs.handleInteract();
  }, { passive: false });
  const sprintBtn = document.getElementById('mobSprint');
  sprintBtn.addEventListener('touchstart', e => { e.preventDefault(); mobSprintPressed = true; }, { passive: false });
  sprintBtn.addEventListener('touchend',   () => { mobSprintPressed = false; });
}
