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
export const notePickups    = []; // { group, gx, gz, worldX, worldZ, text, title, taken }
export const monsterWaypoints = []; // { gx, gz }

registerClearCallback(() => {
  keyGroup  = null;
  doorGroup = null;
  hidingSpots.length     = 0;
  batteryPickups.length  = 0;
  notePickups.length     = 0;
  monsterWaypoints.length = 0;
});

export const NOTE_LORE = [
  { t:"1-KUN", b:"Ishdan qaytayotganimda\nnotanish eshikka kirdim.\nUndan keyin hech narsa o'zgarmadi...\nfaqat shovqinlar." },
  { t:"QOCHISHGA URINISH", b:"Devorlar yurib turadi.\nXaritani chizish foydasiz.\nKalitlar bor — ular yashirilgan.\nOvoz qilma. U eshitadi." },
  { t:"U HAQIDA", b:"Uni ko'rmadim, lekin ovozini\neshitdim. Nafas olmayapti,\nzaharlashmagan... o'ladi menimcha\nkeyingi marta chiqsam." },
  { t:"OXIRGI TILAK", b:"Agar bu xatni topsangiz\nmen allaqachon yo'q.\nLocker'lar yordam beradi.\nBatareya — sizning eng yaxshi do'stingiz." },
  { t:"QOIDALAR", b:"1. Yugurma (u eshitadi)\n2. Yorug'likni o'chir (ba'zan)\n3. Lockerga yashirin\n4. Kalitsiz chiqmaysan" },
  { t:"XATA", b:"Chiroqni yoqdim. U qaradi.\nEndi u nima yerda ekanimni biladi.\nSensiz qochib bo'lmaydi.\nYur... men ustun qoldim." },
  { t:"5-LEVEL", b:"Bu yerda yorug' yo'q.\nFaqat chiroq bor. Batareya\ntugasa — hammasi tugaydi.\nYur. Orqaga qaramay." },
  { t:"SAVOL", b:"Nega men? Nega biz?\nBu joy meni tanlaganmi\nyoki men uni? Javob yo'q.\nFaqat eshiklar, kalitlar, va u." },
];

export function buildKey() {
  keyGroup = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    new THREE.MeshStandardMaterial({ color: 0xffdd33, emissive: 0xffaa00, emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.95 })
  );
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xffcc22, emissive: 0xcc8800, emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.9 })
  );
  stem.position.y = -0.3;
  stem.rotation.z = Math.PI/2;
  keyGroup.add(body);
  keyGroup.add(stem);
  const glow = new THREE.PointLight(0xffaa00, 1.8, 5);
  keyGroup.add(glow);
  levelGroup.add(keyGroup);
}

export function buildDoor() {
  doorGroup = new THREE.Group();
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x228833, emissive: 0x006622, emissiveIntensity: 0.6,
    roughness: 0.45, metalness: 0.35
  });
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 0.16), doorMat);
  door.position.y = 1.4;
  doorGroup.add(door);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x114422, roughness: 0.6 });
  [[-1.05,1.4,0,0.1,2.9,0.2],[1.05,1.4,0,0.1,2.9,0.2],[0,2.85,0,2.2,0.1,0.2]].forEach(([x,y,z,w,h,d]) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), frameMat);
    f.position.set(x,y,z); doorGroup.add(f);
  });
  const doorSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 0.45),
    new THREE.MeshBasicMaterial({ map: signTex('QOCHISH','#ffffff','#008822'), transparent:true, depthWrite:false })
  );
  doorSign.position.set(0, 2.2, 0.11);
  doorGroup.add(doorSign);
  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xddbb00, metalness: 0.9, roughness: 0.25 })
  );
  handle.position.set(0.7, 1.4, 0.12);
  doorGroup.add(handle);
  const glow = new THREE.PointLight(0x00ff55, 1.6, 6);
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
