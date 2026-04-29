# Monster Overhaul Design Spec
Date: 2026-04-30

## Scope
Changes are limited to: monster appearance, monster AI/movement, jumpscare, key collectible, door placement. No other systems touched.

---

## 1. Appearance (`src/monster/index.js` — `buildMonster()`)

### Head / Face (Momo-inspired)
- Head sphere scaled 40% wider (`scale.x = 1.4`)
- Eyes: two large white sclera spheres (radius 0.07) + small dark pupil sphere (radius 0.03) centered. No red glow. Slightly too far apart (`±0.10` x offset). Never blink.
- Mouth: thin curved `TorusGeometry` (arc only, ~200°) flush on face — fixed wide grin. Pale pink material.
- Skin color: `0xd4cfc8` (pale grey-white), near-zero emissive
- Hair: increase strand count from 6 → 12, longer planes (0.75 height), some drape forward over face

### Body (wrong proportions)
- Arms: 30% longer — increase upper/forearm cylinder heights by 1.3x, adjust positions
- Neck: taller and thinner (`CylinderGeometry(0.06, 0.07, 0.28)`)
- Torso: narrower (`CylinderGeometry(0.18, 0.26, 0.78)`)
- Per-level scale: applied in `monsterSpawnBehindPlayer()`:
  - Level 1: `root.scale.set(1, 1, 1)`
  - Level 2: `root.scale.set(1, 1.04, 1)`
  - Level 3: `root.scale.set(1, 1.07, 1)`
  - Level 4: `root.scale.set(1, 1.11, 1)`
  - Level 5: `root.scale.set(1.05, 1.15, 1.05)`

---

## 2. Movement (`animateMonster()`)

### Wrong movement signatures
| Behavior | Implementation |
|----------|---------------|
| Freeze-stare | In `patrol`/`idle`: random timer (2–4s), set speed=0, lock head toward player for duration |
| Head over-rotation | `headPivot.rotation.y` allowed up to ±2.4 rad (≈140°). During `investigate` head rotates before body turns. |
| Lunge burst | On state transition to `chase`: set `MONSTER.lunging = true`, lerp speed from 0 → `spd*1.8` over 0.3s |
| Prediction chase | In `chase` movement: target = `(P.x + P.vx*1.5, P.z + P.vz*1.5)`. Requires `P.vx/P.vz` (player velocity, already computable from position delta). |
| Twitchy idle | In `idle`: every 2–4s, apply random `±0.3 rad` snap to `root.rotation.y`, reset after 0.1s |
| Stun reaction | On stun: arms spread wide (`armL_shoulder.rotation.z = -1.2`, right = 1.2`), head drops (`headPivot.rotation.x = 0.8`) |

---

## 3. AI Logic (`updateMonsterAI()`)

### New state: `listening`
- Triggered when monster loses sight of player (was chasing, now lost)
- Monster stops moving, slowly rotates head (full 360° over 4s)
- If player footstep sound within 6u → back to `chase`
- After 5s with no sound → `investigate` last known pos

### Per-level aggression
| Level | Base spd | Give-up (listening timeout) | Prediction strength |
|-------|----------|----------------------------|---------------------|
| 1 | 3.2 | 8s | none (target player pos) |
| 2 | 3.6 | 10s | 0.5s ahead |
| 3 | 4.0 | 14s | 1.0s ahead |
| 4 | 4.5 | 20s | 1.5s ahead |
| 5 | 5.0 | never | 1.5s ahead |

Store prediction lookahead per level in `LEVELS[]` config as `pred` field.

### Stun memory
- `MONSTER.stunCount` tracks hits
- After 2 stuns: reduce locker detection distance threshold from 2u → 1.2u (slightly less aggressive near lockers, balanced)

### Hiding (improved)
- Breath-hold bar: already exists, no change needed to logic
- If `MONSTER.state === 'chase'` and dist < 2u from player's locker: monster lingers 3–5s, plays scratch sound, checks `noiseLevel > 0.3` for detection

---

## 4. Jumpscare (`runJumpscare()` in `src/monster/index.js`)

- On trigger: monster mesh does a fast lunge animation — `root.scale` goes from current → `(8, 8, 8)` over 0.15s, position lerps toward camera
- Simultaneously: play girl scream audio (new file `public/assets/audio/scream.mp3`)
- White flash overlay for 0.1s then fade to black
- After 2.3s total: existing game-over callback fires
- The existing 2D canvas `drawJsFace()` still runs on top (Momo face zooms in)

---

## 5. Key Collectible (`src/world/collectibles.js`)

### Remove
- All note/paper collectibles (`notePositions`, note mesh creation, note pickup logic, note HUD counter)

### Key (Kalit) — new mesh
- Shape: cylinder shaft (`CylinderGeometry(0.015, 0.015, 0.18)`) + bow (torus `TorusGeometry(0.04, 0.012, 8, 16)`) at top + 2 small teeth (tiny boxes on shaft)
- Material: `MeshStandardMaterial({ color: 0xd4a017, metalness: 0.9, roughness: 0.2 })` — gold/brass
- Position: flat on floor (`y = 0.05`), slow Y-axis rotation (`rotation.y += dt * 1.2`)
- Faint yellow point light above it (intensity 0.3, distance 1.5)
- Pickup: same `E` key proximity check, range 1.2u

---

## 6. Door (`src/world/builder.js` or wherever exit door is built)

- Door mesh must be flush against a wall tile, not floating mid-corridor
- "Chiqish" text: `THREE.PlaneGeometry` with canvas texture rendering "Chiqish" text, placed above door frame
- Door stays locked until key collected (existing logic, no change)

---

## Out of Scope
- Player controller, stamina, flashlight — untouched
- Level grid layouts — untouched
- Audio manager (except adding scream.mp3 reference) — untouched
- UI screens — untouched
