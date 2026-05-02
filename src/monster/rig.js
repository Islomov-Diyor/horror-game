import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { scene } from '../core/scene.js';

const MODEL_URL = 'assets/models/momo.glb';
const TARGET_HEIGHT = 1.85;

const CLIP_PATTERNS = {
  idle:   [/^idle/i, /look/i, /breath/i],
  walk:   [/walk/i, /walking/i],
  run:    [/run/i, /running/i, /sprint/i],
  attack: [/attack/i, /scream/i, /lunge/i, /bite/i, /punch/i],
};

function pickClip(clips, kind) {
  for (const re of CLIP_PATTERNS[kind]) {
    const hit = clips.find(c => re.test(c.name));
    if (hit) return hit;
  }
  return null;
}

function measureStridePerSecond(clip) {
  const trackHip = clip.tracks.find(t =>
    /hip|pelvis|root|armature/i.test(t.name) && /\.position/i.test(t.name)
  );
  if (!trackHip) return null;
  const v = trackHip.values;
  if (v.length < 6) return null;
  let minZ = Infinity, maxZ = -Infinity, minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < v.length; i += 3) {
    const x = v[i], z = v[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const span = Math.max(maxX - minX, maxZ - minZ);
  if (span < 0.01) return null;
  return span / clip.duration;
}

export async function loadRig(MONSTER) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(MODEL_URL);
  const root = gltf.scene;

  let headBone = null;
  root.traverse(o => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      o.frustumCulled = false;
      if (o.material) {
        o.material.side = THREE.FrontSide;
        if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
      }
    }
    if (o.isBone && /head/i.test(o.name) && !headBone) headBone = o;
  });

  const bbox = new THREE.Box3().setFromObject(root);
  const rawHeight = Math.max(0.1, bbox.max.y - bbox.min.y);
  const baseScale = TARGET_HEIGHT / rawHeight;
  root.scale.setScalar(baseScale);
  root.updateMatrixWorld(true);
  const bbox2 = new THREE.Box3().setFromObject(root);
  const yOffset = -bbox2.min.y;
  root.position.y = yOffset;

  const carrier = new THREE.Group();
  carrier.add(root);
  carrier.visible = false;
  scene.add(carrier);

  const mixer = new THREE.AnimationMixer(root);
  const clips = gltf.animations || [];

  const actions = {};
  for (const kind of ['idle', 'walk', 'run', 'attack']) {
    const clip = pickClip(clips, kind);
    if (clip) {
      const action = mixer.clipAction(clip);
      action.enabled = true;
      action.setEffectiveWeight(0);
      action.play();
      actions[kind] = { clip, action };
    }
  }
  if (actions.attack) {
    actions.attack.action.setLoop(THREE.LoopOnce, 1);
    actions.attack.action.clampWhenFinished = true;
  }

  const walkStride = actions.walk ? measureStridePerSecond(actions.walk.clip) : null;
  const runStride  = actions.run  ? measureStridePerSecond(actions.run.clip)  : null;

  MONSTER.root = carrier;
  MONSTER.modelRoot = root;
  MONSTER.baseScale = baseScale;
  MONSTER.baseYOffset = yOffset;
  MONSTER.mixer = mixer;
  MONSTER.actions = actions;
  MONSTER.headBone = headBone;
  MONSTER.stride = { walk: walkStride, run: runStride };
  MONSTER.currentClip = null;

  if (!actions.idle) console.warn('[monster] no Idle clip found in', MODEL_URL);
  if (!actions.walk) console.warn('[monster] no Walk clip found in', MODEL_URL);
  if (!actions.run)  console.warn('[monster] no Run clip found in', MODEL_URL);
  if (!actions.attack) console.warn('[monster] no Attack/Scream clip found in', MODEL_URL);
}
