import * as THREE from 'three';
import { renderer, scene, camera } from './scene.js';

export let fxRT = null, fxScene = null, fxCam = null, fxMat = null;



export function initPostFX() {
  const w = renderer.domElement.width;
  const h = renderer.domElement.height;
  fxRT = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType
  });
  fxScene = new THREE.Scene();
  fxCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  fxMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: fxRT.texture },
      time:     { value: 0 },
      chase:    { value: 0 },
      resolution:{ value: new THREE.Vector2(w, h) },
      vignetteStrength: { value: 1.0 },
      heartbeat: { value: 0.0 },
      shake:     { value: new THREE.Vector2(0, 0) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float time;
      uniform float chase;
      uniform vec2  resolution;
      uniform float vignetteStrength;
      uniform float heartbeat;
      uniform vec2  shake;
      varying vec2  vUv;

      float rand(vec2 co) {
        return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
      }

      void main() {
        vec2 uv = vUv + shake;
        vec2 center = vec2(0.5, 0.5);
        vec2 dir = uv - center;
        float dist = length(dir);

        // chromatic aberration
        float caAmount = 0.0025 + chase * 0.012;
        vec3 col;
        col.r = texture2D(tDiffuse, uv - dir * caAmount).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uv + dir * caAmount).b;

        // cheap bloom
        vec3 blurSum = vec3(0.0);
        float texelX = 1.0 / resolution.x;
        float texelY = 1.0 / resolution.y;
        for (int i = -2; i <= 2; i++) {
          for (int j = -2; j <= 2; j++) {
            blurSum += texture2D(tDiffuse, uv + vec2(float(i)*texelX*2.0, float(j)*texelY*2.0)).rgb;
          }
        }
        blurSum /= 25.0;
        vec3 bright = max(blurSum - vec3(0.45), vec3(0.0));
        col += bright * (1.2 + chase * 0.8);

        // scanlines
        float scan = sin(uv.y * resolution.y * 1.5) * 0.06 * (0.4 + chase * 1.2);
        col -= scan;

        // film grain
        float n = rand(uv + vec2(time * 0.2, -time * 0.13));
        col += (n - 0.5) * (0.10 + chase * 0.06);

        // chase red tint
        col.r += chase * 0.12 * (0.5 + 0.5 * sin(time * 8.0));
        col *= 1.0 - chase * 0.08;

        // vignette — pulses with heartbeat
        float vigPulse = vignetteStrength + heartbeat * 0.5;
        float vig = smoothstep(0.85, 0.2, dist);
        col *= mix(1.0, vig, 0.65 * vigPulse);

        // heartbeat red flash at edges
        col.r += heartbeat * (1.0 - vig) * 0.35;

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fxMat);
  fxScene.add(quad);
}


export function resizePostFX() {
  const w = renderer.domElement.width, h = renderer.domElement.height;
  fxRT.setSize(w, h);
  if (fxMat) fxMat.uniforms.resolution.value.set(w, h);
}
