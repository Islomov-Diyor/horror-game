import * as THREE from 'three';
import { TILE, CH, PLAYER_R, WALK_SPD, SPRINT_SPD, BASE_HEMI, BASE_AMBIENT, BASE_PLAYER, BASE_CEIL, BASE_FOG } from './core/config.js';
import { state } from './core/state.js';
import { LEVEL_GRIDS, LEVELS } from './levels/index.js';
import { setGrid, MAP_W, MAP_H, getCurGW, getCurGH, getCurGrid, isWall, tileAt, inMap, tileCenter, worldToTile, findSpawnTile, allFloorTiles, pickFarFloorTile, tilesAdjacentToWall, aStar } from './world/map.js';
import { scene, camera, cvEl, renderer, audioListener, hemi, ambient, playerLight, flashlight, flashTarget, levelGroup } from './core/scene.js';
import { LEVEL_TEX, wallTex, floorTex, ceilingTex, paperTex, signTex } from './world/textures.js';
import { ceilingLights, lightPanels, registerClearCallback, disposeNode, clearLevel, buildLevelGeometry, buildDust, updateDust } from './world/builder.js';
import { scatterProps } from './world/props.js';
import { startAmbience, stopAmbience, tickAmbience } from './audio/ambience.js';
import { applyLevelLighting, updateFlicker } from './world/lighting.js';
import { keyGroup, doorGroup, hidingSpots, batteryPickups, notePickups, monsterWaypoints, NOTE_LORE, buildKey, buildDoor, buildHidingSpot, buildBattery, buildNote } from './world/collectibles.js';
import { initAudio, setMasterVolume, noise, osc, startAmbient, stopAmbient, startTenseLayer, stopTenseLayer, startChaseLayer, stopChaseLayer, startMonsterSound, stopMonsterSound, updateMonsterAudio, updateMusicMix, heartbeat, keyPickupSound, batteryPickupSound, notePickupSound, doorOpenSound, flashClick, lockerClose, chaseSting, deathScream, isAudioReady } from './audio/manager.js';
import { JS, mobSprintPressed, pollGamepad, setupInput } from './input/index.js';

import { MONSTER, buildMonster, animateMonster, monsterSpawnBehindPlayer, updateMonsterAI, runJumpscare, resizeJs, setTriggerGameOver } from './monster/index.js';
import { fxRT, fxScene, fxCam, fxMat, initPostFX, resizePostFX } from './core/postfx.js';

// ─── player state object ───────────────────────────────────────────
const P = {
  x: 0, y: 1.7, z: 0,
  yaw: 0, pitch: 0,
  hasKey: false,
  stamina: 1.0,
  battery: 1.0,
  flashOn: false,
  hiding: false, hideSpot: null,
  noteReading: false, noteCurrent: null,
  noiseLevel: 0,
  notesTotalThisLevel: 0,
  notesFoundThisLevel: 0,
  sprintHeld: false,
  bobPhase: 0,
  keys: {},
};

// ═══════════════════════════════════════════════════════════════════
//  state.game OVER / LEVEL FLOW
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
  if (state.jsTriggered) return;
  state.jsTriggered = true; state.game = false;
  deathScream();
  hemi.intensity = 0.05;
  ambient.intensity = 0.03;
  ceilingLights.forEach(l => l.intensity = 0);
  stopAmbient(); stopTenseLayer(); stopChaseLayer(); stopAmbience();
  setTimeout(() => runJumpscare(showGameOver), 260);
}

function showGameOver() {
  const s = Math.floor((Date.now() - state.levelStartTime)/1000);
  document.getElementById('goTime').textContent = `Level ${LEVELS[state.currentLevel].n} — ${fmtTime(s)}`;
  document.getElementById('gameOver').style.display = 'flex';
  document.getElementById('bottomBar').style.display = 'none';
  document.getElementById('levelHud').style.display = 'none';
  document.getElementById('timerHud').style.display = 'none';
  document.body.classList.remove('chase');
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
}

function levelComplete() {
  if (!state.game) return;
  state.game = false;
  const s = Math.floor((Date.now() - state.levelStartTime)/1000);
  state.totalTime += s;
  stopAmbient(); stopTenseLayer(); stopChaseLayer(); stopMonsterSound(); stopAmbience();
  document.body.classList.remove('chase');
  document.getElementById('bottomBar').style.display = 'none';
  document.getElementById('levelHud').style.display = 'none';
  document.getElementById('timerHud').style.display = 'none';
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
  // save best time
  const prev = getBestTime(state.currentLevel);
  const newBest = (prev === null || s < prev);
  if (newBest) setBestTime(state.currentLevel, s);
  if (state.currentLevel >= LEVELS.length - 1) {
    document.getElementById('fwMsg').textContent =
      `Barcha 5 levelni tugatdingiz!\nJami vaqt: ${fmtTime(state.totalTime)}\n\nEng yaxshi vaqtlar:\n` +
      LEVELS.map((lv, i) => ` L${lv.n}: ${fmtTime(getBestTime(i)||0)}`).join('\n');
    document.getElementById('finalWin').style.display = 'flex';
  } else {
    document.getElementById('lcTitle').textContent = `LEVEL ${LEVELS[state.currentLevel].n} TUGADI`;
    let msg = `Vaqt: ${fmtTime(s)}\nXatlar: ${P.notesFoundThisLevel}/${P.notesTotalThisLevel}\nKeyingi level: ${LEVELS[state.currentLevel+1].name} (${LEVELS[state.currentLevel+1].n}/5)`;
    document.getElementById('lcMsg').textContent = msg;
    document.getElementById('lcBest').textContent = newBest
      ? '★ YANGI REKORD!'
      : (prev !== null ? `Eng yaxshi: ${fmtTime(prev)}` : '');
    document.getElementById('levelComplete').style.display = 'flex';
  }
}

function nextLevel() {
  document.getElementById('levelComplete').style.display = 'none';
  state.currentLevel++;
  resetState();
  cvEl.requestPointerLock();
}

function restartFromLevel1() {
  ['gameOver','levelComplete','finalWin'].forEach(id => document.getElementById(id).style.display = 'none');
  state.currentLevel = 0;
  state.totalTime = 0;
  resetState();
  cvEl.requestPointerLock();
}

function quitToMenu() {
  state.game = false; state.paused = false;
  document.getElementById('pauseMenu').style.display = 'none';
  document.getElementById('startScreen').style.display = 'flex';
  document.getElementById('bottomBar').style.display = 'none';
  document.getElementById('levelHud').style.display = 'none';
  document.getElementById('timerHud').style.display = 'none';
  document.body.classList.remove('chase');
  stopAmbient(); stopTenseLayer(); stopChaseLayer(); stopMonsterSound(); stopAmbience();
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
}

function pauseGame() {
  if (!state.game || state.paused) return;
  state.paused = true;
  document.getElementById('pauseMenu').style.display = 'flex';
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
}
function resumeGame() {
  if (!state.paused) return;
  state.paused = false;
  document.getElementById('pauseMenu').style.display = 'none';
  document.getElementById('settingsModal').style.display = 'none';
  if (state.game) cvEl.requestPointerLock();
}

// ═══════════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════════
function openSettings() {
  // hydrate from stored values
  document.getElementById('sSens').value = state.mouseSens;
  document.getElementById('sVol').value = state.userVolume;
  document.getElementById('sBright').value = state.userBrightness;
  document.getElementById('sFx').value = state.fxEnabled ? '1' : '0';
  document.getElementById('sFlash').value = state.flashlightIntensity;
  document.getElementById('settingsModal').style.display = 'flex';
}
function closeSettings() {
  document.getElementById('settingsModal').style.display = 'none';
  saveSettings();
}
document.addEventListener('DOMContentLoaded', () => {});
function bindSettings() {
  document.getElementById('sSens').addEventListener('input', e => state.mouseSens = parseFloat(e.target.value));
  document.getElementById('sVol').addEventListener('input', e => {
    state.userVolume = parseFloat(e.target.value);
    setMasterVolume(state.userVolume);
  });
  document.getElementById('sBright').addEventListener('input', e => {
    state.userBrightness = parseFloat(e.target.value);
    applyLevelLighting();
  });
  document.getElementById('sFx').addEventListener('change', e => {
    state.fxEnabled = e.target.value === '1';
  });
  document.getElementById('sFlash').addEventListener('input', e => state.flashlightIntensity = parseFloat(e.target.value));
}
function loadSettings() {
  try {
    const j = JSON.parse(localStorage.getItem('br_settings') || '{}');
    if (j.sens) state.mouseSens = j.sens;
    if (j.vol !== undefined) state.userVolume = j.vol;
    if (j.bright) state.userBrightness = j.bright;
    if (j.fx !== undefined) state.fxEnabled = !!j.fx;
    if (j.flash) state.flashlightIntensity = j.flash;
  } catch(e) {}
}
function saveSettings() {
  try {
    localStorage.setItem('br_settings', JSON.stringify({
      sens: state.mouseSens, vol: state.userVolume, bright: state.userBrightness, fx: state.fxEnabled, flash: state.flashlightIntensity
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
  setGrid(LEVEL_GRIDS[state.currentLevel]);

  buildLevelGeometry();
  scatterProps(levelGroup, LEVELS[state.currentLevel]);
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
  const numHiding = 3 + state.currentLevel;
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
  const numBatteries = Math.max(2, 4 - Math.floor(state.currentLevel/2));
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
  state.flashTimer = 0;
  state.nextFlicker = (10 + Math.random() * 8) / LEVELS[state.currentLevel].flickerMul;
  state.flickering = false;
  state.jsTriggered = false;

  // HUD reset
  document.getElementById('keyHudNew').style.display = 'none';
  document.getElementById('levelHud').style.display = 'block';
  document.getElementById('levelHud').textContent = `LEVEL ${LEVELS[state.currentLevel].n} / 5 — ${LEVELS[state.currentLevel].name}`;
  document.getElementById('timerHud').style.display = 'block';
  document.getElementById('bottomBar').style.display = 'flex';
  document.getElementById('hud').style.opacity = '0';
  document.body.classList.remove('chase');
  updateNoteCount();

  // audio
  if (isAudioReady()) { startAmbient(); startTenseLayer(); startChaseLayer(); startMonsterSound(); startAmbience(LEVELS[state.currentLevel]); }

  state.levelStartTime = Date.now();
  if (state.currentLevel === 0) state.startTime = state.levelStartTime;
  state.game = true; state.paused = false;

  showHud(`LEVEL ${LEVELS[state.currentLevel].n} — kalitni top, eshikni och`, 5500);
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
  if (!state.game || state.paused || state.jsTriggered) return;

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
//  FLASHLIGHT
// ═══════════════════════════════════════════════════════════════════
function toggleFlashlight() {
  if (!state.game || state.paused || P.hiding) return;
  if (P.battery <= 0 && !P.flashOn) { showHud('BATAREYA TUGADI', 1600); return; }
  P.flashOn = !P.flashOn;
  flashClick();
  if (P.flashOn) P.noiseLevel = Math.max(P.noiseLevel, 0.4);
}

function updateFlashlight(dt) {
  if (P.flashOn) {
    P.battery -= dt * 0.025;
    if (P.battery <= 0) { P.battery = 0; P.flashOn = false; flashClick(); showHud('BATAREYA TUGADI', 2000); }
  }
  const target = (P.flashOn && !P.hiding) ? state.flashlightIntensity : 0;
  flashlight.intensity += (target - flashlight.intensity) * Math.min(1, dt * 8);
  flashlight.position.set(P.x, P.y - 0.1, P.z);
  const fx = P.x - Math.sin(P.yaw) * Math.cos(P.pitch);
  const fy = P.y - 0.1 + Math.sin(P.pitch);
  const fz = P.z - Math.cos(P.yaw) * Math.cos(P.pitch);
  flashTarget.position.set(fx, fy, fz);
  document.getElementById('batteryFill').style.width = (P.battery * 100).toFixed(0) + '%';
  const fill = document.getElementById('batteryFill');
  fill.style.background = P.battery < 0.2
    ? 'linear-gradient(90deg,#cc2200,#ff6644)'
    : 'linear-gradient(90deg,#ffcc22,#ffeeaa)';
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
  if (P.keys['KeyW'] || P.keys['ArrowUp'])    { mx -= sY; mz -= cY; }
  if (P.keys['KeyS'] || P.keys['ArrowDown'])  { mx += sY; mz += cY; }
  if (P.keys['KeyA'] || P.keys['ArrowLeft'])  { mx -= cY; mz += sY; }
  if (P.keys['KeyD'] || P.keys['ArrowRight']) { mx += cY; mz -= sY; }
  const gp = pollGamepad(dt, P);
  if (Math.abs(gp.mx) > 0.01 || Math.abs(gp.mz) > 0.01) {
    mx = gp.mx * cY + gp.mz * (-sY);
    mz = gp.mx * (-sY) + gp.mz * (-cY);
  }
  if (JS.active) {
    mx = JS.x * cY + JS.y * (-sY);
    mz = JS.x * (-sY) + JS.y * (-cY);
  }
  const len = Math.sqrt(mx*mx + mz*mz);
  const moving = len > 0.08;
  const wantSprint = (P.keys['ShiftLeft'] || P.keys['ShiftRight'] || gp.sprint || mobSprintPressed);
  const sprinting = wantSprint && moving && P.stamina > 0.02;
  const speed = sprinting ? SPRINT_SPD : WALK_SPD;
  if (moving) {
    const invL = 1 / len;
    const vx = mx * invL * speed * dt;
    const vz = mz * invL * speed * dt;
    if (inMap(P.x + vx, P.z, PLAYER_R)) P.x += vx;
    if (inMap(P.x, P.z + vz, PLAYER_R)) P.z += vz;
    P.bobPhase += dt * (sprinting ? 10 : 6);
    P.y = 1.7 + Math.sin(P.bobPhase) * (sprinting ? 0.08 : 0.045);
    if (sprinting) P.noiseLevel = Math.max(P.noiseLevel, 0.5);
    else           P.noiseLevel = Math.max(P.noiseLevel, 0.04);
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
//  HIDING & NOTES
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
  P.flashOn = false;
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
  if (state.game && !state.paused) cvEl.requestPointerLock();
}
function openNote(note) {
  P.noteReading = true; P.noteCurrent = note;
  document.getElementById('noteTitle').textContent = note.title;
  document.getElementById('noteBody').textContent = note.text;
  document.getElementById('noteReader').style.display = 'flex';
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
}
function closeNote() {
  P.noteReading = false;
  document.getElementById('noteReader').style.display = 'none';
  if (state.game && !state.paused) cvEl.requestPointerLock();
}
function handleInteract() {
  if (!state.game || state.paused) return;
  if (P.hiding) { exitHide(); return; }
  for (const n of notePickups) {
    if (n.taken) continue;
    if (Math.hypot(P.x - n.worldX, P.z - n.worldZ) < 1.0) {
      n.taken = true; n.group.visible = false;
      P.notesFoundThisLevel++;
      updateNoteCount();
      notePickupSound();
      openNote(n);
      return;
    }
  }
  const h = findNearestHideSpot();
  if (h && !h.occupied) { enterHide(h); return; }
}
function updateInteractHud() {
  if (P.hiding || P.noteReading || state.paused) {
    document.getElementById('interactHud').style.display = 'none'; return;
  }
  const hud = document.getElementById('interactHud');
  for (const n of notePickups) {
    if (n.taken) continue;
    if (Math.hypot(P.x - n.worldX, P.z - n.worldZ) < 1.0) {
      hud.textContent = "[ E ] — xatni o'qish"; hud.style.display = 'block'; return;
    }
  }
  const h = findNearestHideSpot();
  if (h && !h.occupied) { hud.textContent = '[ E ] — yashirinish'; hud.style.display = 'block'; return; }
  hud.style.display = 'none';
}
function updateNoteCount() {
  document.getElementById('noteCount').textContent = P.notesFoundThisLevel + ' / ' + P.notesTotalThisLevel;
}

// ═══════════════════════════════════════════════════════════════════
//  state.game LOOP
// ═══════════════════════════════════════════════════════════════════
let last = 0, raf = 0;
let shakeX = 0, shakeY = 0, shakeDecay = 0;
let hbPulse = 0;
let wasChasing = false;
let prevHeartTimer = 0;

function triggerShake(amount) {
  shakeX = (Math.random() - 0.5) * amount;
  shakeY = (Math.random() - 0.5) * amount;
  shakeDecay = amount;
}

function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min((now - last)/1000, 0.05);
  last = now;
  if (state.game && !state.paused && !P.noteReading) {
    updatePlayer(dt);
    updateFlashlight(dt);
    updateFlicker(dt, noise);
    tickAmbience(dt);
    updateKeyAndDoor(dt);
    updateMonsterAI(dt);
    animateMonster(dt);
    updateDust(dt);
    updateMonsterAudio(Math.hypot(P.x - MONSTER.x, P.z - MONSTER.z), P.x, P.z, P.yaw, MONSTER.x, MONSTER.z, MONSTER.spawned, MONSTER.state);
    updateMusicMix(dt, MONSTER.spawned, MONSTER.state, MONSTER.x, MONSTER.z, P.x, P.z);
    updateInteractHud();
    // timer hud
    const s = Math.floor((Date.now() - state.levelStartTime)/1000);
    document.getElementById('timerHud').textContent = `⏱ ${fmtTime(s)}   🗒 ${P.notesFoundThisLevel}/${P.notesTotalThisLevel}${P.hasKey?'   🔑':''}`;
  }
  // chase-start flash + shake
  const isChasing = MONSTER.state === 'chase' && MONSTER.spawned;
  if (isChasing && !wasChasing) triggerShake(0.018);
  wasChasing = isChasing;

  const monDist = MONSTER.spawned ? Math.hypot(P.x - MONSTER.x, P.z - MONSTER.z) : 99;

  // screen shake during chase (more intense when close)
  if (isChasing && monDist < 10) {
    const shakeAmt = Math.max(0, (10 - monDist) / 10) * 0.006;
    shakeX += (Math.random() - 0.5) * shakeAmt;
    shakeY += (Math.random() - 0.5) * shakeAmt;
  }
  shakeX *= 0.82;
  shakeY *= 0.82;

  // heartbeat vignette pulse — fires when heartTimer resets (heartbeat just played)
  if (state.heartTimer < prevHeartTimer && prevHeartTimer > 0) hbPulse = 1.0;
  prevHeartTimer = state.heartTimer;
  hbPulse *= 0.88;

  // render
  if (state.fxEnabled && fxMat) {
    fxMat.uniforms.time.value = now * 0.001;
    const chaseU = isChasing ? 1.0 : (MONSTER.state === 'investigate' ? 0.25 : 0);
    fxMat.uniforms.chase.value += (chaseU - fxMat.uniforms.chase.value) * 0.06;
    fxMat.uniforms.vignetteStrength.value = P.hiding ? 1.6 : 1.0;
    fxMat.uniforms.heartbeat.value = hbPulse;
    fxMat.uniforms.shake.value.set(shakeX, shakeY);
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
  state.currentLevel = 0;
  state.totalTime = 0;
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

initPostFX();
buildMonster();

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  resizePostFX();
  resizeJs();
});

setTriggerGameOver(triggerGameOver);
setupInput(P, { toggleFlashlight, handleInteract, closeNote, pauseGame, resumeGame, showHud });

// expose functions needed by inline HTML onclick handlers
window.startGame       = startGame;
window.openSettings    = openSettings;
window.closeSettings   = closeSettings;
window.downloadGame    = downloadGame;
window.restartFromLevel1 = restartFromLevel1;
window.nextLevel       = nextLevel;
window.quitToMenu      = quitToMenu;
window.resumeGame      = resumeGame;
window.pauseGame       = pauseGame;

// initial black render
renderer.render(scene, camera);

