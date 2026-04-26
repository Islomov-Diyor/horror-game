import * as THREE from 'three';

export function wallTex(base, accent, dirt) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0,0,256,256);
  for (let x = 0; x < 256; x += 6) {
    g.fillStyle = (x/6)%2 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.05)';
    g.fillRect(x, 0, 3, 256);
  }
  for (let i = 0; i < 2800; i++) {
    g.fillStyle = `rgba(0,0,0,${.05 + Math.random()*.25})`;
    g.fillRect(Math.random()*256, Math.random()*256, 1+Math.random()*2, 1+Math.random()*2);
  }
  // grime patches
  for (let i = 0; i < 10; i++) {
    const cx = Math.random()*256, cy = Math.random()*256;
    const grd = g.createRadialGradient(cx, cy, 2, cx, cy, 30+Math.random()*30);
    grd.addColorStop(0, dirt); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(cx-60, cy-60, 120, 120);
  }
  // baseboard
  g.fillStyle = accent; g.fillRect(0, 240, 256, 16);
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 240, 256, 3);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function floorTex(base, accent) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0,0,256,256);
  for (let i = 0; i < 7000; i++) {
    g.fillStyle = `rgba(${20+Math.random()*40},${14+Math.random()*30},${6+Math.random()*20},${.25+Math.random()*.35})`;
    g.fillRect(Math.random()*256, Math.random()*256, 1+Math.random()*1.6, 1);
  }
  for (let i = 0; i < 6; i++) {
    const cx = Math.random()*256, cy = Math.random()*256;
    const grd = g.createRadialGradient(cx, cy, 1, cx, cy, 30+Math.random()*20);
    grd.addColorStop(0, accent); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(cx-50, cy-50, 100, 100);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function ceilingTex(base) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0,0,256,256);
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = `rgba(0,0,0,${.1+Math.random()*.18})`;
    g.fillRect(Math.random()*256, Math.random()*256, 1+Math.random()*2, 1+Math.random()*2);
  }
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2;
  g.strokeRect(1,1,254,254);
  g.beginPath(); g.moveTo(128,0); g.lineTo(128,256);
  g.moveTo(0,128); g.lineTo(256,128); g.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function paperTex() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 180;
  const g = cv.getContext('2d');
  g.fillStyle = '#e8d8aa'; g.fillRect(0,0,256,180);
  for (let i = 0; i < 800; i++) {
    g.fillStyle = `rgba(90,60,20,${.08+Math.random()*.14})`;
    g.fillRect(Math.random()*256, Math.random()*180, 1+Math.random()*2, 1);
  }
  // simulated handwriting lines
  g.strokeStyle = '#3a1a08'; g.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const y = 30 + i*24;
    g.beginPath();
    let x = 20 + Math.random()*10;
    g.moveTo(x, y);
    while (x < 236) {
      x += 6+Math.random()*12;
      g.lineTo(x, y + (Math.random()-.5)*6);
    }
    g.stroke();
  }
  // corner stain
  const grd = g.createRadialGradient(220, 30, 3, 220, 30, 60);
  grd.addColorStop(0, 'rgba(80,40,10,.4)'); grd.addColorStop(1, 'rgba(80,40,10,0)');
  g.fillStyle = grd; g.fillRect(160, 0, 96, 90);
  return new THREE.CanvasTexture(cv);
}
export function signTex(text, bg = '#222', fg = '#ffdd44') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 80;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0,0,256,80);
  g.strokeStyle = fg; g.lineWidth = 2; g.strokeRect(3,3,250,74);
  g.fillStyle = fg; g.font = 'bold 22px Courier New';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 42);
  return new THREE.CanvasTexture(cv);
}

export const LEVEL_TEX = [
  { wall:'#b89340', wAcc:'#5c3d12', wDirt:'rgba(60,35,10,.38)', floor:'#6e5320', fAcc:'rgba(20,12,4,.45)', ceil:'#a89f88' },
  { wall:'#8a6228', wAcc:'#3a2a0e', wDirt:'rgba(40,22,8,.42)',  floor:'#4a371a', fAcc:'rgba(10,6,2,.5)',   ceil:'#776552' },
  { wall:'#5f4420', wAcc:'#241508', wDirt:'rgba(30,10,5,.5)',   floor:'#2e2010', fAcc:'rgba(5,2,1,.6)',    ceil:'#4a3d2a' },
  { wall:'#3e2c15', wAcc:'#120806', wDirt:'rgba(60,5,5,.45)',   floor:'#1a1208', fAcc:'rgba(60,0,0,.4)',   ceil:'#2a1f15' },
  { wall:'#421510', wAcc:'#1a0302', wDirt:'rgba(120,10,10,.5)', floor:'#2a0a06', fAcc:'rgba(120,0,0,.55)', ceil:'#1a0604' },
];