import * as THREE from 'three';
import type { SplashPalette } from './splashMath';

/**
 * Generates an anisotropic brushed-titanium micro-grain map for PBR roughness & bump detail.
 */
export function createBrushedMetalTexture(): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle horizontal brushed bands
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 28; i++) {
    const y = rand() * canvas.height;
    const h = 2 + rand() * 8;
    const lum = Math.round(115 + rand() * 40);
    ctx.fillStyle = `rgba(${lum}, ${lum}, ${lum}, 0.22)`;
    ctx.fillRect(0, y, canvas.width, h);
  }

  // ~900 fine horizontal micro-streaks for anisotropic specular sheen
  for (let i = 0; i < 900; i++) {
    const x = rand() * canvas.width;
    const y = rand() * canvas.height;
    const len = 36 + rand() * 190;
    const lum = Math.round((0.32 + rand() * 0.63) * 255);
    const alpha = 0.08 + rand() * 0.24;
    ctx.fillStyle = `rgba(${lum}, ${lum}, ${lum}, ${alpha.toFixed(3)})`;
    ctx.fillRect(x, y, len, rand() > 0.65 ? 1.5 : 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 1.5);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Bakes a custom studio HDR reflection environment so brushed metals and refracting
 * liquid-glass prisms catch crisp sculpted softbox and theme-accent highlights.
 */
export function createStudioEnvironment(
  renderer: THREE.WebGLRenderer,
  palette: SplashPalette,
  isLightMode: boolean,
): THREE.WebGLRenderTarget {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  const envDisposables: Array<{ dispose: () => void }> = [];

  const shellGeo = new THREE.SphereGeometry(24, 24, 16);
  const shellMat = new THREE.MeshBasicMaterial({
    color: isLightMode ? '#d5e0ee' : '#04070d',
    side: THREE.BackSide,
  });
  envScene.add(new THREE.Mesh(shellGeo, shellMat));
  envDisposables.push(shellGeo, shellMat);

  const addPanel = (
    w: number,
    h: number,
    pos: [number, number, number],
    colorHex: string,
    intensity: number,
  ) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.lookAt(0, 0, 0);
    envScene.add(mesh);
    envDisposables.push(geo, mat);
  };

  // Front studio camera-axis fill reflector so flat metallic Z-faces gleam like brushed titanium
  addPanel(18, 6.5, [0, 3.8, 11.5], '#f8fafc', isLightMode ? 1.45 : 2.35);
  // Subtle lower bounce strip for underside bevel legibility
  addPanel(14, 4.0, [0, -5.5, 9.5], '#cbd5e1', isLightMode ? 0.9 : 1.05);
  // Overhead cinema softbox strip
  addPanel(16, 2.8, [0, 9.5, 1.5], '#ffffff', isLightMode ? 2.4 : 4.2);
  // Upper-left sculpted key panel
  addPanel(8, 5, [-8.5, 4.5, 5.5], '#f8fafc', isLightMode ? 1.9 : 3.2);
  // Right-side theme-colored reflector strip
  addPanel(6.5, 7, [8.5, 0.8, 4.5], palette.c400, isLightMode ? 1.8 : 3.0);
  // Lower-left cool-steel rim card
  addPanel(7, 3.2, [-7.5, -4.2, 4.5], '#7dd3fc', isLightMode ? 1.1 : 1.95);
  // Rear halo strip for crisp edge separation
  addPanel(12, 2.2, [0, 4.0, -8.5], palette.c300, isLightMode ? 1.5 : 2.8);

  const envRT = pmrem.fromScene(envScene, 0.032);
  for (const item of envDisposables) {
    item.dispose();
  }
  pmrem.dispose();
  return envRT;
}

export function createBackdropMaterial(
  palette: SplashPalette,
  isLightMode: boolean,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uAccent: { value: new THREE.Color(palette.c500) },
      uGlow: { value: new THREE.Color(palette.c300) },
      uBgCore: { value: new THREE.Color(isLightMode ? '#dde6f2' : '#060a12') },
      uBgEdge: { value: new THREE.Color(isLightMode ? '#b9c8dc' : '#010204') },
      uFlash: { value: 0 },
      uLightMode: { value: isLightMode ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uAccent;
      uniform vec3 uGlow;
      uniform vec3 uBgCore;
      uniform vec3 uBgEdge;
      uniform float uFlash;
      uniform float uLightMode;
      varying vec2 vUv;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec2 center = vec2(0.5, 0.5);
        vec2 delta = vUv - center;
        float dist = length(delta * vec2(1.0, 1.12));

        vec3 base = mix(uBgCore, uBgEdge, smoothstep(0.0, 0.9, dist));

        // Controlled linear-space studio halo behind centerpiece (ACES + sRGB lift later)
        float centerHalo = exp(-dist * dist * 9.5);
        vec3 haloTint = mix(uAccent, uGlow, 0.25);
        float haloGain = mix(0.036, 0.018, uLightMode) + uFlash * mix(0.075, 0.03, uLightMode);
        base += haloTint * centerHalo * haloGain;

        // Subtle overhead studio cone
        float coneX = abs(vUv.x - 0.5);
        float coneY = clamp(1.0 - vUv.y, 0.0, 1.0);
        float coneMask = exp(-coneX * coneX * (6.5 + coneY * 4.5)) * smoothstep(0.25, 0.98, vUv.y);
        base += uAccent * coneMask * (mix(0.016, 0.01, uLightMode) + uFlash * 0.03);

        // Restraint-tuned atmospheric light beams (linear space ~0.015 so dark obsidian stays rich)
        float diag1 = exp(-pow((vUv.x * 0.85 - vUv.y * 0.55 - 0.12 + sin(uTime * 0.35) * 0.03), 2.0) * 68.0);
        float diag2 = exp(-pow((vUv.x * 0.85 - vUv.y * 0.55 - 0.34 - cos(uTime * 0.28) * 0.03), 2.0) * 54.0);
        float diag3 = exp(-pow((vUv.x * 0.85 - vUv.y * 0.55 + 0.14 + sin(uTime * 0.22) * 0.025), 2.0) * 62.0);
        float shafts = (diag1 * 0.65 + diag2 * 0.45 + diag3 * 0.5) * smoothstep(0.18, 0.88, vUv.y);
        float shaftStrength = mix(0.016, 0.008, uLightMode);
        base += mix(uAccent, uGlow, 0.45) * shafts * shaftStrength;

        // 8-bit OLED dither
        float dither = (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(max(base + dither, 0.0), 1.0);
      }
    `,
  });
}

export function createStageFloorMaterial(
  palette: SplashPalette,
  isLightMode: boolean,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uAccent: { value: new THREE.Color(palette.c400) },
      uPulse: { value: 0 },
      uLightMode: { value: isLightMode ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uAccent;
      uniform float uPulse;
      uniform float uLightMode;
      varying vec2 vUv;

      void main() {
        vec2 p = vUv - vec2(0.5);
        float r = length(p * vec2(1.0, 1.25));

        // Radial fade ensures zero hard quad edges ever show
        float edgeMask = 1.0 - smoothstep(0.12, 0.44, r);
        float pool = exp(-r * r * 30.0);
        float ring = exp(-pow((r - 0.19 - sin(uTime * 0.7) * 0.008), 2.0) * 220.0) * 0.28;

        float strength = (pool * (0.15 + uPulse * 0.24) + ring * 0.18) * edgeMask;
        float alpha = clamp(strength * mix(0.52, 0.2, uLightMode), 0.0, 0.55);
        vec3 darkCol = mix(uAccent * 0.55, uAccent * 1.05, pool);
        vec3 lightShadow = mix(vec3(0.22, 0.28, 0.36), uAccent * 0.48, 0.35);
        vec3 col = mix(darkCol, lightShadow, uLightMode);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

export function createShockwaveMaterial(
  palette: SplashPalette,
  isLightMode: boolean,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: isLightMode ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: {
      uProgress: { value: 0 },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uAccent: { value: new THREE.Color(palette.c400) },
      uCore: { value: new THREE.Color('#ffffff') },
      uLightMode: { value: isLightMode ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uProgress;
      uniform float uOpacity;
      uniform float uTime;
      uniform vec3 uAccent;
      uniform vec3 uCore;
      uniform float uLightMode;
      varying vec2 vUv;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float angle = atan(p.y, p.x);

        float ringR = mix(0.14, 0.86, uProgress);
        float primary = exp(-pow((r - ringR) / 0.018, 2.0));
        float harmonic = exp(-pow((r - ringR * 0.86) / 0.042, 2.0)) * 0.42;

        float shimmer = 0.84 + 0.16 * cos(angle * 6.0 + uTime * 2.6);
        float outerMask = smoothstep(0.96, 0.72, r);
        float wave = (primary + harmonic) * shimmer * outerMask;

        vec3 col = mix(uAccent, uCore, primary * mix(0.65, 0.35, uLightMode));
        float alpha = clamp(wave * uOpacity * mix(1.0, 0.78, uLightMode), 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

export function createAnamorphicFlareMaterial(
  palette: SplashPalette,
  isLightMode: boolean,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: isLightMode ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: {
      uIntensity: { value: 0 },
      uSpread: { value: 1.0 },
      uAccent: { value: new THREE.Color(palette.c400) },
      uCore: { value: new THREE.Color('#ffffff') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      uniform float uSpread;
      uniform vec3 uAccent;
      uniform vec3 uCore;
      varying vec2 vUv;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float blade = exp(-abs(p.y) * 32.0) * exp(-abs(p.x) * (2.6 / max(uSpread, 0.2)));
        float core = exp(-dot(p * vec2(1.4, 3.2), p * vec2(1.4, 3.2)) * 8.0);
        float edgeMask = (1.0 - smoothstep(0.75, 1.0, abs(p.x))) * (1.0 - smoothstep(0.72, 1.0, abs(p.y)));

        float energy = (blade * 0.92 + core * 0.55) * edgeMask * uIntensity;
        vec3 col = mix(uAccent, uCore, clamp(core + blade * 0.55, 0.0, 1.0));
        gl_FragColor = vec4(col, clamp(energy, 0.0, 1.0));
      }
    `,
  });
}

export interface EmberSystem {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
}

export function createEmberSystem(
  palette: SplashPalette,
  isLightMode: boolean,
): EmberSystem {
  const count = 180;
  const positions = new Float32Array(count * 3);
  const aSize = new Float32Array(count);
  const aSpeed = new Float32Array(count);
  const aPhase = new Float32Array(count);
  const aHotness = new Float32Array(count);
  const aBurstDir = new Float32Array(count * 2);

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 15.0;
    const y = (Math.random() - 0.5) * 10.4;
    const z = -5.5 + Math.random() * 7.7;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const isBokehOrb = i % 10 < 3;
    aSize[i] = isBokehOrb ? 22 + Math.random() * 20 : 7 + Math.random() * 8;
    aSpeed[i] = 0.35 + Math.random() * 0.8;
    aPhase[i] = Math.random() * Math.PI * 2;
    aHotness[i] = Math.random();

    const len = Math.hypot(x, y) || 1;
    aBurstDir[i * 2] = x / len;
    aBurstDir[i * 2 + 1] = y / len;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
  geometry.setAttribute('aHotness', new THREE.BufferAttribute(aHotness, 1));
  geometry.setAttribute('aBurstDir', new THREE.BufferAttribute(aBurstDir, 2));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: isLightMode ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uImpact: { value: 0 },
      uAccent: { value: new THREE.Color(isLightMode ? palette.c600 : palette.c400) },
      uCore: { value: new THREE.Color(isLightMode ? palette.c700 : '#ffffff') },
      uLightMode: { value: isLightMode ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aSpeed;
      attribute float aPhase;
      attribute float aHotness;
      attribute vec2 aBurstDir;

      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uImpact;

      varying float vPhase;
      varying float vHotness;

      void main() {
        vPhase = aPhase;
        vHotness = aHotness;

        vec3 p = position;
        p.y = mod(p.y + uTime * aSpeed + 5.2, 10.4) - 5.2;
        p.x += sin(uTime * 0.9 + aPhase) * 0.22 + cos(uTime * 0.55 + aPhase * 1.7) * 0.12;
        p.xy += aBurstDir * uImpact * (0.45 + aHotness * 0.85);

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        float perspectiveSize = aSize * uPixelRatio * (8.5 / max(1.0, -mvPosition.z));
        gl_PointSize = clamp(perspectiveSize, 2.0, 56.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uAccent;
      uniform vec3 uCore;
      uniform float uLightMode;

      varying float vPhase;
      varying float vHotness;

      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c) * 2.0;
        if (r > 1.0) discard;

        float softDisc = exp(-r * r * 5.2) * (1.0 - smoothstep(0.75, 1.0, r));
        float shimmer = 0.72 + 0.28 * sin(uTime * 3.8 + vPhase);
        float hotCore = smoothstep(0.35, 1.0, vHotness) * exp(-r * r * 9.0);

        vec3 col = mix(uAccent, uCore, hotCore * mix(0.85, 0.55, uLightMode));
        float alpha = softDisc * shimmer * mix(0.82, 0.55, uLightMode);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  return { points, geometry, material };
}
