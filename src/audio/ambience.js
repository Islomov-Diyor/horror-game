import { noise, osc } from './manager.js';

let timer = 0;
let nextEvent = 0;
let currentTheme = null;

function randBetween(a, b) { return a + Math.random() * (b - a); }

function scheduleNext() {
  nextEvent = randBetween(15, 40);
  timer = 0;
}

// ── sound builders ─────────────────────────────────────────────────

function drip() {
  osc(randBetween(600, 900), 'sine', 0.04, 0.08);
  setTimeout(() => osc(randBetween(400, 700), 'sine', 0.03, 0.06), randBetween(80, 200));
}

function distantFootstep() {
  noise(0.03, 0.1, 60, 300);
  setTimeout(() => noise(0.025, 0.09, 60, 300), randBetween(300, 600));
}

function metalCreak() {
  osc(randBetween(180, 320), 'sawtooth', 0.035, 0.4);
}

function windGust() {
  noise(0.04, 0.8, 200, 800);
}

function chainRattle() {
  for (let i = 0; i < 4; i++) {
    setTimeout(() => noise(0.03, 0.07, 800, 3000), i * randBetween(60, 120));
  }
}

function muffledVoice() {
  // low bandpass noise simulating a distant muffled voice
  noise(0.035, 0.6, 200, 600);
  setTimeout(() => noise(0.025, 0.4, 200, 600), 700);
}

function deepRumble() {
  noise(0.045, 1.2, 20, 80);
}

function distantWhisper() {
  noise(0.03, 0.5, 300, 900);
}

function lowThud() {
  osc(38, 'sine', 0.05, 0.3);
  setTimeout(() => noise(0.04, 0.2, 30, 120), 50);
}

function eerieHum() {
  osc(randBetween(55, 80), 'sine', 0.03, 1.0);
}

// ── themes ─────────────────────────────────────────────────────────

const THEMES = {
  mahalla:  [drip, distantFootstep, metalCreak, drip],
  tunnel:   [metalCreak, windGust, distantFootstep, metalCreak],
  mahbas:   [chainRattle, muffledVoice, distantFootstep, chainRattle],
  chuqur:   [deepRumble, distantWhisper, lowThud, eerieHum],
  jahannam: [deepRumble, lowThud, eerieHum, distantWhisper],
};

// ── public API ─────────────────────────────────────────────────────

export function startAmbience(levelConfig) {
  currentTheme = THEMES[levelConfig.propTheme] || null;
  scheduleNext();
}

export function stopAmbience() {
  currentTheme = null;
  timer = 0;
  nextEvent = 0;
}

export function tickAmbience(dt) {
  if (!currentTheme) return;
  timer += dt;
  if (timer >= nextEvent) {
    const fn = currentTheme[Math.floor(Math.random() * currentTheme.length)];
    fn();
    scheduleNext();
  }
}
