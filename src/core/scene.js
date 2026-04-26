import * as THREE from 'three';
import { BASE_HEMI, BASE_AMBIENT, BASE_PLAYER } from './config.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0604);
scene.fog = new THREE.FogExp2(0x0a0604, 0.030);

export const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 120);
camera.rotation.order = 'YXZ';

export const cvEl = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({
  canvas: cvEl, antialias: false, powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

export const audioListener = new THREE.AudioListener();
camera.add(audioListener);
scene.add(camera);

export const hemi       = new THREE.HemisphereLight(0xffd890, 0x221100, BASE_HEMI);
export const ambient    = new THREE.AmbientLight(0xffe2a0, BASE_AMBIENT);
export const playerLight= new THREE.PointLight(0xffe4b0, BASE_PLAYER, 7);
scene.add(hemi);
scene.add(ambient);
scene.add(playerLight);

export const flashlight  = new THREE.SpotLight(0xffeecc, 0, 18, Math.PI / 6.5, 0.35, 1.8);
flashlight.position.set(0, 1.7, 0);
scene.add(flashlight);
export const flashTarget = new THREE.Object3D();
scene.add(flashTarget);
flashlight.target = flashTarget;

export const levelGroup = new THREE.Group();
scene.add(levelGroup);
