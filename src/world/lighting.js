import { BASE_HEMI, BASE_AMBIENT, BASE_PLAYER, BASE_CEIL, BASE_FOG } from '../core/config.js';
import { state } from '../core/state.js';
import { LEVELS } from '../levels/index.js';
import { scene, hemi, ambient, playerLight } from '../core/scene.js';
import { ceilingLights, lightPanels } from './builder.js';

export function applyLevelLighting() {
  const lv = LEVELS[state.currentLevel];
  hemi.intensity        = BASE_HEMI    * lv.lm * state.userBrightness;
  ambient.intensity     = BASE_AMBIENT * lv.lm * state.userBrightness;
  playerLight.intensity = BASE_PLAYER  * lv.lm * state.userBrightness;
  hemi.color.setHex(lv.ambientColor);
  ceilingLights.forEach(l => l.intensity = BASE_CEIL * lv.lm * state.userBrightness);
  scene.fog.color.setHex(lv.fogColor);
  scene.background.setHex(lv.fogColor);
  scene.fog.density = BASE_FOG * lv.fm;
  const pi = Math.max(0.15, lv.lm);
  const r = Math.floor(0xcc * pi), g = Math.floor(0xb0 * pi), b = Math.floor(0x80 * pi);
  lightPanels.forEach(p => p.material.color.setHex((r << 16) | (g << 8) | b));
}

export function updateFlicker(dt, noiseFn) {
  state.flashTimer += dt;
  const lv = LEVELS[state.currentLevel];
  if (!state.flickering && state.flashTimer > state.nextFlicker) {
    state.flickering = true;
    state.flickerEnd = state.flashTimer + 0.08 + Math.random() * 0.22;
    noiseFn(0.05, 0.12, 80, 4000);
  }
  if (state.flickering) {
    const on = Math.random() < 0.55;
    const k = on ? 1 : 0.3;
    ceilingLights.forEach(l => l.intensity = BASE_CEIL * lv.lm * state.userBrightness * k);
    if (state.flashTimer > state.flickerEnd) {
      state.flickering = false;
      ceilingLights.forEach(l => l.intensity = BASE_CEIL * lv.lm * state.userBrightness);
      state.flashTimer = 0;
      state.nextFlicker = (10 + Math.random() * 14) / lv.flickerMul;
    }
  }
}
