import * as THREE from 'three';
import { TILE, CH, BASE_CEIL } from '../core/config.js';
import { state } from '../core/state.js';
import { MAP_W, MAP_H, getCurGW, getCurGH, getCurGrid, tileCenter } from './map.js';
import { scene, levelGroup } from '../core/scene.js';
import { LEVEL_TEX, wallTex, floorTex, ceilingTex } from './textures.js';

export const ceilingLights = [];
export const lightPanels   = [];

const clearCallbacks = [];
export function registerClearCallback(fn) { clearCallbacks.push(fn); }

export function disposeNode(node) {
  node.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    }
  });
}

export function clearLevel() {
  disposeNode(levelGroup);
  while (levelGroup.children.length) levelGroup.remove(levelGroup.children[0]);
  ceilingLights.length = 0;
  lightPanels.length   = 0;
  dustGeo = null;
  for (const cb of clearCallbacks) cb();
}

export function buildLevelGeometry() {
  const palette = LEVEL_TEX[state.currentLevel];
  const wTex = wallTex(palette.wall, palette.wAcc, palette.wDirt);
  const fTex = floorTex(palette.floor, palette.fAcc);
  const cTex = ceilingTex(palette.ceil);
  fTex.repeat.set(getCurGW(), getCurGH());
  cTex.repeat.set(getCurGW(), getCurGH());

  const wMat = new THREE.MeshStandardMaterial({ map: wTex, roughness: 0.88, metalness: 0.04 });
  const fMat = new THREE.MeshStandardMaterial({ map: fTex, roughness: 0.96 });
  const cMat = new THREE.MeshStandardMaterial({ map: cTex, roughness: 0.95 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), fMat);
  floor.rotation.x = -Math.PI/2;
  levelGroup.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), cMat);
  ceil.rotation.x = Math.PI/2;
  ceil.position.y = CH;
  levelGroup.add(ceil);

  const wallGeo = new THREE.BoxGeometry(TILE, CH, TILE);
  for (let gz = 0; gz < getCurGH(); gz++) {
    for (let gx = 0; gx < getCurGW(); gx++) {
      if (getCurGrid()[gz][gx] !== '1') continue;
      const c = tileCenter(gx, gz);
      const wall = new THREE.Mesh(wallGeo, wMat);
      wall.position.set(c.x, CH/2, c.z);
      levelGroup.add(wall);
    }
  }

  const lightPanelMat = new THREE.MeshBasicMaterial({ color: 0xccb080 });
  const panelGeo = new THREE.BoxGeometry(1.6, 0.08, 0.6);
  for (let gz = 1; gz < getCurGH() - 1; gz += 3) {
    for (let gx = 1; gx < getCurGW() - 1; gx += 4) {
      if (getCurGrid()[gz][gx] !== '0' && getCurGrid()[gz][gx] !== 'S') continue;
      const c = tileCenter(gx, gz);
      const pl = new THREE.PointLight(0xffe2a0, BASE_CEIL, 14, 2);
      pl.position.set(c.x, CH - 0.35, c.z);
      levelGroup.add(pl);
      ceilingLights.push(pl);
      const panel = new THREE.Mesh(panelGeo, lightPanelMat.clone());
      panel.position.set(c.x, CH - 0.08, c.z);
      levelGroup.add(panel);
      lightPanels.push(panel);
    }
  }
}

let dustGeo = null;
export function buildDust() {
  const DCOUNT = Math.min(240, Math.floor(MAP_W * MAP_H / 20));
  const pos = new Float32Array(DCOUNT * 3);
  for (let i = 0; i < DCOUNT; i++) {
    pos[i*3]   = (Math.random() - 0.5) * MAP_W;
    pos[i*3+1] = Math.random() * CH;
    pos[i*3+2] = (Math.random() - 0.5) * MAP_H;
  }
  dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(dustGeo,
    new THREE.PointsMaterial({ color: 0xddc090, size: 0.03, transparent: true, opacity: 0.4 }));
  levelGroup.add(points);
}
export function updateDust(dt) {
  if (!dustGeo) return;
  const d = dustGeo.attributes.position.array;
  const n = d.length / 3;
  for (let i = 0; i < n; i++) {
    d[i*3+1] -= dt * 0.05;
    d[i*3]   += (Math.random() - 0.5) * dt * 0.08;
    if (d[i*3+1] < 0) {
      d[i*3]   = (Math.random() - 0.5) * MAP_W;
      d[i*3+1] = CH;
      d[i*3+2] = (Math.random() - 0.5) * MAP_H;
    }
  }
  dustGeo.attributes.position.needsUpdate = true;
}
