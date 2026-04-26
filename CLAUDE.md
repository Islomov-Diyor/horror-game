# CLAUDE.md — Backrooms Horror Game

Quick orientation for new AI sessions. Read this first before touching any file.

## What This Is

A Three.js first-person Backrooms horror game. UI language: Uzbek. Five hand-authored levels (ZANGAR → TUNNEL → MAHBAS → CHUQUR → JAHANNAM), each progressively darker, faster, scarier.

## Current State (as of 2026-04-26)

**Before refactor:** Everything lives in one file — `index.html` (~2750 lines of HTML + CSS + JS).

**Planned refactor:** Split into a Vite project. See the approved spec:
`docs/superpowers/specs/2026-04-26-project-structure-design.md`

## Tech Stack

- **Renderer:** Three.js r128 (currently CDN, will move to npm)
- **Build:** Vite (vanilla JS, no TypeScript)
- **Monster models:** `.glb` files generated via Meshy or Tripo AI from user photos
- **Hosting target:** Netlify or GitHub Pages (`npm run build` → `dist/`)

## Game Systems (all currently in index.html)

| System | Description |
|--------|-------------|
| Levels | 5 grids in `LEVEL_GRIDS[]`, configs in `LEVELS[]` |
| World | Tile-based map built from string grids, `TILE = 3.5` |
| Player | WASD + mouse look, sprint (stamina), flashlight (battery) |
| Monster | Chase AI, triggered by proximity/noise |
| Collectibles | Notes (lore), keys (unlock exit) |
| Hiding | Press E at locker → hide overlay, hold breath mechanic |
| HUD | Stamina bar, battery bar, note count, level/timer display |
| UI | Start screen, pause, settings, game over, level complete, final win |
| Mobile | Virtual joystick + touch buttons |
| Audio | Web Audio API, ambient + chase + footstep sounds |
| Post-FX | Vignette, film grain, chromatic aberration, chase vignette |

## Level Configs

```js
{ n:1, name:"ZANGAR",   spd:2.4, lm:1.00, fm:0.80, fogColor:0x1a0f04 }  // Lobby
{ n:2, name:"TUNNEL",   spd:2.8, lm:0.80, fm:1.15, fogColor:0x0d0a06 }
{ n:3, name:"MAHBAS",   spd:3.2, lm:0.62, fm:1.45, fogColor:0x100502 }  // Prison
{ n:4, name:"CHUQUR",   spd:3.6, lm:0.44, fm:1.80, fogColor:0x080303 }  // Pit
{ n:5, name:"JAHANNAM", spd:4.0, lm:0.32, fm:2.15, fogColor:0x0a0202 }  // Hell
```

## Key Constants (in index.html → will move to src/core/config.js)

```js
TILE = 3.5        // world unit per grid cell
CH = 3.5          // ceiling height
PLAYER_R = 0.32   // collision radius
WALK_SPD = 3.4
SPRINT_SPD = 6.2
```

## Planned Folder Structure (post-refactor)

```
src/
  main.js
  core/         config.js, scene.js, state.js
  levels/       level1–5.js + index.js
  world/        builder.js, lighting.js, collectibles.js
  player/       controller.js, stamina.js, flashlight.js
  monster/      loader.js, ai.js, spawner.js, jumpscare.js
  input/        keyboard.js, mouse.js, mobile.js
  audio/        manager.js
  hud/          hud.js
  ui/           screens.js, pause.js, noteReader.js, hideOverlay.js
public/
  assets/
    models/     ← .glb monster files go here
    textures/
    audio/
```

## Adding New Content (post-refactor)

- **New level:** `src/levels/levelN.js` + register in `levels/index.js`
- **New monster model:** Drop `.glb` in `public/assets/models/`
- **New sound:** `public/assets/audio/` + register in `audio/manager.js`

## Monster Pipeline

User provides a real photo → run through Meshy or Tripo AI → export `.glb` → drop in `public/assets/models/` → load via `monster/loader.js` (GLTFLoader). One monster per level is the current plan.

## What NOT To Do

- Don't touch `index.html` for new features — everything should go into the module structure
- Don't hardcode level data outside `src/levels/`
- Don't add global variables — use `src/core/state.js`
