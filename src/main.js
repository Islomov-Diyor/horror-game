import * as THREE from 'three';
import { TILE, CH, PLAYER_R, WALK_SPD, SPRINT_SPD, BASE_HEMI, BASE_AMBIENT, BASE_PLAYER, BASE_CEIL, BASE_FOG } from './core/config.js';
import { state } from './core/state.js';
import { LEVEL_GRIDS, LEVELS } from './levels/index.js';
import { setGrid, MAP_W, MAP_H, getCurGW, getCurGH, getCurGrid, isWall, tileAt, inMap, tileCenter, worldToTile, findSpawnTile, allFloorTiles, pickFarFloorTile, tilesAdjacentToWall, aStar } from './world/map.js';
import { scene, camera, cvEl, renderer, audioListener, hemi, ambient, playerLight, flashlight, flashTarget, levelGroup } from './core/scene.js';
import { LEVEL_TEX, wallTex, floorTex, ceilingTex, paperTex, signTex } from './world/textures.js';
import { ceilingLights, lightPanels, registerClearCallback, disposeNode, clearLevel, buildLevelGeometry, buildDust, updateDust } from './world/builder.js';
import { applyLevelLighting, updateFlicker } from './world/lighting.js';
import { keyGroup, doorGroup, hidingSpots, batteryPickups, notePickups, monsterWaypoints, NOTE_LORE, buildKey, buildDoor, buildHidingSpot, buildBattery, buildNote } from './world/collectibles.js';

import { MONSTER, buildMonster, animateMonster, monsterSpawnBehindPlayer, updateMonsterAI, runJumpscare, resizeJs, setTriggerGameOver } from './monster/index.js';

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
  stopAmbient(); stopTenseLayer(); stopChaseLayer();
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
  stopAmbient(); stopTenseLayer(); stopChaseLayer(); stopMonsterSound();
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
  stopAmbient(); stopTenseLayer(); stopChaseLayer(); stopMonsterSound();
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
  if (AC) { startAmbient(); startTenseLayer(); startChaseLayer(); startMonsterSound(); }

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
//  state.game LOOP
// ═══════════════════════════════════════════════════════════════════
let last = 0, raf = 0;
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min((now - last)/1000, 0.05);
  last = now;
  if (state.game && !state.paused && !P.noteReading) {
    updatePlayer(dt);
    updateFlashlight(dt);
    updateFlicker(dt, noise);
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
  // render
  if (state.fxEnabled && fxMat) {
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

setTriggerGameOver(triggerGameOver);
setupInput(P, { toggleFlashlight, handleInteract, closeNote, pauseGame, resumeGame, showHud });

// initial black render
renderer.render(scene, camera);

