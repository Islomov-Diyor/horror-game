# Project Structure Design — Backrooms Horror Game
**Date:** 2026-04-26  
**Status:** Approved by user

## Context

Currently a single `index.html` (~2750 lines) containing all HTML, CSS, and JS for a Five.js-based Backrooms horror game. 5 hand-authored levels (ZANGAR → JAHANNAM) in Uzbek. Features: flashlight/battery, stamina, monster chase, hide mechanic, notes/keys, mobile controls, post-FX.

**Goal:** Refactor into a proper Vite project for maintainability, future content expansion, and easy deployment to Netlify/GitHub Pages.

## Key Decisions

- **Build tool:** Vite (vanilla JS, no TypeScript)
- **Organization:** Hybrid feature+layer structure
- **Monster pipeline:** AI-generated `.glb` via Meshy/Tripo → GLTFLoader
- **Hosting:** `npm run build` → `dist/` → Netlify or GitHub Pages drag-drop

## Final Structure

```
horror-game/
├── index.html                  ← minimal shell, mounts #app
├── vite.config.js
├── package.json
├── CLAUDE.md                   ← project context for AI sessions
├── public/
│   └── assets/
│       ├── models/             ← .glb monster models (from Meshy/Tripo)
│       ├── textures/           ← wall/floor/ceiling textures
│       └── audio/              ← .ogg / .mp3 sounds
└── src/
    ├── main.js                 ← entry: init + start game
    ├── core/
    │   ├── config.js           ← TILE, speeds, all constants
    │   ├── scene.js            ← Three.js scene, camera, renderer setup
    │   └── state.js            ← global game state machine
    ├── levels/
    │   ├── index.js            ← level registry (imports all levels)
    │   ├── level1.js           ← grid + config for ZANGAR (Lobby)
    │   ├── level2.js           ← TUNNEL
    │   ├── level3.js           ← MAHBAS (Prison)
    │   ├── level4.js           ← CHUQUR (Pit)
    │   └── level5.js           ← JAHANNAM (Hell)
    ├── world/
    │   ├── builder.js          ← builds 3D geometry from level grid
    │   ├── lighting.js         ← ambient, point lights, flicker system
    │   └── collectibles.js     ← notes, keys, exit door placement
    ├── player/
    │   ├── controller.js       ← movement, collision, sprint
    │   ├── stamina.js          ← stamina logic
    │   └── flashlight.js       ← flashlight toggle, battery drain
    ├── monster/
    │   ├── loader.js           ← GLTFLoader wrapper for .glb models
    │   ├── ai.js               ← pathfinding, chase/idle state machine
    │   ├── spawner.js          ← per-level spawn rules and timing
    │   └── jumpscare.js        ← caught sequence, screen flash, game-over trigger
    ├── input/
    │   ├── keyboard.js         ← WASD, E, F, ESC, Shift
    │   ├── mouse.js            ← pointer lock, camera look rotation
    │   └── mobile.js           ← virtual joystick, touch buttons
    ├── audio/
    │   └── manager.js          ← Web Audio context, play/stop/fade helpers
    ├── hud/
    │   └── hud.js              ← stamina bar, battery bar, note count, timer
    └── ui/
        ├── screens.js          ← start, gameover, win, levelcomplete screens
        ├── pause.js            ← pause menu + settings modal
        ├── noteReader.js       ← in-game note overlay
        └── hideOverlay.js      ← hide-in-locker screen
```

## Module Responsibilities

### `core/state.js`
Single source of truth replacing scattered globals (`currentLevel`, `gameRunning`, etc.). Exposes `getState()` / `setState()`. All modules read from here.

### `levels/level*.js`
Each exports `{ grid, config }` — the hand-authored string array + level metadata (name, speed, fog, ambient color, etc.). Adding Level 6 = new file + one line in `index.js`.

### `monster/loader.js`
Wraps `THREE.GLTFLoader`. Accepts a path like `/assets/models/monster1.glb`, returns a cached `THREE.Group`. Called once per level load.

### `monster/jumpscare.js`
Triggered when monster reaches player. Sequence: screen shake → sound stab → full-screen flash → monster face hold (0.8s) → game over screen.

### `audio/manager.js`
Wraps Web Audio API. Methods: `play(id)`, `stop(id)`, `fade(id, to, duration)`, `setVolume(v)`. Sounds referenced by string ID, loaded from `public/assets/audio/`.

## Adding Future Content

| What | Where |
|------|--------|
| New level | `src/levels/levelN.js` + register in `levels/index.js` |
| New monster model | Drop `.glb` in `public/assets/models/` |
| New monster behavior | New state in `monster/ai.js` |
| New collectible | `world/collectibles.js` |
| New sound | `public/assets/audio/` + register in `audio/manager.js` |

## Deployment

```bash
npm run build   # outputs dist/
# Upload dist/ to Netlify (drag-drop) or push to GitHub → GitHub Pages
```
