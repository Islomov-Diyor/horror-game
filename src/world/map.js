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

export function getCurGW()   { return CUR_GW; }
export function getCurGH()   { return CUR_GH; }
export function getCurGrid() { return CUR_GRID; }

export function isWall(gx, gz) {
  if (gx < 0 || gx >= CUR_GW || gz < 0 || gz >= CUR_GH) return true;
  return CUR_GRID[gz][gx] === '1';
}
export function tileAt(x, z) {
  const gx = Math.floor((x + MAP_W / 2) / TILE);
  const gz = Math.floor((z + MAP_H / 2) / TILE);
  if (gx < 0 || gx >= CUR_GW || gz < 0 || gz >= CUR_GH) return '1';
  return CUR_GRID[gz][gx] === '1' ? '1' : '0';
}
export function inMap(x, z, r = PLAYER_R) {
  return tileAt(x - r, z - r) === '0' &&
         tileAt(x + r, z - r) === '0' &&
         tileAt(x - r, z + r) === '0' &&
         tileAt(x + r, z + r) === '0';
}
export function tileCenter(gx, gz) {
  return { x: (gx - CUR_GW / 2 + 0.5) * TILE, z: (gz - CUR_GH / 2 + 0.5) * TILE };
}
export function worldToTile(x, z) {
  return {
    gx: Math.floor((x + MAP_W / 2) / TILE),
    gz: Math.floor((z + MAP_H / 2) / TILE),
  };
}
export function findSpawnTile() {
  for (let gz = 0; gz < CUR_GH; gz++)
    for (let gx = 0; gx < CUR_GW; gx++)
      if (CUR_GRID[gz][gx] === 'S') return { gx, gz };
  for (let gz = 0; gz < CUR_GH; gz++)
    for (let gx = 0; gx < CUR_GW; gx++)
      if (CUR_GRID[gz][gx] === '0') return { gx, gz };
  return { gx: 1, gz: 1 };
}
export function allFloorTiles() {
  const a = [];
  for (let gz = 1; gz < CUR_GH - 1; gz++)
    for (let gx = 1; gx < CUR_GW - 1; gx++) {
      const c = CUR_GRID[gz][gx];
      if (c === '0' || c === 'S') a.push({ gx, gz });
    }
  return a;
}
export function pickFarFloorTile(excludes, minDist) {
  const cand = [];
  for (const t of allFloorTiles()) {
    let ok = true;
    for (const e of excludes) {
      if (Math.abs(t.gx - e.gx) + Math.abs(t.gz - e.gz) < minDist) { ok = false; break; }
    }
    if (ok) cand.push(t);
  }
  if (!cand.length) return allFloorTiles()[0] || { gx: 1, gz: 1 };
  return cand[Math.floor(Math.random() * cand.length)];
}
export function tilesAdjacentToWall() {
  const a = [];
  for (const t of allFloorTiles()) {
    if ([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz]) => isWall(t.gx+dx, t.gz+dz)))
      a.push(t);
  }
  return a;
}
export function aStar(sx, sz, gx, gz) {
  if (isWall(gx, gz) || isWall(sx, sz)) return null;
  if (sx === gx && sz === gz) return [{ gx: sx, gz: sz }];
  const key = (x, z) => x + '_' + z;
  const openMap = new Map();
  const closed  = new Set();
  openMap.set(key(sx, sz), { gx: sx, gz: sz, g: 0, h: Math.abs(sx-gx)+Math.abs(sz-gz), parent: null });
  let iter = 0;
  while (openMap.size && iter++ < 3000) {
    let cur = null;
    for (const n of openMap.values())
      if (!cur || (n.g + n.h) < (cur.g + cur.h)) cur = n;
    openMap.delete(key(cur.gx, cur.gz));
    closed.add(key(cur.gx, cur.gz));
    if (cur.gx === gx && cur.gz === gz) {
      const path = [];
      let n = cur;
      while (n) { path.unshift({ gx: n.gx, gz: n.gz }); n = n.parent; }
      return path;
    }
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cur.gx + dx, nz = cur.gz + dz;
      if (isWall(nx, nz) || closed.has(key(nx, nz))) continue;
      const g = cur.g + 1, k = key(nx, nz);
      const existing = openMap.get(k);
      if (existing && existing.g <= g) continue;
      openMap.set(k, { gx: nx, gz: nz, g, h: Math.abs(nx-gx)+Math.abs(nz-gz), parent: cur });
    }
  }
  return null;
}
