import { state } from '../core/state.js';

let AC = null;
let masterGain = null;

export function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    AC.resume();
    masterGain = AC.createGain();
    masterGain.gain.value = state.userVolume;
    masterGain.connect(AC.destination);
  } catch (e) { AC = null; }
}

export function setMasterVolume(v) {
  if (masterGain) masterGain.gain.value = v;
}

export function osc(freq, type, vol, dur, dest) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g); g.connect(dest || masterGain);
  o.start(); o.stop(AC.currentTime + dur);
}

export function noise(vol, dur, lo, hi, dest) {
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

let ambientNodes = [];
export function startAmbient() {
  if (!AC) return;
  stopAmbient();
  const a = AC.createGain();
  a.gain.value = 0.45;
  a.connect(masterGain);
  ambientNodes.push(a);
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
export function stopAmbient() {
  ambientNodes.forEach(n => { try { if (n.stop) n.stop(); } catch(e){} });
  ambientNodes = [];
}

let tenseGain = null, tenseOsc = null;
export function startTenseLayer() {
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
export function stopTenseLayer() {
  if (tenseOsc) { try { tenseOsc.stop(); } catch(e){} tenseOsc = null; }
  if (tenseGain) { try { tenseGain.disconnect(); } catch(e){} tenseGain = null; }
}

let chaseGain = null, chaseOscs = [];
export function startChaseLayer() {
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
export function stopChaseLayer() {
  chaseOscs.forEach(o => { try { o.stop(); } catch(e){} });
  chaseOscs = [];
  if (chaseGain) { try { chaseGain.disconnect(); } catch(e){} chaseGain = null; }
}

let monsterPanner = null, monsterBreathOsc = null, monsterBreathGain = null;
export function startMonsterSound() {
  if (!AC || monsterPanner) return;
  monsterPanner = AC.createPanner();
  monsterPanner.panningModel = 'HRTF';
  monsterPanner.distanceModel = 'inverse';
  monsterPanner.refDistance = 1.5;
  monsterPanner.maxDistance = 30;
  monsterPanner.rolloffFactor = 2.0;
  monsterPanner.connect(masterGain);
  const src = AC.createOscillator();
  src.type = 'sawtooth';
  src.frequency.value = 40;
  monsterBreathGain = AC.createGain();
  monsterBreathGain.gain.value = 0.0;
  const flt = AC.createBiquadFilter();
  flt.type = 'bandpass'; flt.frequency.value = 180; flt.Q.value = 3;
  const lfo = AC.createOscillator();
  lfo.type = 'sine'; lfo.frequency.value = 0.6;
  const lfoG = AC.createGain(); lfoG.gain.value = 0.08;
  lfo.connect(lfoG); lfoG.connect(monsterBreathGain.gain);
  src.connect(flt); flt.connect(monsterBreathGain); monsterBreathGain.connect(monsterPanner);
  src.start(); lfo.start();
  monsterBreathOsc = src;
}
export function stopMonsterSound() {
  if (monsterBreathOsc) { try { monsterBreathOsc.stop(); } catch(e){} monsterBreathOsc = null; }
  if (monsterBreathGain) { try { monsterBreathGain.disconnect(); } catch(e){} monsterBreathGain = null; }
  if (monsterPanner) { try { monsterPanner.disconnect(); } catch(e){} monsterPanner = null; }
}
export function updateMonsterAudio(dist, camX, camZ, camYaw, monX, monZ, monSpawned, monState) {
  if (!AC || !monsterPanner) return;
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
    monsterPanner.positionX.value = monX;
    monsterPanner.positionY.value = 1.4;
    monsterPanner.positionZ.value = monZ;
  } else if (monsterPanner.setPosition) {
    monsterPanner.setPosition(monX, 1.4, monZ);
  }
  if (monsterBreathGain) {
    const target = monSpawned
      ? Math.max(0, Math.min(0.6, (12 - dist) / 12)) * (monState === 'chase' ? 1.4 : 1.0)
      : 0;
    monsterBreathGain.gain.setTargetAtTime(target, AC.currentTime, 0.3);
  }
}

let _onHeartbeat = null;
export function setHeartbeatCallback(fn) { _onHeartbeat = fn; }

export function heartbeat(v) {
  osc(52, 'sine', v, 0.1);
  setTimeout(() => osc(42, 'sine', v*0.6, 0.08), 130);
  if (_onHeartbeat) _onHeartbeat();
}
export function keyPickupSound() {
  osc(880, 'sine', 0.18, 0.12);
  setTimeout(() => osc(1320, 'sine', 0.14, 0.15), 80);
  setTimeout(() => osc(1760, 'sine', 0.1,  0.2),  180);
}
export function batteryPickupSound() {
  osc(660, 'triangle', 0.14, 0.15);
  setTimeout(() => osc(990, 'triangle', 0.1, 0.2), 90);
}
export function notePickupSound() {
  noise(0.08, 0.25, 400, 2400);
}
export function doorOpenSound() {
  for (let i = 0; i < 6; i++) setTimeout(() => osc(200+i*80, 'sawtooth', 0.08, 0.3), i*60);
  setTimeout(() => { for (let i = 0; i < 4; i++) setTimeout(() => osc(440+i*220, 'sine', 0.12, 0.4), i*100); }, 400);
}
export function flashClick() {
  osc(1400, 'square', 0.04, 0.03);
}
export function lockerClose() {
  noise(0.1, 0.2, 80, 500);
  setTimeout(() => osc(120, 'sine', 0.08, 0.15), 60);
}
export function chaseSting() {
  if (!AC) return;
  for (let i = 0; i < 4; i++) {
    const o = AC.createOscillator();
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
export function deathScream() {
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
export function monsterFootstep(dist) {
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

export function updateMusicMix(dt, monSpawned, monState, monX, monZ, pX, pZ) {
  if (!AC) return;
  const dist = monSpawned ? Math.hypot(pX - monX, pZ - monZ) : 99;
  const isChase = monState === 'chase';
  const isInvestigate = monState === 'investigate';
  const tenseTarget = monSpawned && !isChase ? Math.max(0, Math.min(0.35, (15 - dist) / 15)) : 0;
  const chaseTarget = isChase ? 0.35 : (isInvestigate ? 0.12 : 0);
  if (tenseGain) tenseGain.gain.setTargetAtTime(tenseTarget, AC.currentTime, 0.5);
  if (chaseGain) chaseGain.gain.setTargetAtTime(chaseTarget, AC.currentTime, 0.3);

  if (monSpawned && dist < 14) {
    state.heartTimer += dt;
    const rate = isChase ? 2.8 : Math.max(0.6, (15 - dist) / 7);
    if (state.heartTimer > 0.85 / rate) {
      heartbeat(Math.min(0.2, 0.08 + (10 - dist)/70));
      state.heartTimer = 0;
    }
  }

  if (isChase) document.body.classList.add('chase');
  else         document.body.classList.remove('chase');
}
