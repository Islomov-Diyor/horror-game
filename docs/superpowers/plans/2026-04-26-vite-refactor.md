# Vite Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the single-file `index.html` Backrooms horror game into a Vite project with clean module boundaries, ready for future content and Netlify/GitHub Pages deployment.

**Architecture:** Each game system becomes an ES module with explicit imports/exports. `src/main.js` owns the game loop and wires all modules together. Three.js moves from CDN to npm. Static assets (future `.glb` monsters, textures, audio files) live in `public/assets/`.

**Tech Stack:** Vite 5, Three.js r165 (npm), vanilla JS (no TypeScript), Web Audio API

---

## File Map

| File | Responsibility |
|------|---------------|
| `index.html` | Minimal shell — only HTML structure and `<script type="module" src="/src/main.js">` |
| `src/main.js` | Game loop (`loop()`), `startGame()`, `resetState()`, `downloadGame()`, boot wiring |
| `src/core/config.js` | All numeric constants (TILE, speeds, light bases) |
| `src/core/state.js` | Mutable game globals (GAME, PAUSED, currentLevel, totalTime, timers) |
| `src/core/scene.js` | Three.js scene, camera, renderer, lights, flashlight, levelGroup |
| `src/core/postfx.js` | Post-processing render target, shader material, `initPostFX()` |
| `src/levels/index.js` | Exports `LEVEL_GRIDS[]` and `LEVELS[]` assembled from level files |
| `src/levels/level1.js`–`level5.js` | Grid string array + config object per level |
| `src/world/map.js` | Tile utilities: `setGrid()`, `isWall()`, `tileAt()`, `inMap()`, `tileCenter()`, `worldToTile()`, `findSpawnTile()`, `allFloorTiles()`, `pickFarFloorTile()`, `tilesAdjacentToWall()`, `aStar()` |
| `src/world/textures.js` | Procedural texture generators: `wallTex()`, `floorTex()`, `ceilingTex()`, `paperTex()`, `signTex()`, `LEVEL_TEX[]` |
| `src/world/builder.js` | `buildLevelGeometry()`, `disposeNode()`, `clearLevel()`, exports `ceilingLights[]`, `lightPanels[]` |
| `src/world/lighting.js` | `applyLevelLighting()`, `updateFlicker()` |
| `src/world/collectibles.js` | `buildKey()`, `buildDoor()`, `buildHidingSpot()`, `buildBattery()`, `buildNote()`, `updateKeyAndDoor()`, exports pickup arrays and `NOTE_LORE[]` |
| `src/player/controller.js` | Player state `P`, `updatePlayer()` |
| `src/player/stamina.js` | `updateStamina()` |
| `src/player/flashlight.js` | `toggleFlashlight()`, `updateFlashlight()` |
| `src/input/keyboard.js` | `initKeyboard()` — keydown/keyup listeners, exports `getKeys()` |
| `src/input/mouse.js` | `initMouse()` — pointer lock + mousemove |
| `src/input/mobile.js` | `initMobile()`, exports `getJoystick()`, `isMobSprintPressed()` |
| `src/monster/ai.js` | Monster state `MONSTER`, `buildMonster()`, `animateMonster()`, `updateMonsterAI()`, `monsterSpawnBehindPlayer()` |
| `src/monster/jumpscare.js` | `triggerGameOver()`, `runJumpscare()`, `drawJsFace()` |
| `src/audio/manager.js` | All Web Audio: `initAudio()`, ambient/tense/chase layers, spatial monster sound, all SFX, `updateMusicMix()` |
| `src/hud/hud.js` | `showHud()`, `updateNoteCount()`, `updateInteractHud()`, `fmtTime()` |
| `src/ui/screens.js` | `showGameOver()`, `levelComplete()`, `nextLevel()`, `restartFromLevel1()` |
| `src/ui/pause.js` | `pauseGame()`, `resumeGame()`, `quitToMenu()` |
| `src/ui/noteReader.js` | `openNote()`, `closeNote()` |
| `src/ui/hideOverlay.js` | `enterHide()`, `exitHide()`, `findNearestHideSpot()` |
| `src/ui/settings.js` | `openSettings()`, `closeSettings()`, `bindSettings()`, `loadSettings()`, `saveSettings()` |
| `public/assets/models/` | Drop `.glb` monster files here (Meshy/Tripo output) |
| `public/assets/textures/` | Future texture files |
| `public/assets/audio/` | Future `.ogg`/`.mp3` files |

---

## Task 1: Scaffold Vite project

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `src/main.js` (temporary — full inline script)
- Modify: `index.html` (strip `<script src="...three.min.js">`, add module entry)
- Create: `public/assets/models/.gitkeep`
- Create: `public/assets/textures/.gitkeep`
- Create: `public/assets/audio/.gitkeep`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "backrooms-horror",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "three": "^0.165.0"
  },
  "devDependencies": {
    "vite": "^5.2.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `three` and `vite` installed.

- [ ] **Step 4: Create temporary `src/main.js`**

Copy the entire content between the opening `<script>` tag (line 270) and the closing `</script>` tag (line 2747) of `index.html` into `src/main.js`. Then add this one line at the very top of `src/main.js`:

```js
import * as THREE from 'three';
```

Remove the `'use strict';` line (Vite ES modules are strict by default).

- [ ] **Step 5: Update `index.html`**

Replace:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
'use strict';
... (all game JS) ...
</script>
```

With:
```html
<script type="module" src="/src/main.js"></script>
```

The rest of the HTML (all the `<div>` elements, `<style>`, `<canvas>`) stays exactly as-is.

- [ ] **Step 6: Create asset directory placeholders**

```bash
mkdir -p public/assets/models public/assets/textures public/assets/audio
touch public/assets/models/.gitkeep public/assets/textures/.gitkeep public/assets/audio/.gitkeep
```

- [ ] **Step 7: Verify game runs**

Run: `npm run dev`
Open browser at `http://localhost:5173`
Expected: Start screen appears, game is fully playable — all 5 levels, monster, flashlight, mobile controls.

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Vite project, game runs from src/main.js"
```

---

## Task 2: Extract `src/core/config.js`

**Files:**
- Create: `src/core/config.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/core/config.js`**

```js
export const TILE       = 3.5;
export const CH         = 3.5;
export const PLAYER_R   = 0.32;
export const WALK_SPD   = 3.4;
export const SPRINT_SPD = 6.2;

export const BASE_HEMI    = 0.45;
export const BASE_AMBIENT = 0.22;
export const BASE_PLAYER  = 0.25;
export const BASE_CEIL    = 0.55;
export const BASE_FOG     = 0.030;
```

- [ ] **Step 2: Update `src/main.js`**

Add at the top (after `import * as THREE`):
```js
import { TILE, CH, PLAYER_R, WALK_SPD, SPRINT_SPD, BASE_HEMI, BASE_AMBIENT, BASE_PLAYER, BASE_CEIL, BASE_FOG } from './core/config.js';
```

Delete the five `const TILE = ...` lines and five `const BASE_* = ...` lines from `src/main.js`.

- [ ] **Step 3: Verify**

Run: `npm run dev` — game still fully playable.

- [ ] **Step 4: Commit**

```bash
git add src/core/config.js src/main.js
git commit -m "refactor: extract core/config.js"
```

---

## Task 3: Extract `src/core/state.js`

**Files:**
- Create: `src/core/state.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/core/state.js`**

```js
export const state = {
  game: false,
  paused: false,
  currentLevel: 0,
  totalTime: 0,
  jsTriggered: false,
  startTime: 0,
  levelStartTime: 0,
  // lighting settings (user-adjustable)
  userBrightness: 1.0,
  userVolume: 0.7,
  mouseSens: 1.0,
  flashlightIntensity: 1.4,
  fxEnabled: true,
  // flicker timing
  flashTimer: 0,
  nextFlicker: 9,
  flickering: false,
  flickerEnd: 0,
  // music
  heartTimer: 0,
};
```

- [ ] **Step 2: Update `src/main.js`**

Add import:
```js
import { state } from './core/state.js';
```

Replace every reference to the old globals with `state.X`:

| Old variable | New reference |
|---|---|
| `GAME` | `state.game` |
| `PAUSED` | `state.paused` |
| `currentLevel` | `state.currentLevel` |
| `totalTime` | `state.totalTime` |
| `jsTriggered` | `state.jsTriggered` |
| `startTime` | `state.startTime` |
| `levelStartTime` | `state.levelStartTime` |
| `userBrightness` | `state.userBrightness` |
| `userVolume` | `state.userVolume` |
| `mouseSens` | `state.mouseSens` |
| `flashlightIntensity` | `state.flashlightIntensity` |
| `fxEnabled` | `state.fxEnabled` |
| `flashTimer` | `state.flashTimer` |
| `nextFlicker` | `state.nextFlicker` |
| `flickering` | `state.flickering` |
| `flickerEnd` | `state.flickerEnd` |
| `heartTimer` | `state.heartTimer` |

Delete the old `let GAME = false, PAUSED = false;`, `let startTime = 0`, `let flashTimer = 0`, `let userBrightness = 1.0`, `let mouseSens = 1.0`, `let flashlightIntensity = 1.4`, `let fxEnabled = true`, `let heartTimer = 0` declarations.

- [ ] **Step 3: Verify**

Run: `npm run dev` — game still fully playable, settings sliders still work.

- [ ] **Step 4: Commit**

```bash
git add src/core/state.js src/main.js
git commit -m "refactor: extract core/state.js"
```

---

## Task 4: Extract `src/levels/`

**Files:**
- Create: `src/levels/level1.js` through `src/levels/level5.js`
- Create: `src/levels/index.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/levels/level1.js`**

```js
export const grid = [
  "11111111111111111111111111",
  "10000000000000000000000001",
  "10011100111001110011100001",
  "10010000100001000010000001",
  "10010011100111001110011001",
  "10000000000000000000000001",
  "100011000S1000000011000001",
  "10001100001000001111000001",
  "10000000000000000000000001",
  "10011100111001110011100001",
  "10010000100001000010000001",
  "10010011100111001110011001",
  "10000000000000000000000001",
  "11111111111111111111111111",
];

export const config = {
  n: 1, name: "ZANGAR", spd: 2.4, lm: 1.00, fm: 0.80,
  flickerMul: 1.0, fogColor: 0x1a0f04, ambientColor: 0xffe2a0, hintKey: true,
};
```

- [ ] **Step 2: Create `src/levels/level2.js`**

```js
export const grid = [
  "11111111111111111111111111111",
  "10000000000000000000000000001",
  "10111111011111110111111101111",
  "10100000000000000000000000001",
  "10101111111011111110111111101",
  "10100000001000000010000000001",
  "10101111101011111010S11111101",
  "10000001000010000010100000001",
  "11111101011110111110101111101",
  "10000001000000000000101000001",
  "10111111111111111110101011101",
  "10000000000000000000001000001",
  "11111111111111111111111111111",
];

export const config = {
  n: 2, name: "TUNNEL", spd: 2.8, lm: 0.80, fm: 1.15,
  flickerMul: 1.3, fogColor: 0x0d0a06, ambientColor: 0xd4b680,
};
```

- [ ] **Step 3: Create `src/levels/level3.js`**

```js
export const grid = [
  "1111111111111111111111111",
  "1000000000000000000000001",
  "1011101110111011101110001",
  "1010001000100010001000001",
  "1010001000100010001000001",
  "1011101110111011101110101",
  "100000000000S0000000000001",
  "1011101110111011101110101",
  "1010001000100010001000001",
  "1010001000100010001000001",
  "1011101110111011101110001",
  "1000000000000000000000001",
  "1011101110111011101110101",
  "1010001000100010001000001",
  "1010001000100010001000001",
  "1011101110111011101110001",
  "1000000000000000000000001",
  "1111111111111111111111111",
];

export const config = {
  n: 3, name: "MAHBAS", spd: 3.2, lm: 0.62, fm: 1.45,
  flickerMul: 1.7, fogColor: 0x100502, ambientColor: 0xa07050,
};
```

- [ ] **Step 4: Create `src/levels/level4.js`**

```js
export const grid = [
  "1111111111111111111111111111",
  "1000100010000100010000010001",
  "1010111010111010111011010101",
  "1010000000100010000010010101",
  "1011101111101111101110010101",
  "1000100000000000100000010001",
  "1010111011110111011101111101",
  "1010001000010000010000000001",
  "10111011S11011011011101110101",
  "1000001000000001000000010101",
  "1011111011111101110111010101",
  "1000001000001000010000010001",
  "1010111111101110111110111101",
  "1010000000000000000000000001",
  "1011111111111111111111111101",
  "1000000000000000000000000001",
  "1111111111111111111111111111",
];

export const config = {
  n: 4, name: "CHUQUR", spd: 3.6, lm: 0.44, fm: 1.80,
  flickerMul: 2.2, fogColor: 0x080303, ambientColor: 0x804030,
};
```

- [ ] **Step 5: Create `src/levels/level5.js`**

```js
export const grid = [
  "1111111111111111111111111111111",
  "1000000000000000000000000000001",
  "1011111101111111111111110111101",
  "1000001000000000000000000100001",
  "1011101011110111101111110101101",
  "1000101000000100000000010101001",
  "1110101110111110111110110101101",
  "1000001000000000100000000100001",
  "1011111101111110111011111110101",
  "10000S0000000000000100000000101",
  "1011101111111011111101111110101",
  "1010000000001000000000000000001",
  "1010111011111110111011111011101",
  "1010001000000000001000001010001",
  "1011111011111111111111101111101",
  "1000000000000000000000000000001",
  "1111111111111111111111111111111",
];

export const config = {
  n: 5, name: "JAHANNAM", spd: 4.0, lm: 0.32, fm: 2.15,
  flickerMul: 3.2, fogColor: 0x0a0202, ambientColor: 0xaa3020,
};
```

- [ ] **Step 6: Create `src/levels/index.js`**

```js
import { grid as grid1, config as config1 } from './level1.js';
import { grid as grid2, config as config2 } from './level2.js';
import { grid as grid3, config as config3 } from './level3.js';
import { grid as grid4, config as config4 } from './level4.js';
import { grid as grid5, config as config5 } from './level5.js';

export const LEVEL_GRIDS = [grid1, grid2, grid3, grid4, grid5];
export const LEVELS      = [config1, config2, config3, config4, config5];
```

- [ ] **Step 7: Update `src/main.js`**

Add import:
```js
import { LEVEL_GRIDS, LEVELS } from './levels/index.js';
```

Delete the `const LEVEL_GRIDS = [...]` and `const LEVELS = [...]` declarations (lines 286–389 of the original `index.html`).

- [ ] **Step 8: Verify**

Run: `npm run dev` — all 5 levels load correctly. Level names show in HUD.

- [ ] **Step 9: Commit**

```bash
git add src/levels/ src/main.js
git commit -m "refactor: extract levels into src/levels/"
```

---

## Task 5: Extract `src/core/scene.js`

**Files:**
- Create: `src/core/scene.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/core/scene.js`**

```js
import * as THREE from 'three';
import { BASE_HEMI, BASE_AMBIENT, BASE_PLAYER, BASE_CEIL } from './config.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0604);
scene.fog = new THREE.FogExp2(0x0a0604, 0.030);

export const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 120);
camera.rotation.order = 'YXZ';

export const cvEl = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({
  canvas: cvEl,
  antialias: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

export const audioListener = new THREE.AudioListener();
camera.add(audioListener);
scene.add(camera);

export const hemi    = new THREE.HemisphereLight(0xffd890, 0x221100, BASE_HEMI);
export const ambient = new THREE.AmbientLight(0xffe2a0, BASE_AMBIENT);
export const playerLight = new THREE.PointLight(0xffe4b0, BASE_PLAYER, 7);
scene.add(hemi);
scene.add(ambient);
scene.add(playerLight);

export const flashlight = new THREE.SpotLight(0xffeecc, 0, 18, Math.PI / 6.5, 0.35, 1.8);
flashlight.position.set(0, 1.7, 0);
scene.add(flashlight);
export const flashTarget = new THREE.Object3D();
scene.add(flashTarget);
flashlight.target = flashTarget;

export const levelGroup = new THREE.Group();
scene.add(levelGroup);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
```

- [ ] **Step 2: Update `src/main.js`**

Add import:
```js
import { scene, camera, cvEl, renderer, audioListener, hemi, ambient, playerLight, flashlight, flashTarget, levelGroup } from './core/scene.js';
```

Delete from `src/main.js`: the `const scene = ...`, `const camera = ...`, `const cvEl = ...`, `const renderer = ...`, `const audioListener = ...`, all `scene.add(...)` for lights, `const hemi = ...`, `const ambient = ...`, `const playerLight = ...`, `const flashlight = ...`, `const flashTarget = ...`, `const levelGroup = ...`, and the `window.addEventListener('resize', ...)` block.

- [ ] **Step 3: Verify**

Run: `npm run dev` — game renders correctly, resize works.

- [ ] **Step 4: Commit**

```bash
git add src/core/scene.js src/main.js
git commit -m "refactor: extract core/scene.js"
```

---

## Task 6: Extract `src/world/map.js`

**Files:**
- Create: `src/world/map.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/world/map.js`**

```js
import { TILE, PLAYER_R } from '../core/config.js';

let CUR_GRID = [];
let CUR_GW   = 0;
let CUR_GH   = 0;
export let MAP_W = 0;
export let MAP_H = 0;

export function setGrid(grid) {
  CUR_GRID = grid;
  CUR_GW   = grid[0].length;
  CUR_GH   = grid.length;
  MAP_W    = CUR_GW * TILE;
  MAP_H    = CUR_GH * TILE;
}

export function getGridDims() {
  return { CUR_GW, CUR_GH };
}
```

Then copy the following functions verbatim from `src/main.js` into `src/world/map.js`, changing them from `function X` to `export function X` (and removing internal `CUR_GRID`/`CUR_GW`/`CUR_GH`/`MAP_W`/`MAP_H` references since they're now module-scoped):

- `isWall(gx, gz)` — original lines 401–404
- `tileAt(x, z)` — original lines 405–410
- `inMap(x, z, r)` — original lines 411–416
- `tileCenter(gx, gz)` — original lines 417–419
- `worldToTile(x, z)` — original lines 420–425
- `findSpawnTile()` — original lines 426–439
- `allFloorTiles()` — original lines 440–449
- `pickFarFloorTile(excludes, minDist)` — original lines 450–462
- `tilesAdjacentToWall()` — original lines 463–471
- `aStar(sx, sz, gx, gz)` — original lines 476–511

- [ ] **Step 2: Update `src/main.js`**

Add import:
```js
import { setGrid, MAP_W, MAP_H, isWall, tileAt, inMap, tileCenter, worldToTile, findSpawnTile, allFloorTiles, pickFarFloorTile, tilesAdjacentToWall, aStar } from './world/map.js';
```

**Important:** `MAP_W` and `MAP_H` are now module-level exports from `map.js`, not reassignable from `main.js`. All reads of `MAP_W`/`MAP_H` will use the exported values. Writes (the old `MAP_W = CUR_GW * TILE`) are replaced by calling `setGrid(grid)`.

In `resetState()`, replace the block:
```js
CUR_GRID = LEVEL_GRIDS[state.currentLevel];
CUR_GW   = CUR_GRID[0].length;
CUR_GH   = CUR_GRID.length;
MAP_W    = CUR_GW * TILE;
MAP_H    = CUR_GH * TILE;
```
With:
```js
setGrid(LEVEL_GRIDS[state.currentLevel]);
```

Delete `let CUR_GRID`, `let CUR_GW`, `let CUR_GH`, `let MAP_W`, `let MAP_H` declarations and all the map utility functions from `src/main.js`.

**Note:** `MAP_W` and `MAP_H` are re-exported as named exports. Since they are `let` bindings, importing modules see live values after `setGrid()` is called. This is a standard ES module live binding pattern.

- [ ] **Step 3: Verify**

Run: `npm run dev` — all levels build geometry correctly, collision works, A* pathfinding works (monster follows paths).

- [ ] **Step 4: Commit**

```bash
git add src/world/map.js src/main.js
git commit -m "refactor: extract world/map.js with tile utilities and A*"
```

---

## Task 7: Extract `src/world/textures.js`

**Files:**
- Create: `src/world/textures.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/world/textures.js`**

```js
import * as THREE from 'three';

export const LEVEL_TEX = [
  { wall:'#b89340', wAcc:'#5c3d12', wDirt:'rgba(60,35,10,.38)', floor:'#6e5320', fAcc:'rgba(20,12,4,.45)',  ceil:'#a89f88' },
  { wall:'#8a6228', wAcc:'#3a2a0e', wDirt:'rgba(40,22,8,.42)',  floor:'#4a371a', fAcc:'rgba(10,6,2,.5)',    ceil:'#776552' },
  { wall:'#5f4420', wAcc:'#241508', wDirt:'rgba(30,10,5,.5)',   floor:'#2e2010', fAcc:'rgba(5,2,1,.6)',     ceil:'#4a3d2a' },
  { wall:'#3e2c15', wAcc:'#120806', wDirt:'rgba(60,5,5,.45)',   floor:'#1a1208', fAcc:'rgba(60,0,0,.4)',    ceil:'#2a1f15' },
  { wall:'#421510', wAcc:'#1a0302', wDirt:'rgba(120,10,10,.5)', floor:'#2a0a06', fAcc:'rgba(120,0,0,.55)', ceil:'#1a0604' },
];
```

Then copy the following functions verbatim from `src/main.js`, adding `export` to each:

- `export function wallTex(base, accent, dirt)` — original lines 516–541
- `export function floorTex(base, accent)` — original lines 542–559
- `export function ceilingTex(base)` — original lines 560–575
- `export function paperTex()` — original lines 576–602
- `export function signTex(text, bg, fg)` — original lines 603–612

- [ ] **Step 2: Update `src/main.js`**

Add import:
```js
import { LEVEL_TEX, wallTex, floorTex, ceilingTex, paperTex, signTex } from './world/textures.js';
```

Delete `const LEVEL_TEX = [...]` and all five texture functions from `src/main.js`.

- [ ] **Step 3: Verify**

Run: `npm run dev` — walls, floors, ceilings render with correct per-level palettes.

- [ ] **Step 4: Commit**

```bash
git add src/world/textures.js src/main.js
git commit -m "refactor: extract world/textures.js"
```

---

## Task 8: Extract `src/world/builder.js`

**Files:**
- Create: `src/world/builder.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/world/builder.js`**

```js
import * as THREE from 'three';
import { TILE, CH, BASE_CEIL } from '../core/config.js';
import { state } from '../core/state.js';
import { levelGroup } from '../core/scene.js';
import { MAP_W, MAP_H, CUR_GW, CUR_GH, tileCenter } from '../world/map.js';
import { LEVEL_TEX, wallTex, floorTex, ceilingTex } from '../world/textures.js';

export const ceilingLights = [];
export const lightPanels   = [];
```

**Note:** `CUR_GW` and `CUR_GH` are not currently exported from `map.js` — add them to `map.js`'s exports:

In `src/world/map.js`, change the `getGridDims()` function to instead export the values directly by adding:
```js
export function getCurGW() { return CUR_GW; }
export function getCurGH() { return CUR_GH; }
export function getCurGrid() { return CUR_GRID; }
```

Then in `builder.js` use `getCurGW()`, `getCurGH()`.

Copy the following functions verbatim from `src/main.js`, adding `export`:

- `export function disposeNode(node)` — original lines 674–685
- `export function clearLevel()` — original lines 686–695 (update array references: `ceilingLights`, `lightPanels` are now the exported arrays in this module; `hidingSpots`, `batteryPickups`, `notePickups`, `monsterWaypoints` are imported from `collectibles.js` — for now leave them as parameters or import later in Task 10)
- `export function buildLevelGeometry()` — original lines 703–753

**Handling `clearLevel()` dependencies:** `clearLevel()` clears arrays from multiple modules. Use a callback-based approach — export a `registerClearCallback(fn)` function that `clearLevel()` calls:

```js
const clearCallbacks = [];
export function registerClearCallback(fn) { clearCallbacks.push(fn); }

export function clearLevel() {
  disposeNode(levelGroup);
  while (levelGroup.children.length) levelGroup.remove(levelGroup.children[0]);
  ceilingLights.length = 0;
  lightPanels.length   = 0;
  clearCallbacks.forEach(fn => fn());
}
```

- [ ] **Step 2: Update `src/main.js`**

Add import:
```js
import { ceilingLights, lightPanels, disposeNode, clearLevel, buildLevelGeometry, registerClearCallback } from './world/builder.js';
```

Delete `const ceilingLights = []`, `const lightPanels = []`, `disposeNode`, `clearLevel`, and `buildLevelGeometry` from `src/main.js`.

- [ ] **Step 3: Verify**

Run: `npm run dev` — level geometry loads on each level, clearing works when transitioning levels.

- [ ] **Step 4: Commit**

```bash
git add src/world/builder.js src/world/map.js src/main.js
git commit -m "refactor: extract world/builder.js"
```

---

## Task 9: Extract `src/world/lighting.js`

**Files:**
- Create: `src/world/lighting.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/world/lighting.js`**

```js
import { BASE_HEMI, BASE_AMBIENT, BASE_PLAYER, BASE_CEIL, BASE_FOG } from '../core/config.js';
import { state } from '../core/state.js';
import { LEVELS } from '../levels/index.js';
import { hemi, ambient, playerLight, scene } from '../core/scene.js';
import { ceilingLights, lightPanels } from './builder.js';
```

Copy verbatim from `src/main.js`, adding `export`:

- `export function applyLevelLighting()` — original lines 2150–2165
- `export function updateFlicker(dt)` — original lines 2167–2186

Replace all `currentLevel` with `state.currentLevel`, `userBrightness` with `state.userBrightness`, `flashTimer`/`nextFlicker`/`flickering`/`flickerEnd` with `state.flashTimer` / etc., and `noise(...)` with an import from `../audio/manager.js` (add that import; see Task 17 — for now leave `noise(...)` as a forward dependency, it will resolve once audio is extracted).

**Temporary workaround:** Until Task 17, keep a copy of `noise()` inline in `lighting.js` or pass it as a parameter. The cleanest solution is to pass it as a parameter to `updateFlicker(dt, noiseFn)` and call `noiseFn(0.05, 0.12, 80, 4000)`.

In `main.js`, update the call site:
```js
updateFlicker(dt, noise);
```

- [ ] **Step 2: Update `src/main.js`**

Add import:
```js
import { applyLevelLighting, updateFlicker } from './world/lighting.js';
```

Delete `applyLevelLighting` and `updateFlicker` from `src/main.js`.

- [ ] **Step 3: Verify**

Run: `npm run dev` — lighting changes per level, lights flicker correctly.

- [ ] **Step 4: Commit**

```bash
git add src/world/lighting.js src/main.js
git commit -m "refactor: extract world/lighting.js"
```

---

## Task 10: Extract `src/world/collectibles.js`

**Files:**
- Create: `src/world/collectibles.js`
- Modify: `src/main.js`, `src/world/builder.js`

- [ ] **Step 1: Create `src/world/collectibles.js`**

```js
import * as THREE from 'three';
import { TILE, CH } from '../core/config.js';
import { state } from '../core/state.js';
import { levelGroup } from '../core/scene.js';
import { tileCenter, isWall } from '../world/map.js';
import { paperTex, signTex } from '../world/textures.js';

export const hidingSpots    = [];
export const batteryPickups = [];
export const notePickups    = [];
export const monsterWaypoints = [];

export const NOTE_LORE = [
  { t:"1-KUN",            b:"Ishdan qaytayotganimda\nnotanish eshikka kirdim.\nUndan keyin hech narsa o'zgarmadi...\nfaqat shovqinlar." },
  { t:"QOCHISHGA URINISH",b:"Devorlar yurib turadi.\nXaritani chizish foydasiz.\nKalitlar bor — ular yashirilgan.\nOvoz qilma. U eshitadi." },
  { t:"U HAQIDA",         b:"Uni ko'rmadim, lekin ovozini\neshitdim. Nafas olmayapti,\nzaharlashmagan... o'ladi menimcha\nkeyingi marta chiqsam." },
  { t:"OXIRGI TILAK",     b:"Agar bu xatni topsangiz\nmen allaqachon yo'q.\nLocker'lar yordam beradi.\nBatareya — sizning eng yaxshi do'stingiz." },
  { t:"QOIDALAR",         b:"1. Yugurma (u eshitadi)\n2. Yorug'likni o'chir (ba'zan)\n3. Lockerga yashirin\n4. Kalitsiz chiqmaysan" },
  { t:"XATA",             b:"Chiroqni yoqdim. U qaradi.\nEndi u nima yerda ekanimni biladi.\nSensiz qochib bo'lmaydi.\nYur... men ustun qoldim." },
  { t:"5-LEVEL",          b:"Bu yerda yorug' yo'q.\nFaqat chiroq bor. Batareya\ntugasa — hammasi tugaydi.\nYur. Orqaga qaramay." },
  { t:"SAVOL",            b:"Nega men? Nega biz?\nBu joy meni tanlaganmi\nyoki men uni? Javob yo'q.\nFaqat eshiklar, kalitlar, va u." },
];

export let keyGroup  = null;
export let doorGroup = null;

export function resetCollectibles() {
  hidingSpots.length     = 0;
  batteryPickups.length  = 0;
  notePickups.length     = 0;
  monsterWaypoints.length = 0;
  keyGroup  = null;
  doorGroup = null;
}
```

Copy verbatim from `src/main.js`, adding `export` to each:

- `export function buildKey()` — original lines 776–793 (set module-level `keyGroup`)
- `export function buildDoor()` — original lines 795–825 (set module-level `doorGroup`)
- `export function buildHidingSpot(gx, gz)` — original lines 827–871
- `export function buildBattery(gx, gz)` — original lines 873–891
- `export function buildNote(gx, gz, lore)` — original lines 893–909
- `export function updateKeyAndDoor(dt)` — original lines 2593–2648 (update references to `P`, `MONSTER`, sound functions, `state.game`, `state.jsTriggered`, `state.currentLevel`)

`updateKeyAndDoor` calls `monsterSpawnBehindPlayer()`, `keyPickupSound()`, `chaseSting()`, `doorOpenSound()`, `levelComplete()`, `showHud()` — these will be imported in the next tasks. For now, accept them as forward imports that will be wired in Task 21.

- [ ] **Step 2: Update `src/world/builder.js`**

Import and use `resetCollectibles` as the clear callback:
```js
import { resetCollectibles } from './collectibles.js';
registerClearCallback(resetCollectibles);  // call this at module init
```

Actually, call it once at the bottom of `builder.js`:
```js
import { resetCollectibles } from './collectibles.js';
registerClearCallback(resetCollectibles);
```

- [ ] **Step 3: Update `src/main.js`**

Add import:
```js
import { hidingSpots, batteryPickups, notePickups, monsterWaypoints, NOTE_LORE, keyGroup, doorGroup, buildKey, buildDoor, buildHidingSpot, buildBattery, buildNote, updateKeyAndDoor, resetCollectibles } from './world/collectibles.js';
```

Delete the old declarations and functions.

- [ ] **Step 4: Verify**

Run: `npm run dev` — key appears, door appears, notes/batteries/lockers spawn. Pickup sounds play.

- [ ] **Step 5: Commit**

```bash
git add src/world/collectibles.js src/world/builder.js src/main.js
git commit -m "refactor: extract world/collectibles.js"
```

---

## Task 11: Extract `src/input/`

**Files:**
- Create: `src/input/keyboard.js`
- Create: `src/input/mouse.js`
- Create: `src/input/mobile.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/input/keyboard.js`**

```js
const _keys = {};

export function initKeyboard(onEscape, onE, onF) {
  document.addEventListener('keydown', e => {
    if (e.code === 'Escape') { onEscape(); return; }
    if (e.code === 'KeyE')   { onE();      return; }
    if (e.code === 'KeyF')   { onF();      return; }
    _keys[e.code] = true;
  });
  document.addEventListener('keyup', e => { _keys[e.code] = false; });
}

export function getKeys() { return _keys; }
```

- [ ] **Step 2: Create `src/input/mouse.js`**

```js
import { state } from '../core/state.js';
import { cvEl } from '../core/scene.js';

export function initMouse(getGameActive) {
  cvEl.addEventListener('click', () => {
    if (getGameActive()) cvEl.requestPointerLock();
  });
  document.addEventListener('mousemove', e => {
    if (!state.game || state.paused || document.pointerLockElement !== cvEl) return;
    state.playerYaw   = (state.playerYaw   || 0) - (e.movementX || 0) * 0.0022 * state.mouseSens;
    state.playerPitch = (state.playerPitch || 0) - (e.movementY || 0) * 0.0022 * state.mouseSens;
    state.playerPitch = Math.max(-1.1, Math.min(1.1, state.playerPitch));
  });
}
```

**Note:** Player yaw/pitch live on the `P` object in `player/controller.js`. The mouse module needs to update them. The cleanest approach — pass an `onMove(dx, dy)` callback so mouse.js has no dep on player:

```js
export function initMouse(getCanLook, onMove) {
  cvEl.addEventListener('click', () => {
    if (getCanLook()) cvEl.requestPointerLock();
  });
  document.addEventListener('mousemove', e => {
    if (!getCanLook() || document.pointerLockElement !== cvEl) return;
    onMove(e.movementX || 0, e.movementY || 0);
  });
}
```

In `main.js` (or `player/controller.js` in Task 12):
```js
initMouse(
  () => state.game && !state.paused && !P.hiding && !P.noteReading,
  (dx, dy) => {
    P.yaw   -= dx * 0.0022 * state.mouseSens;
    P.pitch -= dy * 0.0022 * state.mouseSens;
    P.pitch  = Math.max(-1.1, Math.min(1.1, P.pitch));
  }
);
```

- [ ] **Step 3: Create `src/input/mobile.js`**

```js
const JS = { active: false, x: 0, y: 0, id: -1, ox: 0, oy: 0 };
let _mobSprintPressed = false;

export function getJoystick()       { return JS; }
export function isMobSprintPressed(){ return _mobSprintPressed; }

export function initMobile(onFlash, onInteract, onLook) {
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
      const d  = Math.sqrt(dx*dx + dy*dy);
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
  lz.addEventListener('touchmove',  e => {
    e.preventDefault(); if (!lA) return;
    const t = e.changedTouches[0];
    onLook(t.clientX - lx, t.clientY - ly);
    lx = t.clientX; ly = t.clientY;
  }, { passive: false });
  lz.addEventListener('touchend', () => lA = false);

  document.getElementById('mobFlash').addEventListener('touchstart', e => { e.preventDefault(); onFlash(); }, { passive: false });
  document.getElementById('mobInteract').addEventListener('touchstart', e => { e.preventDefault(); onInteract(); }, { passive: false });
  const btn = document.getElementById('mobSprint');
  btn.addEventListener('touchstart', e => { e.preventDefault(); _mobSprintPressed = true; }, { passive: false });
  btn.addEventListener('touchend',   () => { _mobSprintPressed = false; });
}
```

- [ ] **Step 4: Update `src/main.js`**

Add imports:
```js
import { initKeyboard, getKeys } from './input/keyboard.js';
import { initMouse } from './input/mouse.js';
import { initMobile, getJoystick, isMobSprintPressed } from './input/mobile.js';
```

Delete the old keyboard/mouse/gamepad/mobile event listener blocks and the `(function setupMobile() {...})()` IIFE.

In the boot section (near `startGame`), call:
```js
initKeyboard(
  () => { if (P.noteReading) { closeNote(); return; } if (state.game && !state.paused) pauseGame(); },
  () => { if (P.noteReading) { closeNote(); return; } handleInteract(); },
  () => { if (state.game && !state.paused) toggleFlashlight(); }
);
initMouse(
  () => state.game && !state.paused && !P.hiding && !P.noteReading,
  (dx, dy) => { P.yaw -= dx * 0.0022 * state.mouseSens; P.pitch = Math.max(-1.1, Math.min(1.1, P.pitch - dy * 0.0022 * state.mouseSens)); }
);
initMobile(
  () => toggleFlashlight(),
  () => handleInteract(),
  (dx, dy) => { if (!state.game || state.paused) return; P.yaw -= dx * 0.005 * state.mouseSens; P.pitch = Math.max(-1.1, Math.min(1.1, P.pitch - dy * 0.005 * state.mouseSens)); }
);
```

Replace all `P.keys[...]` references in `updatePlayer` with `getKeys()[...]`.
Replace all `JS.active`/`JS.x`/`JS.y` with `getJoystick().active` etc.
Replace `mobSprintPressed` with `isMobSprintPressed()`.

Keep the gamepad (`pollGamepad`) inline in `src/main.js` for now — it's small and self-contained.

- [ ] **Step 5: Verify**

Run: `npm run dev` — keyboard movement works, mouse look works, mobile controls work on touch device.

- [ ] **Step 6: Commit**

```bash
git add src/input/ src/main.js
git commit -m "refactor: extract input/ (keyboard, mouse, mobile)"
```

---

## Task 12: Extract `src/player/`

**Files:**
- Create: `src/player/controller.js`
- Create: `src/player/stamina.js`
- Create: `src/player/flashlight.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/player/controller.js`**

```js
import { WALK_SPD, SPRINT_SPD, PLAYER_R } from '../core/config.js';
import { state } from '../core/state.js';
import { camera, playerLight } from '../core/scene.js';
import { inMap } from '../world/map.js';
import { getKeys } from '../input/keyboard.js';
import { getJoystick, isMobSprintPressed } from '../input/mobile.js';

export const P = {
  x: 0, y: 1.7, z: 0,
  yaw: 0, pitch: 0,
  hasKey: false,
  stamina: 1.0,
  battery: 1.0,
  flashOn: false,
  hiding: false,
  hideSpot: null,
  noteReading: false,
  noteCurrent: null,
  notesFoundThisLevel: 0,
  notesTotalThisLevel: 0,
  noiseLevel: 0,
  bobPhase: 0,
};
```

Copy `pollGamepad(dt)` and `updatePlayer(dt)` verbatim from `src/main.js`, updating references to use `P`, `getKeys()`, `getJoystick()`, `isMobSprintPressed()`. Export both:

```js
export function pollGamepad(dt) { ... }
export function updatePlayer(dt) { ... }
```

Inside `updatePlayer`, calls to `updateStamina` and `raiseNoise` become imports:
```js
import { updateStamina } from './stamina.js';
export function raiseNoise(amount) { P.noiseLevel = Math.max(P.noiseLevel, amount); }
```

- [ ] **Step 2: Create `src/player/stamina.js`**

```js
import { P } from './controller.js';

export function updateStamina(dt, sprinting, moving) {
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
```

- [ ] **Step 3: Create `src/player/flashlight.js`**

```js
import { state } from '../core/state.js';
import { flashlight, flashTarget } from '../core/scene.js';
import { P } from './controller.js';

export function toggleFlashlight() {
  if (!state.game || state.paused || P.hiding) return;
  if (P.battery <= 0 && !P.flashOn) { showHud('BATAREYA TUGADI', 1600); return; }
  P.flashOn = !P.flashOn;
  flashClick();
  if (P.flashOn) raiseNoise(0.4);
}

export function updateFlashlight(dt) {
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
```

`showHud`, `flashClick`, and `raiseNoise` are imported:
```js
import { showHud } from '../hud/hud.js';
import { flashClick } from '../audio/manager.js';
import { raiseNoise } from './controller.js';
```

- [ ] **Step 4: Update `src/main.js`**

Add imports:
```js
import { P, updatePlayer, raiseNoise, pollGamepad } from './player/controller.js';
import { updateStamina } from './player/stamina.js';
import { toggleFlashlight, updateFlashlight } from './player/flashlight.js';
```

Delete `const P = {...}`, `updatePlayer`, `updateStamina`, `toggleFlashlight`, `updateFlashlight`, `raiseNoise` from `src/main.js`.

- [ ] **Step 5: Verify**

Run: `npm run dev` — movement, sprint, stamina, flashlight battery all work correctly.

- [ ] **Step 6: Commit**

```bash
git add src/player/ src/main.js
git commit -m "refactor: extract player/ (controller, stamina, flashlight)"
```

---

## Task 13: Extract `src/audio/manager.js`

**Files:**
- Create: `src/audio/manager.js`
- Modify: `src/main.js`, `src/world/lighting.js`

- [ ] **Step 1: Create `src/audio/manager.js`**

```js
import { state } from '../core/state.js';

let AC         = null;
let masterGain = null;
let ambientNodes = [];
let tenseGain = null, tenseOsc = null;
let chaseGain = null, chaseOscs = [];
let monsterPanner = null, monsterBreathOsc = null, monsterBreathGain = null;
let footstepAlt = false;
```

Copy ALL audio functions verbatim from `src/main.js`, adding `export` to the public ones:

- `export function initAudio()` — original lines 1295–1304
- `function osc(...)` — original lines 1306–1313 (internal helper, not exported)
- `function noise(...)` — original lines 1314–1326 (internal helper — but also exported for use by `lighting.js` and game over)
- `export function noise(...)` — export it so `lighting.js` can import it
- `export function startAmbient()` / `export function stopAmbient()` — original lines 1330–1354
- `export function startTenseLayer()` / `export function stopTenseLayer()` — original lines 1356–1374
- `export function startChaseLayer()` / `export function stopChaseLayer()` — original lines 1376–1397
- `export function startMonsterSound()` / `export function stopMonsterSound()` — original lines 1401–1431
- `export function updateMonsterAudio(dist, camX, camZ, camYaw, monsterX, monsterZ, monsterSpawned, monsterState)` — original lines 1432–1461. **Change:** remove direct access to `MONSTER.x/z/spawned/state` — these are passed as parameters instead.
- `export function heartbeat(v)` — line 1464
- `export function keyPickupSound()` — lines 1468–1472
- `export function batteryPickupSound()` — lines 1473–1476
- `export function notePickupSound()` — line 1477
- `export function doorOpenSound()` — line 1481
- `export function flashClick()` — line 1484
- `export function lockerClose()` — lines 1487–1490
- `export function chaseSting()` — lines 1491–1506
- `export function deathScream()` — lines 1507–1520
- `export function monsterFootstep(dist)` — lines 1521–1533
- `export function updateMusicMix(dt, monsterDist, monsterState, monsterSpawned)` — lines 2653–2676. **Change:** remove direct `MONSTER.*` access — accept as parameters.

- [ ] **Step 2: Update `src/world/lighting.js`**

Replace the `noiseFn` parameter pattern with a direct import:
```js
import { noise } from '../audio/manager.js';
```
Change `updateFlicker(dt, noiseFn)` back to `updateFlicker(dt)` and call `noise(0.05, 0.12, 80, 4000)` directly.

- [ ] **Step 3: Update `src/main.js`**

Add import:
```js
import {
  initAudio, startAmbient, stopAmbient, startTenseLayer, stopTenseLayer,
  startChaseLayer, stopChaseLayer, startMonsterSound, stopMonsterSound,
  updateMonsterAudio, heartbeat, keyPickupSound, batteryPickupSound,
  notePickupSound, doorOpenSound, flashClick, lockerClose, chaseSting,
  deathScream, monsterFootstep, updateMusicMix, noise
} from './audio/manager.js';
```

Update all calls to `updateMonsterAudio` and `updateMusicMix` to pass monster state as parameters:
```js
updateMonsterAudio(
  Math.hypot(P.x - MONSTER.x, P.z - MONSTER.z),
  P.x, P.z, P.yaw, MONSTER.x, MONSTER.z, MONSTER.spawned, MONSTER.state
);
updateMusicMix(dt,
  MONSTER.spawned ? Math.hypot(P.x - MONSTER.x, P.z - MONSTER.z) : 99,
  MONSTER.state, MONSTER.spawned
);
```

Delete all audio declarations and functions from `src/main.js`.

- [ ] **Step 4: Verify**

Run: `npm run dev` — ambient drone plays, tense layer fades in when monster is near, chase music triggers, footsteps are spatial, jumpscare sound plays on death, flashlight click sound works.

- [ ] **Step 5: Commit**

```bash
git add src/audio/manager.js src/world/lighting.js src/main.js
git commit -m "refactor: extract audio/manager.js"
```

---

## Task 14: Extract `src/monster/`

**Files:**
- Create: `src/monster/ai.js`
- Create: `src/monster/jumpscare.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/monster/ai.js`**

```js
import * as THREE from 'three';
import { state } from '../core/state.js';
import { scene, levelGroup } from '../core/scene.js';
import { allFloorTiles, worldToTile, tileCenter, inMap, aStar } from '../world/map.js';
import { LEVELS } from '../levels/index.js';
import { P, raiseNoise } from '../player/controller.js';
import { chaseSting, monsterFootstep } from '../audio/manager.js';

export const MONSTER = {
  root: null, parts: {},
  x: 0, z: 0, y: 0, facing: 0, phase: 0,
  stateStartTime: 0,
  state: 'idle',
  targetPath: null, pathIndex: 0,
  investigateTarget: null, patrolIndex: 0,
  lastSeenPlayer: 0,
  breathingSound: null,
  footstepTimer: 0,
  spawned: false,
};
```

Copy verbatim from `src/main.js`, adding `export`:

- `export function buildMonster()` — original lines 932–1171 (the full 3D rig construction including `buildArm`, `buildLeg` inner functions)
- `export function animateMonster(dt)` — original lines 1176–1224
- `export function monsterSpawnBehindPlayer()` — original lines 1927–1943
- `function monsterGotoRandomWaypoint()` — original lines 1945–1950 (internal)
- `function repathTo(gx, gz)` — original lines 1952–1956 (internal)
- `function monsterCanSeePlayer()` — original lines 1958–1973 (internal)
- `export function updateMonsterAI(dt, triggerGameOverFn)` — original lines 1975–2080. **Change:** remove direct call to `triggerGameOver()` — accept as parameter `triggerGameOverFn` and call it instead.

- [ ] **Step 2: Create `src/monster/jumpscare.js`**

```js
import { state } from '../core/state.js';
import { hemi, ambient, ceilingLights } from '../core/scene.js';
import { stopAmbient, stopTenseLayer, stopChaseLayer, deathScream } from '../audio/manager.js';

const jsCv  = document.getElementById('jsC');
const jsCtx = jsCv.getContext('2d');
let jsAnim = false, jsStart = 0, jsCb = null;

function resizeJs() { jsCv.width = innerWidth; jsCv.height = innerHeight; }
resizeJs();
window.addEventListener('resize', resizeJs);
```

Copy verbatim from `src/main.js`:

- `function drawJsFace(p)` — original lines 2195–2263 (internal)
- `export function runJumpscare(cb)` — original lines 2264–2268
- `function jsFrame(now)` — original lines 2269–2275 (internal)
- `export function triggerGameOver(showGameOverFn)` — original lines 2293–2302. **Change:** remove direct call to `showGameOver()` — accept as parameter and call `setTimeout(() => runJumpscare(showGameOverFn), 260)`.

- [ ] **Step 3: Update `src/main.js`**

Add imports:
```js
import { MONSTER, buildMonster, animateMonster, updateMonsterAI, monsterSpawnBehindPlayer } from './monster/ai.js';
import { triggerGameOver, runJumpscare } from './monster/jumpscare.js';
```

Update call to `updateMonsterAI`:
```js
updateMonsterAI(dt, () => triggerGameOver(showGameOver));
```

Update call to `triggerGameOver` wherever called outside main loop (e.g., in `collectibles.js`):
Pass `showGameOver` as a callback.

Delete monster declarations and functions from `src/main.js`.

- [ ] **Step 4: Call `buildMonster()` at startup**

In `main.js`, before calling `resetState()` for the first time:
```js
buildMonster();
```

- [ ] **Step 5: Verify**

Run: `npm run dev` — monster spawns when key is picked up, chases player, jumpscare appears on death, A* pathfinding works.

- [ ] **Step 6: Commit**

```bash
git add src/monster/ src/main.js
git commit -m "refactor: extract monster/ (ai, jumpscare)"
```

---

## Task 15: Extract `src/hud/hud.js` and `src/ui/`

**Files:**
- Create: `src/hud/hud.js`
- Create: `src/ui/screens.js`
- Create: `src/ui/pause.js`
- Create: `src/ui/noteReader.js`
- Create: `src/ui/hideOverlay.js`
- Create: `src/ui/settings.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/hud/hud.js`**

```js
import { state } from '../core/state.js';
import { P } from '../player/controller.js';

let hudTimer = null;

export function showHud(msg, ms = 3000) {
  const h = document.getElementById('hud');
  h.textContent = msg; h.style.opacity = '1';
  clearTimeout(hudTimer);
  hudTimer = setTimeout(() => h.style.opacity = '0', ms);
}

export function fmtTime(s) {
  const m = Math.floor(s / 60), ss = s % 60;
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

export function updateNoteCount() {
  document.getElementById('noteCount').textContent =
    P.notesFoundThisLevel + ' / ' + P.notesTotalThisLevel;
}

export function updateInteractHud(notePickups, hidingSpots) {
  if (P.hiding || P.noteReading || state.paused) {
    document.getElementById('interactHud').style.display = 'none';
    return;
  }
  const hud = document.getElementById('interactHud');
  for (const n of notePickups) {
    if (n.taken) continue;
    const d = Math.hypot(P.x - n.worldX, P.z - n.worldZ);
    if (d < 1.0) { hud.textContent = "[ E ] — xatni o'qish"; hud.style.display = 'block'; return; }
  }
  const h = hidingSpots.find(h => !h.occupied && Math.hypot(P.x - h.worldX, P.z - h.worldZ) < 1.6);
  if (h) { hud.textContent = '[ E ] — yashirinish'; hud.style.display = 'block'; return; }
  hud.style.display = 'none';
}
```

- [ ] **Step 2: Create `src/ui/screens.js`**

```js
import { state } from '../core/state.js';
import { LEVELS } from '../levels/index.js';
import { P } from '../player/controller.js';
import { fmtTime } from '../hud/hud.js';
import { stopAmbient, stopTenseLayer, stopChaseLayer, stopMonsterSound } from '../audio/manager.js';
import { cvEl } from '../core/scene.js';

export function getBestTime(levelIdx) {
  try { return JSON.parse(localStorage.getItem('br_bestTimes') || '{}')[levelIdx] || null; }
  catch(e) { return null; }
}
export function setBestTime(levelIdx, seconds) {
  try {
    const j = JSON.parse(localStorage.getItem('br_bestTimes') || '{}');
    j[levelIdx] = seconds; localStorage.setItem('br_bestTimes', JSON.stringify(j));
  } catch(e) {}
}

export function showGameOver() {
  const s = Math.floor((Date.now() - state.levelStartTime) / 1000);
  document.getElementById('goTime').textContent = `Level ${LEVELS[state.currentLevel].n} — ${fmtTime(s)}`;
  document.getElementById('gameOver').style.display = 'flex';
  document.getElementById('bottomBar').style.display = 'none';
  document.getElementById('levelHud').style.display = 'none';
  document.getElementById('timerHud').style.display = 'none';
  document.body.classList.remove('chase');
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
}

export function levelComplete(resetStateFn) {
  if (!state.game) return;
  state.game = false;
  const s = Math.floor((Date.now() - state.levelStartTime) / 1000);
  state.totalTime += s;
  stopAmbient(); stopTenseLayer(); stopChaseLayer(); stopMonsterSound();
  document.body.classList.remove('chase');
  document.getElementById('bottomBar').style.display = 'none';
  document.getElementById('levelHud').style.display = 'none';
  document.getElementById('timerHud').style.display = 'none';
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
  const prev = getBestTime(state.currentLevel);
  const newBest = (prev === null || s < prev);
  if (newBest) setBestTime(state.currentLevel, s);
  if (state.currentLevel >= LEVELS.length - 1) {
    document.getElementById('fwMsg').textContent =
      `Barcha 5 levelni tugatdingiz!\nJami vaqt: ${fmtTime(state.totalTime)}\n\nEng yaxshi vaqtlar:\n` +
      LEVELS.map((lv, i) => ` L${lv.n}: ${fmtTime(getBestTime(i) || 0)}`).join('\n');
    document.getElementById('finalWin').style.display = 'flex';
  } else {
    document.getElementById('lcTitle').textContent = `LEVEL ${LEVELS[state.currentLevel].n} TUGADI`;
    const msg = `Vaqt: ${fmtTime(s)}\nXatlar: ${P.notesFoundThisLevel}/${P.notesTotalThisLevel}\nKeyingi level: ${LEVELS[state.currentLevel + 1].name} (${LEVELS[state.currentLevel + 1].n}/5)`;
    document.getElementById('lcMsg').textContent = msg;
    document.getElementById('lcBest').textContent = newBest
      ? '★ YANGI REKORD!'
      : (prev !== null ? `Eng yaxshi: ${fmtTime(prev)}` : '');
    document.getElementById('levelComplete').style.display = 'flex';
  }
}

export function nextLevel(resetStateFn) {
  document.getElementById('levelComplete').style.display = 'none';
  state.currentLevel++;
  resetStateFn();
  cvEl.requestPointerLock();
}

export function restartFromLevel1(resetStateFn) {
  ['gameOver','levelComplete','finalWin'].forEach(id =>
    document.getElementById(id).style.display = 'none');
  state.currentLevel = 0;
  state.totalTime    = 0;
  resetStateFn();
  cvEl.requestPointerLock();
}
```

- [ ] **Step 3: Create `src/ui/pause.js`**

```js
import { state } from '../core/state.js';
import { cvEl } from '../core/scene.js';
import { stopAmbient, stopTenseLayer, stopChaseLayer, stopMonsterSound } from '../audio/manager.js';

export function pauseGame() {
  if (!state.game || state.paused) return;
  state.paused = true;
  document.getElementById('pauseMenu').style.display = 'flex';
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
}

export function resumeGame() {
  if (!state.paused) return;
  state.paused = false;
  document.getElementById('pauseMenu').style.display = 'none';
  document.getElementById('settingsModal').style.display = 'none';
  if (state.game) cvEl.requestPointerLock();
}

export function quitToMenu() {
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
```

- [ ] **Step 4: Create `src/ui/noteReader.js`**

```js
import { P } from '../player/controller.js';
import { state } from '../core/state.js';
import { cvEl } from '../core/scene.js';

export function openNote(note) {
  P.noteReading = true;
  P.noteCurrent = note;
  document.getElementById('noteTitle').textContent = note.title;
  document.getElementById('noteBody').textContent  = note.text;
  document.getElementById('noteReader').style.display = 'flex';
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
}

export function closeNote() {
  P.noteReading = false;
  document.getElementById('noteReader').style.display = 'none';
  if (state.game && !state.paused) cvEl.requestPointerLock();
}
```

- [ ] **Step 5: Create `src/ui/hideOverlay.js`**

```js
import { P } from '../player/controller.js';
import { state } from '../core/state.js';
import { cvEl } from '../core/scene.js';
import { lockerClose } from '../audio/manager.js';
import { hidingSpots } from '../world/collectibles.js';

export function findNearestHideSpot() {
  let best = null, bestD = 1.6;
  for (const h of hidingSpots) {
    const d = Math.hypot(P.x - h.worldX, P.z - h.worldZ);
    if (d < bestD) { bestD = d; best = h; }
  }
  return best;
}

export function enterHide(spot) {
  P.hiding = true; P.hideSpot = spot; spot.occupied = true;
  P.x = spot.worldX; P.z = spot.worldZ;
  P.flashOn = false;
  lockerClose();
  document.getElementById('hideOverlay').style.display = 'flex';
  if (document.pointerLockElement === cvEl) document.exitPointerLock();
}

export function exitHide() {
  if (!P.hiding) return;
  if (P.hideSpot) P.hideSpot.occupied = false;
  P.hiding = false; P.hideSpot = null;
  lockerClose();
  document.getElementById('hideOverlay').style.display = 'none';
  if (state.game && !state.paused) cvEl.requestPointerLock();
}
```

- [ ] **Step 6: Create `src/ui/settings.js`**

```js
import { state } from '../core/state.js';
import { applyLevelLighting } from '../world/lighting.js';

export function openSettings() {
  document.getElementById('sSens').value   = state.mouseSens;
  document.getElementById('sVol').value    = state.userVolume;
  document.getElementById('sBright').value = state.userBrightness;
  document.getElementById('sFx').value     = state.fxEnabled ? '1' : '0';
  document.getElementById('sFlash').value  = state.flashlightIntensity;
  document.getElementById('settingsModal').style.display = 'flex';
}

export function closeSettings() {
  document.getElementById('settingsModal').style.display = 'none';
  saveSettings();
}

export function bindSettings(getMasterGain) {
  document.getElementById('sSens').addEventListener('input',  e => { state.mouseSens = parseFloat(e.target.value); });
  document.getElementById('sVol').addEventListener('input',   e => {
    state.userVolume = parseFloat(e.target.value);
    const mg = getMasterGain(); if (mg) mg.gain.value = state.userVolume;
  });
  document.getElementById('sBright').addEventListener('input', e => {
    state.userBrightness = parseFloat(e.target.value);
    applyLevelLighting();
  });
  document.getElementById('sFx').addEventListener('change',   e => { state.fxEnabled = e.target.value === '1'; });
  document.getElementById('sFlash').addEventListener('input', e => { state.flashlightIntensity = parseFloat(e.target.value); });
}

export function loadSettings() {
  try {
    const j = JSON.parse(localStorage.getItem('br_settings') || '{}');
    if (j.sens)            state.mouseSens          = j.sens;
    if (j.vol !== undefined) state.userVolume        = j.vol;
    if (j.bright)          state.userBrightness     = j.bright;
    if (j.fx !== undefined) state.fxEnabled          = !!j.fx;
    if (j.flash)           state.flashlightIntensity = j.flash;
  } catch(e) {}
}

export function saveSettings() {
  try {
    localStorage.setItem('br_settings', JSON.stringify({
      sens:  state.mouseSens,
      vol:   state.userVolume,
      bright:state.userBrightness,
      fx:    state.fxEnabled,
      flash: state.flashlightIntensity,
    }));
  } catch(e) {}
}
```

`getMasterGain` is a function passed in from `audio/manager.js` — add `export function getMasterGain()` to `audio/manager.js` that returns `masterGain`.

- [ ] **Step 7: Update `src/main.js`**

Add imports:
```js
import { showHud, fmtTime, updateNoteCount, updateInteractHud } from './hud/hud.js';
import { showGameOver, levelComplete, nextLevel, restartFromLevel1, getBestTime, setBestTime } from './ui/screens.js';
import { pauseGame, resumeGame, quitToMenu } from './ui/pause.js';
import { openNote, closeNote } from './ui/noteReader.js';
import { enterHide, exitHide, findNearestHideSpot } from './ui/hideOverlay.js';
import { openSettings, closeSettings, bindSettings, loadSettings, saveSettings } from './ui/settings.js';
import { getMasterGain } from './audio/manager.js';
```

Delete all these functions from `src/main.js`. Update `handleInteract()` (which stays in `main.js` or moves to `ui/hideOverlay.js`) to import from the right places.

Call at boot:
```js
loadSettings();
bindSettings(getMasterGain);
```

Expose `nextLevel`, `restartFromLevel1`, `openSettings`, `closeSettings`, `pauseGame`, `resumeGame`, `quitToMenu` on `window` so the HTML `onclick=""` attributes still work:
```js
window.startGame         = startGame;
window.downloadGame      = downloadGame;
window.nextLevel         = () => nextLevel(resetState);
window.restartFromLevel1 = () => restartFromLevel1(resetState);
window.openSettings      = openSettings;
window.closeSettings     = closeSettings;
window.pauseGame         = pauseGame;
window.resumeGame        = resumeGame;
window.quitToMenu        = quitToMenu;
```

- [ ] **Step 8: Verify**

Run: `npm run dev` — all menus work (start, pause, settings, game over, level complete, win screen). Notes open and close. Hiding works. Settings save/load from localStorage.

- [ ] **Step 9: Commit**

```bash
git add src/hud/ src/ui/ src/audio/manager.js src/main.js
git commit -m "refactor: extract hud/hud.js and all ui/ modules"
```

---

## Task 16: Extract `src/core/postfx.js`

**Files:**
- Create: `src/core/postfx.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/core/postfx.js`**

```js
import * as THREE from 'three';
import { renderer, scene, camera } from './scene.js';

let fxRT    = null;
let fxScene = null;
let fxCam   = null;
export let fxMat = null;

export function initPostFX() {
  const w = renderer.domElement.width;
  const h = renderer.domElement.height;
  fxRT = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });
  fxScene = new THREE.Scene();
  fxCam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  fxMat   = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse:        { value: fxRT.texture },
      time:            { value: 0 },
      chase:           { value: 0 },
      resolution:      { value: new THREE.Vector2(w, h) },
      vignetteStrength:{ value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* copy verbatim from src/main.js lines 1570–1644 */,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fxMat);
  fxScene.add(quad);

  window.addEventListener('resize', () => {
    const nw = renderer.domElement.width, nh = renderer.domElement.height;
    fxRT.setSize(nw, nh);
    fxMat.uniforms.resolution.value.set(nw, nh);
  });
}

export function renderPostFX(now, chaseUniform, vignetteStrength) {
  fxMat.uniforms.time.value            = now * 0.001;
  fxMat.uniforms.chase.value          += (chaseUniform - fxMat.uniforms.chase.value) * 0.06;
  fxMat.uniforms.vignetteStrength.value = vignetteStrength;
  renderer.setRenderTarget(fxRT);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(fxScene, fxCam);
}
```

Copy the `fragmentShader` string verbatim from `src/main.js` lines 1570–1644.

- [ ] **Step 2: Update `src/main.js`**

Add imports:
```js
import { initPostFX, fxMat, renderPostFX } from './core/postfx.js';
```

In the game loop, replace the inline postFX render block:
```js
if (state.fxEnabled && fxMat) {
  const chaseU = MONSTER.state === 'chase' ? 1.0 : (MONSTER.state === 'investigate' ? 0.25 : 0);
  renderPostFX(now, chaseU, P.hiding ? 1.6 : 1.0);
} else {
  renderer.render(scene, camera);
}
```

Call `initPostFX()` in the boot section before `startGame`.

Delete `fxRT`, `fxScene`, `fxCam`, `fxMat`, and `initPostFX` from `src/main.js`.

- [ ] **Step 3: Verify**

Run: `npm run dev` — film grain, chromatic aberration, and vignette all render correctly. Chase effect intensifies when monster is chasing.

- [ ] **Step 4: Commit**

```bash
git add src/core/postfx.js src/main.js
git commit -m "refactor: extract core/postfx.js"
```

---

## Task 17: Clean up `src/main.js` — final wiring

**Files:**
- Modify: `src/main.js`

At this point `src/main.js` should contain only:
- All imports
- `handleInteract()` (or move it to `ui/hideOverlay.js`)
- `resetState()` (wires level setup using all extracted modules)
- `loop(now)` (game loop)
- `startGame()` 
- `downloadGame()`
- Boot section (event listeners on start screen, `window.*` exposures, initial render)

- [ ] **Step 1: Audit `src/main.js` for any remaining inline functions**

Run: `grep -n "^function\|^const.*=.*function\|^let.*=.*function" src/main.js`
Expected: only `handleInteract`, `resetState`, `loop`, `startGame`, `downloadGame`, `pollGamepad`, and `shuffle` remain.

- [ ] **Step 2: Write final `src/main.js` structure**

```js
import * as THREE from 'three';
import { TILE, CH, PLAYER_R } from './core/config.js';
import { state } from './core/state.js';
import { scene, camera, renderer, cvEl } from './core/scene.js';
import { initPostFX, fxMat, renderPostFX } from './core/postfx.js';
import { LEVEL_GRIDS, LEVELS } from './levels/index.js';
import { setGrid } from './world/map.js';
import { clearLevel, buildLevelGeometry } from './world/builder.js';
import { buildDust, updateDust } from './world/builder.js'; // dust is still in builder
import { applyLevelLighting, updateFlicker } from './world/lighting.js';
import { hidingSpots, batteryPickups, notePickups, monsterWaypoints,
         NOTE_LORE, buildKey, buildDoor, buildHidingSpot, buildBattery,
         buildNote, updateKeyAndDoor, keyGroup, doorGroup } from './world/collectibles.js';
import { P, updatePlayer, raiseNoise } from './player/controller.js';
import { updateFlashlight, toggleFlashlight } from './player/flashlight.js';
import { MONSTER, buildMonster, animateMonster, updateMonsterAI } from './monster/ai.js';
import { triggerGameOver } from './monster/jumpscare.js';
import { initAudio, startAmbient, startTenseLayer, startChaseLayer,
         startMonsterSound, updateMonsterAudio, updateMusicMix, getMasterGain } from './audio/manager.js';
import { initKeyboard } from './input/keyboard.js';
import { initMouse } from './input/mouse.js';
import { initMobile } from './input/mobile.js';
import { showHud, updateNoteCount, updateInteractHud, fmtTime } from './hud/hud.js';
import { showGameOver, levelComplete, nextLevel, restartFromLevel1 } from './ui/screens.js';
import { pauseGame, resumeGame, quitToMenu } from './ui/pause.js';
import { openNote, closeNote } from './ui/noteReader.js';
import { enterHide, exitHide, findNearestHideSpot } from './ui/hideOverlay.js';
import { openSettings, closeSettings, bindSettings, loadSettings } from './ui/settings.js';

function handleInteract() {
  if (!state.game || state.paused) return;
  if (P.hiding) { exitHide(); return; }
  for (const n of notePickups) {
    if (n.taken) continue;
    if (Math.hypot(P.x - n.worldX, P.z - n.worldZ) < 1.0) {
      n.taken = true; n.group.visible = false;
      P.notesFoundThisLevel++;
      updateNoteCount();
      import('./audio/manager.js').then(m => m.notePickupSound());
      openNote(n); return;
    }
  }
  const h = findNearestHideSpot();
  if (h && !h.occupied) { enterHide(h); return; }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function resetState() {
  clearLevel();
  setGrid(LEVEL_GRIDS[state.currentLevel]);
  buildLevelGeometry();
  buildDust();
  const SP = findSpawnTile();  // import from world/map.js
  const sc = tileCenter(SP.gx, SP.gz);
  P.x = sc.x; P.y = 1.7; P.z = sc.z;
  P.yaw = 0; P.pitch = 0;
  P.hasKey = false; P.stamina = 1.0; P.battery = 1.0;
  P.flashOn = false; P.hiding = false; P.hideSpot = null;
  P.noteReading = false; P.noteCurrent = null; P.noiseLevel = 0;

  const floorTiles = allFloorTiles().filter(t => !(t.gx === SP.gx && t.gz === SP.gz));
  const kt = pickFarFloorTile([SP], 6);
  const kc = tileCenter(kt.gx, kt.gz);
  buildKey(); keyGroup.position.set(kc.x, 0.6, kc.z);

  const dt = pickFarFloorTile([SP, kt], 7);
  const dc = tileCenter(dt.gx, dt.gz);
  buildDoor(); doorGroup.position.set(dc.x, 0, dc.z);
  doorGroup.rotation.y = Math.atan2(-dc.x, -dc.z);

  const hideCandidates = tilesAdjacentToWall()
    .filter(t => t.gx !== SP.gx && t.gz !== SP.gz && Math.hypot(t.gx - SP.gx, t.gz - SP.gz) > 2);
  shuffle(hideCandidates);
  for (let i = 0; i < Math.min(3 + state.currentLevel, hideCandidates.length); i++)
    buildHidingSpot(hideCandidates[i].gx, hideCandidates[i].gz);

  const usedTiles = new Set([SP, kt, dt].map(t => t.gx+'_'+t.gz));
  hidingSpots.forEach(h => usedTiles.add(h.gx+'_'+h.gz));
  const batteryPool = floorTiles.filter(t => !usedTiles.has(t.gx+'_'+t.gz));
  shuffle(batteryPool);
  for (let i = 0; i < Math.min(Math.max(2, 4 - Math.floor(state.currentLevel/2)), batteryPool.length); i++) {
    buildBattery(batteryPool[i].gx, batteryPool[i].gz);
    usedTiles.add(batteryPool[i].gx+'_'+batteryPool[i].gz);
  }

  const notePool = floorTiles.filter(t => !usedTiles.has(t.gx+'_'+t.gz));
  shuffle(notePool);
  const loreShuffled = NOTE_LORE.slice(); shuffle(loreShuffled);
  P.notesTotalThisLevel = Math.min(3, notePool.length);
  P.notesFoundThisLevel = 0;
  for (let i = 0; i < P.notesTotalThisLevel; i++) {
    buildNote(notePool[i].gx, notePool[i].gz, loreShuffled[i % loreShuffled.length]);
    usedTiles.add(notePool[i].gx+'_'+notePool[i].gz);
  }

  const wpPool = floorTiles.slice(); shuffle(wpPool);
  for (let i = 0; i < Math.min(4, wpPool.length); i++)
    monsterWaypoints.push({ gx: wpPool[i].gx, gz: wpPool[i].gz });

  MONSTER.spawned = false; MONSTER.state = 'idle';
  MONSTER.root.visible = false; MONSTER.targetPath = null; MONSTER.pathIndex = 0;

  applyLevelLighting();
  state.flashTimer  = 0;
  state.nextFlicker = (10 + Math.random() * 8) / LEVELS[state.currentLevel].flickerMul;
  state.flickering  = false;
  state.jsTriggered = false;

  document.getElementById('keyHudNew').style.display  = 'none';
  document.getElementById('levelHud').style.display   = 'block';
  document.getElementById('levelHud').textContent     = `LEVEL ${LEVELS[state.currentLevel].n} / 5 — ${LEVELS[state.currentLevel].name}`;
  document.getElementById('timerHud').style.display   = 'block';
  document.getElementById('bottomBar').style.display  = 'flex';
  document.getElementById('hud').style.opacity        = '0';
  document.body.classList.remove('chase');
  updateNoteCount();

  if (getMasterGain()) { startAmbient(); startTenseLayer(); startChaseLayer(); startMonsterSound(); }

  state.levelStartTime = Date.now();
  if (state.currentLevel === 0) state.startTime = state.levelStartTime;
  state.game = true; state.paused = false;
  showHud(`LEVEL ${LEVELS[state.currentLevel].n} — kalitni top, eshikni och`, 5500);
}

let last = 0, raf = 0;
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (state.game && !state.paused && !P.noteReading) {
    updatePlayer(dt);
    updateFlashlight(dt);
    updateFlicker(dt);
    updateKeyAndDoor(dt);
    updateMonsterAI(dt, () => triggerGameOver(showGameOver));
    animateMonster(dt);
    updateDust(dt);
    updateMonsterAudio(
      Math.hypot(P.x - MONSTER.x, P.z - MONSTER.z),
      P.x, P.z, P.yaw, MONSTER.x, MONSTER.z, MONSTER.spawned, MONSTER.state
    );
    updateMusicMix(dt,
      MONSTER.spawned ? Math.hypot(P.x - MONSTER.x, P.z - MONSTER.z) : 99,
      MONSTER.state, MONSTER.spawned
    );
    updateInteractHud(notePickups, hidingSpots);
    const s = Math.floor((Date.now() - state.levelStartTime) / 1000);
    document.getElementById('timerHud').textContent =
      `⏱ ${fmtTime(s)}   🗒 ${P.notesFoundThisLevel}/${P.notesTotalThisLevel}${P.hasKey ? '   🔑' : ''}`;
  }
  if (state.fxEnabled && fxMat) {
    const chaseU = MONSTER.state === 'chase' ? 1.0 : (MONSTER.state === 'investigate' ? 0.25 : 0);
    renderPostFX(now, chaseU, P.hiding ? 1.6 : 1.0);
  } else {
    renderer.render(scene, camera);
  }
}

function startGame() {
  initAudio();
  document.getElementById('startScreen').style.display = 'none';
  cvEl.requestPointerLock();
  state.currentLevel = 0;
  state.totalTime    = 0;
  resetState();
  last = performance.now();
  if (!raf) loop(last);
}

function downloadGame() {
  const b = new Blob([document.documentElement.outerHTML], { type: 'text/html' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b);
  a.download = 'backrooms-qochish-5level.html'; a.click();
}

// ── Boot ──────────────────────────────────────────────────────────
loadSettings();
bindSettings(getMasterGain);
buildMonster();
initPostFX();
initKeyboard(
  () => { if (P.noteReading) { closeNote(); return; } if (state.game && !state.paused) pauseGame(); },
  () => { if (P.noteReading) { closeNote(); return; } handleInteract(); },
  () => { if (state.game && !state.paused) toggleFlashlight(); }
);
initMouse(
  () => state.game && !state.paused && !P.hiding && !P.noteReading,
  (dx, dy) => {
    P.yaw   -= dx * 0.0022 * state.mouseSens;
    P.pitch  = Math.max(-1.1, Math.min(1.1, P.pitch - dy * 0.0022 * state.mouseSens));
  }
);
initMobile(
  () => toggleFlashlight(),
  () => handleInteract(),
  (dx, dy) => {
    if (!state.game || state.paused) return;
    P.yaw   -= dx * 0.005 * state.mouseSens;
    P.pitch  = Math.max(-1.1, Math.min(1.1, P.pitch - dy * 0.005 * state.mouseSens));
  }
);

window.startGame          = startGame;
window.downloadGame       = downloadGame;
window.nextLevel          = () => nextLevel(resetState);
window.restartFromLevel1  = () => restartFromLevel1(resetState);
window.openSettings       = openSettings;
window.closeSettings      = closeSettings;
window.pauseGame          = pauseGame;
window.resumeGame         = resumeGame;
window.quitToMenu         = quitToMenu;

renderer.render(scene, camera);
```

- [ ] **Step 3: Verify**

Run: `npm run dev` — full game playthrough: start screen → level 1 → pick up key → monster spawns → reach door → level complete → all 5 levels → win screen. Restart works. Settings persist across refresh.

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "refactor: finalize main.js wiring — all modules connected"
```

---

## Task 18: Production build and deployment setup

**Files:**
- Modify: `vite.config.js`
- Create: `public/assets/models/README.md`

- [ ] **Step 1: Update `vite.config.js` for production**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
```

Splitting Three.js into its own chunk means the browser caches it separately from game code — faster deploys.

- [ ] **Step 2: Create monster model instructions**

Create `public/assets/models/README.md`:

```markdown
# Monster Models

Drop `.glb` files here. They are served at `/assets/models/<filename>.glb`.

## How to generate from a photo (Option C pipeline)

1. Go to https://meshy.ai or https://app.tripo3d.ai
2. Upload your photo → select "Image to 3D"
3. Export as `.glb`
4. Drop the file here, e.g. `monster1.glb`

## How to load in Three.js

In `src/monster/loader.js` (create this file when ready):

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache  = {};

export function loadMonster(path) {
  return new Promise((resolve, reject) => {
    if (cache[path]) { resolve(cache[path].clone()); return; }
    loader.load(path, gltf => { cache[path] = gltf.scene; resolve(gltf.scene.clone()); }, undefined, reject);
  });
}
```

In `src/monster/spawner.js`, call:
```js
const model = await loadMonster('/assets/models/monster1.glb');
scene.add(model);
```
```

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected output:
```
dist/index.html
dist/assets/index-[hash].js
dist/assets/three-[hash].js
dist/assets/models/  (empty)
dist/assets/textures/ (empty)
dist/assets/audio/   (empty)
```
No errors.

- [ ] **Step 4: Preview production build locally**

Run: `npm run preview`
Open: `http://localhost:4173`
Expected: game fully playable from the production build.

- [ ] **Step 5: Commit**

```bash
git add vite.config.js public/assets/models/README.md
git commit -m "build: production vite config with three.js chunk split, model pipeline docs"
```

---

## Task 19: Move CSS out of `index.html`

**Files:**
- Create: `src/style.css`
- Modify: `index.html`, `src/main.js`

- [ ] **Step 1: Extract CSS**

Cut everything between `<style>` and `</style>` in `index.html` and paste it into `src/style.css`.

- [ ] **Step 2: Import CSS in `src/main.js`**

Add at top of `src/main.js`:
```js
import './style.css';
```

Vite handles CSS imports natively — this injects the styles at runtime.

- [ ] **Step 3: Verify**

Run: `npm run dev` — all visual styling correct (HUD, menus, canvas, vignette, mobile buttons).

- [ ] **Step 4: Commit**

```bash
git add src/style.css index.html src/main.js
git commit -m "refactor: extract CSS into src/style.css"
```

---

## Final Verification Checklist

Before declaring the refactor complete, play through the full game:

- [ ] Start screen renders, click starts game
- [ ] Level 1 (ZANGAR) loads — correct yellow lighting, open corridors
- [ ] WASD movement + mouse look works
- [ ] Sprint depletes stamina, walking restores it
- [ ] Flashlight toggle (F key) drains battery
- [ ] Pick up battery → battery +50%
- [ ] Read a note (walk over, press E)
- [ ] Enter locker (press E near locker) → hide overlay shows, exit with E
- [ ] Pick up key → monster spawns, chase music starts
- [ ] Monster chases with A* pathfinding, footstep sounds are spatial
- [ ] Reach door → Level Complete screen → proceed to Level 2
- [ ] Level 2–5 load with progressively darker palettes and faster monster
- [ ] Getting caught → jumpscare animation → Game Over screen
- [ ] Restart from Level 1 works
- [ ] Settings (mouse sens, volume, brightness, flashlight) save and persist
- [ ] Pause menu works
- [ ] `npm run build` produces clean `dist/` with no errors
- [ ] `npm run preview` — production build plays correctly
