import * as THREE from 'three';
import { TILE } from '../core/config.js';
import { isWall, tileCenter } from './map.js';
import { levelGroup } from '../core/scene.js';
import { registerClearCallback } from './builder.js';
import { paperTex, signTex } from './textures.js';

export let keyGroup = null;
export let doorGroup = null;
export const hidingSpots    = []; // { mesh, gx, gz, worldX, worldZ, occupied }
export const batteryPickups = []; // { group, gx, gz, worldX, worldZ, taken }
export const notePickups    = []; // kept empty — notes removed
export const monsterWaypoints = []; // { gx, gz }

registerClearCallback(() => {
  keyGroup  = null;
  doorGroup = null;
  hidingSpots.length     = 0;
  batteryPickups.length  = 0;
  notePickups.length     = 0;
  monsterWaypoints.length = 0;
});

export const NOTE_LORE = [];

export function buildKey() {
  keyGroup = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4a017, emissive: 0x3a2200, emissiveIntensity: 0.55,
    roughness: 0.25, metalness: 0.95
  });
  // shaft
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.22, 10),
    goldMat
  );
  shaft.rotation.z = Math.PI / 2;
  keyGroup.add(shaft);
  // bow (round head ring)
  const bow = new THREE.Mesh(
    new THREE.TorusGeometry(0.05, 0.014, 8, 18),
    goldMat
  );
  bow.position.set(-0.13, 0, 0);
  bow.rotation.y = Math.PI / 2;
  keyGroup.add(bow);
  // teeth — two small notches near the tip
  const tooth1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 0.04, 0.018),
    goldMat
  );
  tooth1.position.set(0.085, -0.024, 0);
  keyGroup.add(tooth1);
  const tooth2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.028, 0.018),
    goldMat
  );
  tooth2.position.set(0.055, -0.022, 0);
  keyGroup.add(tooth2);
  // tip
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.018, 0.04, 8),
    goldMat
  );
  tip.position.set(0.118, 0, 0);
  tip.rotation.z = -Math.PI / 2;
  keyGroup.add(tip);
  // faint glow
  const glow = new THREE.PointLight(0xffcc55, 0.4, 1.8);
  glow.position.y = 0.15;
  keyGroup.add(glow);
  levelGroup.add(keyGroup);
}

export function buildDoor() {
  doorGroup = new THREE.Group();
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x2a8c44, emissive: 0x004822, emissiveIntensity: 0.4,
    roughness: 0.55, metalness: 0.3
  });
  // door slab — thinner since it sits flush against a wall
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.7, 0.10), doorMat);
  door.position.y = 1.35;
  doorGroup.add(door);
  // wood-grain panels
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1c6630, roughness: 0.7 });
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.78, 1.05, 0.02),
        panelMat
      );
      panel.position.set((i - 0.5) * 0.85, 0.95 + j * 1.1, 0.06);
      doorGroup.add(panel);
    }
  }
  // door frame (around the door)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0e3018, roughness: 0.7 });
  const frameSpecs = [
    [-1.05, 1.4, 0, 0.16, 2.95, 0.18], // left jamb
    [ 1.05, 1.4, 0, 0.16, 2.95, 0.18], // right jamb
    [ 0,    2.9, 0, 2.30, 0.16, 0.18], // top jamb
  ];
  frameSpecs.forEach(([x, y, z, w, h, d]) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
    f.position.set(x, y, z); doorGroup.add(f);
  });
  // "Chiqish" sign above the door
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.4),
    new THREE.MeshBasicMaterial({ map: signTex('CHIQISH', '#0e1a0f', '#5dff8a'), transparent: true, depthWrite: false })
  );
  sign.position.set(0, 3.15, 0.06);
  doorGroup.add(sign);
  // sign light backlight
  const signGlow = new THREE.PointLight(0x33ff77, 0.6, 3.5);
  signGlow.position.set(0, 3.15, 0.4);
  doorGroup.add(signGlow);
  // handle
  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xddbb00, metalness: 0.9, roughness: 0.25 })
  );
  handle.position.set(0.7, 1.35, 0.07);
  doorGroup.add(handle);
  // soft green ambient glow
  const glow = new THREE.PointLight(0x33ff77, 1.0, 5);
  glow.position.set(0, 1.5, 0.5);
  doorGroup.add(glow);
  levelGroup.add(doorGroup);
}

export function buildHidingSpot(gx, gz) {
  let wallDir = null;
  for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    if (isWall(gx+dx, gz+dz)) { wallDir = [dx, dz]; break; }
  }
  if (!wallDir) return;
  const c = tileCenter(gx, gz);
  const offX = wallDir[0] * (TILE/2 - 0.35);
  const offZ = wallDir[1] * (TILE/2 - 0.35);
  const locker = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.8, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.3, 0.45), mat);
  body.position.y = 1.15;
  locker.add(body);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 2.1, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x5a4a34, roughness: 0.7 })
  );
  door.position.set(0, 1.15, 0.23);
  locker.add(door);
  for (let i = 0; i < 5; i++) {
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.03, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    slit.position.set(0, 1.8 - i*0.08, 0.26);
    locker.add(slit);
  }
  locker.position.set(c.x + offX, 0, c.z + offZ);
  if (wallDir[0] === 1)  locker.rotation.y = -Math.PI/2;
  if (wallDir[0] === -1) locker.rotation.y =  Math.PI/2;
  if (wallDir[1] === 1)  locker.rotation.y =  Math.PI;
  levelGroup.add(locker);
  hidingSpots.push({
    mesh: locker, gx, gz,
    worldX: c.x + offX * 0.3,
    worldZ: c.z + offZ * 0.3,
    occupied: false
  });
}

export function buildBattery(gx, gz) {
  const c = tileCenter(gx, gz);
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.28, 12),
    new THREE.MeshStandardMaterial({ color: 0xddcc22, emissive: 0x443300, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.7 })
  );
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10),
    new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.2 })
  );
  cap.position.y = 0.17;
  g.add(body); g.add(cap);
  g.position.set(c.x, 0.35, c.z);
  const glow = new THREE.PointLight(0xffee55, 0.6, 2.5);
  g.add(glow);
  levelGroup.add(g);
  batteryPickups.push({ group: g, gx, gz, worldX: c.x, worldZ: c.z, taken: false });
}

export function buildNote(gx, gz, lore) {
  const c = tileCenter(gx, gz);
  const g = new THREE.Group();
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.4),
    new THREE.MeshStandardMaterial({ map: paperTex(), roughness: 0.95, side: THREE.DoubleSide, emissive: 0x332211, emissiveIntensity: 0.2 })
  );
  paper.rotation.x = -Math.PI/2;
  paper.position.y = 0.05;
  g.add(paper);
  g.position.set(c.x, 0.01, c.z);
  const glow = new THREE.PointLight(0xffcc77, 0.4, 1.8);
  glow.position.y = 0.4;
  g.add(glow);
  levelGroup.add(g);
  notePickups.push({ group: g, gx, gz, worldX: c.x, worldZ: c.z, title: lore.t, text: lore.b, taken: false });
}
