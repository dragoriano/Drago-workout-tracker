import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SPLASH_BOLD_FONT, SPLASH_REGULAR_FONT } from '../../assets/fonts/splashFont';
import {
  clamp01,
  computeHeroFraming,
  easeInOutQuart,
  easeOutBackSubtle,
  easeOutCubic,
  easeOutExpo,
  getSplashPalette,
  smoothstep,
} from './splashMath';
import {
  createAnamorphicFlareMaterial,
  createBackdropMaterial,
  createBrushedMetalTexture,
  createEmberSystem,
  createShockwaveMaterial,
  createStageFloorMaterial,
  createStudioEnvironment,
} from './splashSceneAssets';

interface ThreeSplashScreenProps {
  themeColor: string;
  isLightMode: boolean;
  durationMs?: number;
  onComplete: () => void;
}

interface HeroLetterNode {
  mesh: THREE.Mesh;
  baseX: number;
  baseY: number;
  frontMat: THREE.MeshPhysicalMaterial;
  bevelMat: THREE.MeshPhysicalMaterial;
  distFromCenter: number;
}

function hasWebGLSupport(): boolean {
  try {
    const testCanvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (testCanvas.getContext('webgl2') || testCanvas.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

function buildPlateLatheGeometry(): THREE.LatheGeometry {
  const plateProfile = [
    new THREE.Vector2(1.88, -0.075),
    new THREE.Vector2(1.93, -0.10),
    new THREE.Vector2(2.04, -0.10),
    new THREE.Vector2(2.08, -0.045),
    new THREE.Vector2(2.26, -0.045),
    new THREE.Vector2(2.30, -0.10),
    new THREE.Vector2(2.41, -0.10),
    new THREE.Vector2(2.46, -0.065),
    new THREE.Vector2(2.46, 0.065),
    new THREE.Vector2(2.41, 0.10),
    new THREE.Vector2(2.30, 0.10),
    new THREE.Vector2(2.26, 0.045),
    new THREE.Vector2(2.08, 0.045),
    new THREE.Vector2(2.04, 0.10),
    new THREE.Vector2(1.93, 0.10),
    new THREE.Vector2(1.88, 0.075),
    new THREE.Vector2(1.88, -0.075),
  ];
  const geo = new THREE.LatheGeometry(plateProfile, 96);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function buildPrismLatheGeometry(): THREE.LatheGeometry {
  const prismProfile = [
    new THREE.Vector2(2.68, 0.0),
    new THREE.Vector2(2.74, -0.095),
    new THREE.Vector2(2.86, -0.095),
    new THREE.Vector2(2.92, 0.0),
    new THREE.Vector2(2.86, 0.095),
    new THREE.Vector2(2.74, 0.095),
    new THREE.Vector2(2.68, 0.0),
  ];
  const geo = new THREE.LatheGeometry(prismProfile, 96);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function buildArcClampGeometry(): THREE.ExtrudeGeometry {
  const sweep = (40 * Math.PI) / 180;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 2.63, -sweep / 2, sweep / 2, false);
  shape.absarc(0, 0, 2.50, sweep / 2, -sweep / 2, true);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.022,
    bevelSize: 0.016,
    bevelSegments: 3,
    curveSegments: 24,
  });
  geo.translate(0, 0, -0.07);
  geo.computeVertexNormals();
  return geo;
}

export function ThreeSplashScreen({
  themeColor,
  isLightMode,
  durationMs = 5000,
  onComplete,
}: ThreeSplashScreenProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const skipRequestedAtRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [isExiting, setIsExiting] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [fallbackMode, setFallbackMode] = useState<'none' | 'reduced' | 'no-webgl'>('none');

  // Mutable Three.js handles for live theme & mode synchronization without re-creating WebGL context
  const liveRefs = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    studioEnvRT?: THREE.WebGLRenderTarget;
    bloomPass?: UnrealBloomPass;
    backdropMat?: THREE.ShaderMaterial;
    floorMat?: THREE.ShaderMaterial;
    shockwaveMat?: THREE.ShaderMaterial;
    flareMat?: THREE.ShaderMaterial;
    emberMat?: THREE.ShaderMaterial;
    letterFrontMats?: THREE.MeshPhysicalMaterial[];
    letterBevelMats?: THREE.MeshPhysicalMaterial[];
    subFrontMat?: THREE.MeshPhysicalMaterial;
    subBevelMat?: THREE.MeshPhysicalMaterial;
    plateMat?: THREE.MeshPhysicalMaterial;
    glassPrismMat?: THREE.MeshPhysicalMaterial;
    filamentMat?: THREE.MeshStandardMaterial;
    cardinalMat?: THREE.MeshStandardMaterial;
    dividerMat?: THREE.MeshStandardMaterial;
    clampMat?: THREE.MeshPhysicalMaterial;
    steelTickMat?: THREE.MeshStandardMaterial;
    leftRim?: THREE.PointLight;
    rightRim?: THREE.PointLight;
    ambient?: THREE.HemisphereLight;
    keyLight?: THREE.DirectionalLight;
    baseBevelEmissive?: number;
    baseBloom?: number;
  }>({});

  const triggerSkip = () => {
    if (completedRef.current) return;
    if (skipRequestedAtRef.current === null) {
      skipRequestedAtRef.current = performance.now();
    }
    setIsExiting(true);
    window.setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    }, 280);
  };

  // Sync live Settings theme changes into the running Three.js studio scene
  useEffect(() => {
    const refs = liveRefs.current;
    if (!refs.scene || !refs.renderer) return;

    const palette = getSplashPalette(themeColor);
    const nextEnvRT = createStudioEnvironment(refs.renderer, palette, isLightMode);
    if (refs.studioEnvRT) {
      refs.studioEnvRT.dispose();
    }
    refs.studioEnvRT = nextEnvRT;
    refs.scene.environment = nextEnvRT.texture;
    refs.scene.background = new THREE.Color(isLightMode ? '#b9c8dc' : '#020408');
    refs.renderer.toneMappingExposure = isLightMode ? 0.96 : 1.08;

    if (refs.bloomPass) {
      const nextBloom = isLightMode ? 0.14 : 0.42;
      refs.baseBloom = nextBloom;
      refs.bloomPass.strength = nextBloom;
      refs.bloomPass.threshold = isLightMode ? 1.25 : 0.78;
    }

    if (refs.backdropMat) {
      refs.backdropMat.uniforms.uAccent.value.set(palette.c500);
      refs.backdropMat.uniforms.uGlow.value.set(palette.c300);
      refs.backdropMat.uniforms.uBgCore.value.set(isLightMode ? '#dde6f2' : '#060a12');
      refs.backdropMat.uniforms.uBgEdge.value.set(isLightMode ? '#b9c8dc' : '#010204');
      refs.backdropMat.uniforms.uLightMode.value = isLightMode ? 1 : 0;
    }

    if (refs.floorMat) {
      refs.floorMat.uniforms.uAccent.value.set(palette.c400);
      refs.floorMat.uniforms.uLightMode.value = isLightMode ? 1 : 0;
    }

    if (refs.shockwaveMat) {
      refs.shockwaveMat.uniforms.uAccent.value.set(palette.c400);
      refs.shockwaveMat.uniforms.uLightMode.value = isLightMode ? 1 : 0;
      refs.shockwaveMat.blending = isLightMode ? THREE.NormalBlending : THREE.AdditiveBlending;
      refs.shockwaveMat.needsUpdate = true;
    }

    if (refs.flareMat) {
      refs.flareMat.uniforms.uAccent.value.set(palette.c400);
      refs.flareMat.blending = isLightMode ? THREE.NormalBlending : THREE.AdditiveBlending;
      refs.flareMat.needsUpdate = true;
    }

    if (refs.emberMat) {
      refs.emberMat.uniforms.uAccent.value.set(isLightMode ? palette.c600 : palette.c400);
      refs.emberMat.uniforms.uCore.value.set(isLightMode ? palette.c700 : '#ffffff');
      refs.emberMat.uniforms.uLightMode.value = isLightMode ? 1 : 0;
      refs.emberMat.blending = isLightMode ? THREE.NormalBlending : THREE.AdditiveBlending;
      refs.emberMat.needsUpdate = true;
    }

    const baseEmissive = isLightMode ? 0.22 : 0.72;
    refs.baseBevelEmissive = baseEmissive;

    if (refs.letterFrontMats) {
      for (const mat of refs.letterFrontMats) {
        mat.color.set(isLightMode ? '#0f172a' : '#e2e8f0');
        mat.metalness = isLightMode ? 0.45 : 0.88;
        mat.roughness = isLightMode ? 0.28 : 0.2;
        mat.envMapIntensity = isLightMode ? 0.95 : 1.85;
      }
    }

    if (refs.letterBevelMats) {
      for (const mat of refs.letterBevelMats) {
        mat.color.set(isLightMode ? palette.c600 : palette.c400);
        mat.emissive.set(isLightMode ? palette.c600 : palette.c500);
        mat.emissiveIntensity = baseEmissive;
      }
    }

    if (refs.subFrontMat) {
      refs.subFrontMat.color.set(isLightMode ? '#0f172a' : '#f1f5f9');
      refs.subFrontMat.metalness = isLightMode ? 0.35 : 0.8;
      refs.subFrontMat.roughness = isLightMode ? 0.32 : 0.22;
      refs.subFrontMat.emissive.set(palette.c500);
      refs.subFrontMat.emissiveIntensity = isLightMode ? 0.04 : 0.14;
      refs.subFrontMat.envMapIntensity = isLightMode ? 0.9 : 1.7;
    }

    if (refs.subBevelMat) {
      refs.subBevelMat.color.set(isLightMode ? palette.c600 : palette.c400);
      refs.subBevelMat.emissive.set(palette.c500);
      refs.subBevelMat.emissiveIntensity = isLightMode ? 0.16 : 0.4;
    }

    if (refs.plateMat) {
      refs.plateMat.color.set(isLightMode ? '#334155' : '#1d2635');
      refs.plateMat.metalness = isLightMode ? 0.65 : 0.92;
      refs.plateMat.roughness = isLightMode ? 0.3 : 0.26;
      refs.plateMat.envMapIntensity = isLightMode ? 1.0 : 1.85;
    }

    if (refs.clampMat) {
      refs.clampMat.color.set(isLightMode ? '#1e293b' : '#0f172a');
      refs.clampMat.envMapIntensity = isLightMode ? 1.1 : 2.0;
    }

    if (refs.steelTickMat) {
      refs.steelTickMat.color.set(isLightMode ? '#cbd5e1' : '#94a3b8');
    }

    if (refs.glassPrismMat) {
      refs.glassPrismMat.color.set(isLightMode ? palette.c500 : palette.c300);
      refs.glassPrismMat.envMapIntensity = isLightMode ? 1.05 : 1.35;
      refs.glassPrismMat.opacity = isLightMode ? 0.52 : 0.42;
    }

    if (refs.filamentMat) {
      refs.filamentMat.color.set(isLightMode ? palette.c600 : palette.c300);
      refs.filamentMat.emissive.set(isLightMode ? palette.c500 : palette.c400);
      refs.filamentMat.emissiveIntensity = isLightMode ? 0.65 : 1.15;
    }

    if (refs.cardinalMat) {
      refs.cardinalMat.color.set(palette.c300);
      refs.cardinalMat.emissive.set(palette.c400);
      refs.cardinalMat.emissiveIntensity = isLightMode ? 0.9 : 1.65;
    }

    if (refs.dividerMat) {
      refs.dividerMat.color.set(isLightMode ? palette.c600 : palette.c300);
      refs.dividerMat.emissive.set(palette.c400);
      refs.dividerMat.emissiveIntensity = isLightMode ? 0.65 : 1.35;
    }

    if (refs.leftRim) {
      refs.leftRim.color.set(palette.c400);
      refs.leftRim.intensity = isLightMode ? 14 : 22;
    }
    if (refs.rightRim) {
      refs.rightRim.intensity = isLightMode ? 10 : 16;
    }
    if (refs.ambient) {
      refs.ambient.color.set(isLightMode ? '#ffffff' : '#dbeafe');
      refs.ambient.groundColor.set(isLightMode ? palette.c300 : palette.c950);
      refs.ambient.intensity = isLightMode ? 1.2 : 0.68;
    }
    if (refs.keyLight) {
      refs.keyLight.intensity = isLightMode ? 1.45 : 1.85;
    }
  }, [themeColor, isLightMode]);

  // Keyboard skip (Escape / Space / Enter)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        triggerSkip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Main Three.js studio setup & 5s 4-act animation loop
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setFallbackMode('reduced');
      const timer = window.setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
      }, 280);
      return () => window.clearTimeout(timer);
    }

    if (!hasWebGLSupport()) {
      setFallbackMode('no-webgl');
      const timer = window.setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
      }, 1500);
      return () => window.clearTimeout(timer);
    }

    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setFallbackMode('no-webgl');
      const timer = window.setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
      }, 1500);
      return () => window.clearTimeout(timer);
    }

    const palette = getSplashPalette(themeColor);
    const disposables: Array<{ dispose: () => void }> = [];

    const initW = container.clientWidth || window.innerWidth;
    const initH = container.clientHeight || window.innerHeight;
    const initAspect = initW / Math.max(initH, 1);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initW, initH);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isLightMode ? 0.96 : 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isLightMode ? '#b9c8dc' : '#020408');

    const studioEnvRT = createStudioEnvironment(renderer, palette, isLightMode);
    scene.environment = studioEnvRT.texture;

    const camera = new THREE.PerspectiveCamera(38, initAspect, 0.1, 100);
    const baseCameraZ = 10.6;

    // ── Studio Lighting ───────────────────────────────────────────────
    const ambient = new THREE.HemisphereLight(
      isLightMode ? '#ffffff' : '#dbeafe',
      isLightMode ? palette.c300 : palette.c950,
      isLightMode ? 1.2 : 0.68,
    );
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight('#ffffff', isLightMode ? 1.45 : 1.85);
    keyLight.position.set(3.0, 5.0, 7.0);
    scene.add(keyLight);

    const leftRim = new THREE.PointLight(palette.c400, isLightMode ? 14 : 22, 22, 1.4);
    leftRim.position.set(-5.2, 1.8, 3.4);
    scene.add(leftRim);

    const rightRim = new THREE.PointLight('#7dd3fc', isLightMode ? 10 : 16, 22, 1.4);
    rightRim.position.set(5.2, -1.6, 3.2);
    scene.add(rightRim);

    const sweepLight = new THREE.PointLight('#ffffff', 22, 14, 1.5);
    sweepLight.position.set(-7.5, 0.5, 3.8);
    scene.add(sweepLight);

    // ── Surface Maps ──────────────────────────────────────────────────
    const brushedTex = createBrushedMetalTexture();
    if (brushedTex) disposables.push(brushedTex);

    // ── Studio Backdrop & Reflective Floor ───────────────────────────
    const backdropGeo = new THREE.PlaneGeometry(42, 30);
    const backdropMat = createBackdropMaterial(palette, isLightMode);
    const backdropMesh = new THREE.Mesh(backdropGeo, backdropMat);
    backdropMesh.position.set(0, 0, -14);
    backdropMesh.renderOrder = -10;
    scene.add(backdropMesh);
    disposables.push(backdropGeo, backdropMat);

    const floorGeo = new THREE.PlaneGeometry(20, 14);
    const floorMat = createStageFloorMaterial(palette, isLightMode);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -2.55, -1.2);
    floorMesh.rotation.x = -Math.PI / 2;
    scene.add(floorMesh);
    disposables.push(floorGeo, floorMat);

    // ── Scaled Hero Root ──────────────────────────────────────────────
    const heroRoot = new THREE.Group();
    scene.add(heroRoot);

    // ── Calibrated Gyroscope & Liquid-Glass Prism Emblem ─────────────
    const emblemGroup = new THREE.Group();
    emblemGroup.position.set(0, 0.08, -1.05);
    heroRoot.add(emblemGroup);

    const plateGroup = new THREE.Group();
    emblemGroup.add(plateGroup);

    const plateGeo = buildPlateLatheGeometry();
    const plateMat = new THREE.MeshPhysicalMaterial({
      color: isLightMode ? '#334155' : '#1d2635',
      metalness: isLightMode ? 0.65 : 0.92,
      roughness: isLightMode ? 0.3 : 0.26,
      roughnessMap: brushedTex ?? undefined,
      bumpMap: brushedTex ?? undefined,
      bumpScale: 0.01,
      clearcoat: 0.55,
      clearcoatRoughness: 0.16,
      envMapIntensity: isLightMode ? 1.0 : 1.85,
    });
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateGroup.add(plateMesh);
    disposables.push(plateGeo, plateMat);

    // 24 Calibrated Radial Tick Markers (20 machined steel + 4 HDR cardinal)
    const tickGeo = new THREE.BoxGeometry(0.026, 0.105, 0.055);
    const steelTickMat = new THREE.MeshStandardMaterial({
      color: isLightMode ? '#e2e8f0' : '#94a3b8',
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 1.5,
    });
    const tickInstances = new THREE.InstancedMesh(tickGeo, steelTickMat, 20);
    const dummy = new THREE.Object3D();
    let tickIdx = 0;

    const cardinalGeo = new THREE.BoxGeometry(0.042, 0.16, 0.068);
    const cardinalMat = new THREE.MeshStandardMaterial({
      color: palette.c300,
      emissive: palette.c400,
      emissiveIntensity: isLightMode ? 0.9 : 1.65,
      metalness: 0.4,
      roughness: 0.2,
    });
    disposables.push(tickGeo, steelTickMat, cardinalGeo, cardinalMat);

    for (let i = 0; i < 24; i++) {
      const angle = (i * Math.PI * 2) / 24;
      const rx = Math.cos(angle) * 2.17;
      const ry = Math.sin(angle) * 2.17;
      if (i % 6 === 0) {
        const cardinal = new THREE.Mesh(cardinalGeo, cardinalMat);
        cardinal.position.set(rx, ry, 0.075);
        cardinal.rotation.z = angle - Math.PI / 2;
        plateGroup.add(cardinal);
      } else {
        dummy.position.set(rx, ry, 0.072);
        dummy.rotation.set(0, 0, angle - Math.PI / 2);
        dummy.updateMatrix();
        tickInstances.setMatrixAt(tickIdx++, dummy.matrix);
      }
    }
    tickInstances.instanceMatrix.needsUpdate = true;
    plateGroup.add(tickInstances);

    // Outer Refracting Liquid-Glass Prism Ring (HDR physical specular + iridescence, single-pass fast)
    const prismGeo = buildPrismLatheGeometry();
    const glassPrismMat = new THREE.MeshPhysicalMaterial({
      color: isLightMode ? palette.c500 : palette.c300,
      metalness: 0.12,
      roughness: 0.05,
      ior: 1.52,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      iridescence: 0.45,
      iridescenceIOR: 1.32,
      envMapIntensity: isLightMode ? 1.05 : 1.35,
      transparent: true,
      opacity: isLightMode ? 0.52 : 0.42,
    });
    const glassPrismRing = new THREE.Mesh(prismGeo, glassPrismMat);
    glassPrismRing.rotation.set(Math.PI * 0.14, Math.PI * 0.08, 0);
    emblemGroup.add(glassPrismRing);
    disposables.push(prismGeo, glassPrismMat);

    // Inner HDR Filament Accent Ring
    const filamentGeo = new THREE.TorusGeometry(1.66, 0.015, 16, 128);
    const filamentMat = new THREE.MeshStandardMaterial({
      color: isLightMode ? palette.c600 : palette.c300,
      emissive: isLightMode ? palette.c500 : palette.c400,
      emissiveIntensity: isLightMode ? 0.65 : 1.15,
      metalness: 0.35,
      roughness: 0.18,
    });
    const filamentRing = new THREE.Mesh(filamentGeo, filamentMat);
    filamentRing.position.z = -0.04;
    emblemGroup.add(filamentRing);
    disposables.push(filamentGeo, filamentMat);

    // 3 Sculpted Mirror-Anodized Arc Collar Clamps
    const clampGroup = new THREE.Group();
    emblemGroup.add(clampGroup);
    const clampGeo = buildArcClampGeometry();
    const clampMat = new THREE.MeshPhysicalMaterial({
      color: isLightMode ? '#1e293b' : '#0f172a',
      metalness: 0.95,
      roughness: 0.14,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      envMapIntensity: isLightMode ? 1.1 : 2.0,
    });
    disposables.push(clampGeo, clampMat);

    for (let i = 0; i < 3; i++) {
      const clamp = new THREE.Mesh(clampGeo, clampMat);
      clamp.rotation.z = (i * Math.PI * 2) / 3;
      clampGroup.add(clamp);
    }

    // ── Fonts & Per-Letter 3D Wordmark ("DRAGORIANO") ─────────────────
    const fontLoader = new FontLoader();
    const boldFont = fontLoader.parse(SPLASH_BOLD_FONT);
    const regularFont = fontLoader.parse(SPLASH_REGULAR_FONT);

    const baseBevelEmissive = isLightMode ? 0.22 : 0.72;
    const baseFrontMat = new THREE.MeshPhysicalMaterial({
      color: isLightMode ? '#0f172a' : '#e2e8f0',
      metalness: isLightMode ? 0.45 : 0.88,
      roughness: isLightMode ? 0.28 : 0.2,
      roughnessMap: brushedTex ?? undefined,
      bumpMap: brushedTex ?? undefined,
      bumpScale: 0.008,
      clearcoat: 0.72,
      clearcoatRoughness: 0.12,
      envMapIntensity: isLightMode ? 0.95 : 1.85,
      transparent: true,
      opacity: 0,
    });
    const baseBevelMat = new THREE.MeshPhysicalMaterial({
      color: isLightMode ? palette.c600 : palette.c400,
      metalness: 0.84,
      roughness: 0.18,
      emissive: palette.c500,
      emissiveIntensity: baseBevelEmissive,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.6,
      transparent: true,
      opacity: 0,
    });
    disposables.push(baseFrontMat, baseBevelMat);

    const lettersGroup = new THREE.Group();
    lettersGroup.position.set(0, 0.28, 0.25);
    heroRoot.add(lettersGroup);

    const wordmark = 'DRAGORIANO';
    const wordSize = 0.7;
    const wordTracking = 0.048;
    const boldRes = boldFont.data.resolution || 1000;
    const boldScale = wordSize / boldRes;

    const letterNodes: HeroLetterNode[] = [];
    const letterFrontMats: THREE.MeshPhysicalMaterial[] = [];
    const letterBevelMats: THREE.MeshPhysicalMaterial[] = [];

    let cursorX = 0;
    let minPlacedX = Infinity;
    let maxPlacedX = -Infinity;

    for (let i = 0; i < wordmark.length; i++) {
      const ch = wordmark[i];
      const glyph = boldFont.data.glyphs[ch];
      const geo = new TextGeometry(ch, {
        font: boldFont,
        size: wordSize,
        depth: 0.24,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.036,
        bevelSize: 0.019,
        bevelSegments: 5,
      });
      geo.computeBoundingBox();
      const box = geo.boundingBox!;
      const cx = (box.max.x + box.min.x) / 2;
      const cy = (box.max.y + box.min.y) / 2;
      const cz = (box.max.z + box.min.z) / 2;
      const halfW = (box.max.x - box.min.x) / 2;
      geo.translate(-cx, -cy, -cz);
      disposables.push(geo);

      const frontMat = baseFrontMat.clone();
      const bevelMat = baseBevelMat.clone();
      letterFrontMats.push(frontMat);
      letterBevelMats.push(bevelMat);
      disposables.push(frontMat, bevelMat);

      const mesh = new THREE.Mesh(geo, [frontMat, bevelMat]);
      const placedX = cursorX + cx;
      const baseY = cy - wordSize * 0.42;
      mesh.position.set(placedX, baseY, 0);
      lettersGroup.add(mesh);

      minPlacedX = Math.min(minPlacedX, placedX - halfW);
      maxPlacedX = Math.max(maxPlacedX, placedX + halfW);

      letterNodes.push({
        mesh,
        baseX: placedX,
        baseY,
        frontMat,
        bevelMat,
        distFromCenter: Math.abs(i - (wordmark.length - 1) / 2),
      });

      const ha = glyph?.ha ?? 700;
      cursorX += ha * boldScale + wordTracking;
    }

    const centerShift = -(minPlacedX + maxPlacedX) / 2;
    for (const node of letterNodes) {
      node.baseX += centerShift;
      node.mesh.position.x = node.baseX;
    }
    const measuredWordmarkWidth = Math.max(4.5, maxPlacedX - minPlacedX);

    // ── Precision Hairline Divider & Diamond End-Caps ────────────────
    const dividerGroup = new THREE.Group();
    dividerGroup.position.set(0, -0.22, 0.24);
    heroRoot.add(dividerGroup);

    const dividerLen = measuredWordmarkWidth * 0.62;
    const dividerGeo = new THREE.BoxGeometry(dividerLen, 0.022, 0.036);
    const diamondGeo = new THREE.OctahedronGeometry(0.034, 0);
    const dividerMat = new THREE.MeshStandardMaterial({
      color: isLightMode ? palette.c600 : palette.c300,
      emissive: palette.c400,
      emissiveIntensity: isLightMode ? 0.65 : 1.35,
      metalness: 0.72,
      roughness: 0.2,
      transparent: true,
      opacity: 0,
    });
    disposables.push(dividerGeo, diamondGeo, dividerMat);

    const dividerBar = new THREE.Mesh(dividerGeo, dividerMat);
    dividerGroup.add(dividerBar);

    const leftDiamond = new THREE.Mesh(diamondGeo, dividerMat);
    leftDiamond.position.set(-(dividerLen / 2 + 0.045), 0, 0);
    const rightDiamond = new THREE.Mesh(diamondGeo, dividerMat);
    rightDiamond.position.set(dividerLen / 2 + 0.045, 0, 0);
    dividerGroup.add(leftDiamond, rightDiamond);

    // ── Wide-Tracked 3D Subtitle ("WORKOUT TRACKER") ──────────────────
    const subGroup = new THREE.Group();
    subGroup.position.set(0, -0.56, 0.2);
    heroRoot.add(subGroup);

    const subFrontMat = new THREE.MeshPhysicalMaterial({
      color: isLightMode ? '#0f172a' : '#f1f5f9',
      metalness: isLightMode ? 0.35 : 0.8,
      roughness: isLightMode ? 0.32 : 0.22,
      roughnessMap: brushedTex ?? undefined,
      emissive: palette.c500,
      emissiveIntensity: isLightMode ? 0.04 : 0.14,
      clearcoat: 0.55,
      envMapIntensity: isLightMode ? 0.9 : 1.7,
      transparent: true,
      opacity: 0,
    });
    const subBevelMat = new THREE.MeshPhysicalMaterial({
      color: isLightMode ? palette.c600 : palette.c400,
      metalness: 0.72,
      roughness: 0.22,
      emissive: palette.c500,
      emissiveIntensity: isLightMode ? 0.16 : 0.4,
      transparent: true,
      opacity: 0,
    });
    disposables.push(subFrontMat, subBevelMat);

    const subtitleText = 'WORKOUT TRACKER';
    const subSize = 0.195;
    const subTracking = 0.058;
    const regRes = regularFont.data.resolution || 1000;
    const regScale = subSize / regRes;
    const subMeshes: THREE.Mesh[] = [];

    let subCursorX = 0;
    let subMinX = Infinity;
    let subMaxX = -Infinity;

    for (let i = 0; i < subtitleText.length; i++) {
      const ch = subtitleText[i];
      const glyph = regularFont.data.glyphs[ch];
      const ha = glyph?.ha ?? 375;

      if (ch === ' ') {
        subCursorX += ha * regScale + subTracking * 0.6;
        continue;
      }

      const geo = new TextGeometry(ch, {
        font: regularFont,
        size: subSize,
        depth: 0.065,
        curveSegments: 8,
        bevelEnabled: true,
        bevelThickness: 0.009,
        bevelSize: 0.005,
        bevelSegments: 3,
      });
      geo.computeBoundingBox();
      const box = geo.boundingBox!;
      const cx = (box.max.x + box.min.x) / 2;
      const cy = (box.max.y + box.min.y) / 2;
      const cz = (box.max.z + box.min.z) / 2;
      const halfW = (box.max.x - box.min.x) / 2;
      geo.translate(-cx, -cy, -cz);
      disposables.push(geo);

      const mesh = new THREE.Mesh(geo, [subFrontMat, subBevelMat]);
      const placedX = subCursorX + cx;
      mesh.position.set(placedX, cy - subSize * 0.45, 0);
      subGroup.add(mesh);
      subMeshes.push(mesh);

      subMinX = Math.min(subMinX, placedX - halfW);
      subMaxX = Math.max(subMaxX, placedX + halfW);
      subCursorX += ha * regScale + subTracking;
    }

    const subCenterShift = -(subMinX + subMaxX) / 2;
    for (const m of subMeshes) {
      m.position.x += subCenterShift;
    }

    // ── Optical Shockwave & Anamorphic Lens Flare ─────────────────────
    const shockwaveGeo = new THREE.PlaneGeometry(11.5, 11.5);
    const shockwaveMat = createShockwaveMaterial(palette, isLightMode);
    const shockwaveMesh = new THREE.Mesh(shockwaveGeo, shockwaveMat);
    shockwaveMesh.position.set(0, 0.08, -0.55);
    heroRoot.add(shockwaveMesh);
    disposables.push(shockwaveGeo, shockwaveMat);

    const flareGeo = new THREE.PlaneGeometry(11.5, 2.0);
    const flareMat = createAnamorphicFlareMaterial(palette, isLightMode);
    const flareMesh = new THREE.Mesh(flareGeo, flareMat);
    flareMesh.position.set(0, 0.24, -0.18);
    heroRoot.add(flareMesh);
    disposables.push(flareGeo, flareMat);

    // ── Atmospheric Ember & Bokeh Particle System ─────────────────────
    const emberSystem = createEmberSystem(palette, isLightMode);
    scene.add(emberSystem.points);
    disposables.push(emberSystem.geometry, emberSystem.material);

    // ── Post-Processing Composer (Bloom + ACES OutputPass) ───────────
    let composer: EffectComposer | null = null;
    let renderTarget: THREE.WebGLRenderTarget | null = null;
    let bloomPass: UnrealBloomPass | undefined;

    try {
      const isInitPortrait = initAspect < 0.85;
      const samples = renderer.capabilities.isWebGL2 ? (isInitPortrait ? 2 : 4) : 0;
      renderTarget = new THREE.WebGLRenderTarget(
        Math.max(1, Math.round(initW * renderer.getPixelRatio())),
        Math.max(1, Math.round(initH * renderer.getPixelRatio())),
        { type: THREE.HalfFloatType, samples },
      );
      composer = new EffectComposer(renderer, renderTarget);
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(initW, initH);

      const renderPass = new RenderPass(scene, camera);
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(initW, initH),
        isLightMode ? 0.14 : 0.42,
        0.52,
        isLightMode ? 1.25 : 0.78,
      );
      const outputPass = new OutputPass();

      composer.addPass(renderPass);
      composer.addPass(bloomPass);
      composer.addPass(outputPass);
    } catch {
      composer?.dispose();
      renderTarget?.dispose();
      composer = null;
      renderTarget = null;
      bloomPass = undefined;
    }

    liveRefs.current = {
      renderer,
      scene,
      studioEnvRT,
      bloomPass,
      backdropMat,
      floorMat,
      shockwaveMat,
      flareMat,
      emberMat: emberSystem.material,
      letterFrontMats,
      letterBevelMats,
      subFrontMat,
      subBevelMat,
      plateMat,
      glassPrismMat,
      filamentMat,
      cardinalMat,
      dividerMat,
      clampMat,
      steelTickMat,
      leftRim,
      rightRim,
      ambient,
      keyLight,
      baseBevelEmissive,
      baseBloom: isLightMode ? 0.14 : 0.42,
    };

    // ── Viewport-Aware Safe Responsive Framing ────────────────────────
    const updateSize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const framing = computeHeroFraming({
        width: w,
        height: h,
        fovDeg: 38,
        heroWidth: measuredWordmarkWidth * 1.04,
        heroHeight: 4.5,
        baseCameraZ,
      });

      camera.aspect = framing.aspect;
      camera.updateProjectionMatrix();

      heroRoot.scale.setScalar(framing.heroScale);
      emblemGroup.scale.setScalar(framing.emblemBoost);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h);
      emberSystem.material.uniforms.uPixelRatio.value = dpr;

      if (composer) {
        composer.setPixelRatio(dpr);
        composer.setSize(w, h);
      }
      if (bloomPass) {
        bloomPass.resolution.set(w, h);
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    window.addEventListener('resize', updateSize);

    // ── 4-Act 5-Second Cinema Animation Loop ──────────────────────────
    let startAt: number | null = null;
    let prevNow = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const isWarmupFrame = startAt === null;
      const elapsedMs = startAt === null ? 0 : Math.max(0, now - startAt);
      const dt = isWarmupFrame ? 0 : Math.min(0.05, Math.max(0, (now - prevNow) / 1000));
      prevNow = now;

      const tSec = elapsedMs / 1000;
      const progress = clamp01(elapsedMs / durationMs);
      setProgressPct(Math.round(progress * 100));

      // Shaders time progression
      backdropMat.uniforms.uTime.value = tSec;
      floorMat.uniforms.uTime.value = tSec;
      emberSystem.material.uniforms.uTime.value = tSec;
      shockwaveMat.uniforms.uTime.value = tSec;

      // ── Act I (0.00s -> 1.05s): Center-Outward Kinetic Assembly ───────
      const emblemIn = easeOutExpo(clamp01(tSec / 1.05));
      emblemGroup.rotation.x = (1 - emblemIn) * 0.48 + Math.sin(tSec * 0.65) * 0.04;
      emblemGroup.rotation.y = (1 - emblemIn) * -0.58 + Math.cos(tSec * 0.5) * 0.07;

      const exitPhase = clamp01((elapsedMs - (durationMs - 650)) / 650);
      const exitEase = easeInOutQuart(exitPhase);

      // Continuous balanced gyroscope rotation
      plateGroup.rotation.z += dt * (0.14 + exitEase * 0.25);
      glassPrismRing.rotation.z -= dt * (0.22 + exitEase * 0.4);
      glassPrismRing.rotation.y = Math.PI * 0.08 + Math.sin(tSec * 0.55) * 0.16;
      glassPrismRing.rotation.x = Math.PI * 0.14 + Math.cos(tSec * 0.48) * 0.1;
      clampGroup.rotation.z += dt * 0.3;
      clampGroup.rotation.x = Math.sin(tSec * 0.72) * 0.14;
      filamentRing.rotation.z -= dt * 0.42;

      const ringPortalScale = 1 + exitEase * 0.16;
      glassPrismRing.scale.setScalar(ringPortalScale);
      clampGroup.scale.setScalar(1 + exitEase * 0.1);

      // Per-letter symmetric center-outward wordmark assembly + glint sweep
      const sweep1 = easeInOutQuart(clamp01((tSec - 1.95) / 1.1));
      const sweep2 = easeInOutQuart(clamp01((tSec - 3.25) / 1.0));
      const sweepIdx = tSec < 3.1 ? -1.5 + sweep1 * 12.0 : -1.5 + sweep2 * 12.0;
      const activeSweep = (tSec >= 1.92 && tSec <= 3.1) || (tSec >= 3.22 && tSec <= 4.35);

      const bevelBase = liveRefs.current.baseBevelEmissive ?? baseBevelEmissive;

      for (let i = 0; i < letterNodes.length; i++) {
        const node = letterNodes[i];
        const delay = node.distFromCenter * 0.06;
        const p = clamp01((tSec - delay) / 0.62);
        const eased = easeOutBackSubtle(p);
        const alpha = smoothstep(0.0, 0.38, p);

        node.frontMat.opacity = alpha;
        node.bevelMat.opacity = alpha;

        node.mesh.position.z = (1 - eased) * -2.1;
        node.mesh.position.y = node.baseY + (1 - eased) * 0.34 + Math.sin(tSec * 1.45 + i * 0.35) * 0.016;
        node.mesh.rotation.x = (1 - eased) * 0.42;
        const sideSign = i < 4.5 ? -1 : 1;
        node.mesh.rotation.y = (1 - eased) * sideSign * 0.48;

        // Traveling studio metallic bevel glint pulse across D -> O
        let glintBoost = 0;
        if (activeSweep) {
          const distToSweep = Math.abs(i - sweepIdx);
          glintBoost = Math.exp(-distToSweep * distToSweep * 0.65) * 0.65;
        }
        node.bevelMat.emissiveIntensity = bevelBase + glintBoost;
      }

      // ── Act II (1.02s -> 1.88s): Forge Lock-In, Optical Shockwave & Subtitle ─
      const impactEnvelope =
        tSec >= 1.0 && tSec <= 2.35
          ? Math.sin(clamp01((tSec - 1.0) / 0.25) * Math.PI * 0.5) *
            (1 - smoothstep(1.12, 2.35, tSec))
          : 0;

      // Optical shockwave ripple
      if (tSec >= 1.02 && tSec <= 2.28) {
        const sw = clamp01((tSec - 1.02) / 1.26);
        shockwaveMat.uniforms.uProgress.value = easeOutCubic(sw);
        shockwaveMat.uniforms.uOpacity.value = (1 - sw) * smoothstep(0.0, 0.08, sw) * 0.92;
      } else {
        shockwaveMat.uniforms.uOpacity.value = 0;
      }

      // Anamorphic horizontal light blade
      if (tSec >= 1.0 && tSec <= 2.2) {
        const fl = clamp01((tSec - 1.0) / 1.2);
        const rise = smoothstep(0.0, 0.14, fl);
        const fall = 1 - easeOutCubic(clamp01((fl - 0.14) / 0.86));
        flareMat.uniforms.uIntensity.value = rise * fall * 0.95;
        flareMat.uniforms.uSpread.value = 0.35 + easeOutExpo(fl) * 1.15;
      } else {
        flareMat.uniforms.uIntensity.value = 0;
      }

      backdropMat.uniforms.uFlash.value = impactEnvelope * 0.85;
      floorMat.uniforms.uPulse.value = impactEnvelope;
      emberSystem.material.uniforms.uImpact.value = impactEnvelope * 0.85;

      // Weighted single damped Z-punch on lock-in
      let punchZ = 0;
      if (tSec >= 1.02 && tSec <= 1.38) {
        const kp = (tSec - 1.02) / 0.36;
        punchZ = Math.sin(kp * Math.PI) * (1 - kp) * -0.18;
      }
      heroRoot.position.z = punchZ;

      // Precision hairline divider draw from center (1.12s -> 1.65s)
      const divEase = easeOutExpo(clamp01((tSec - 1.12) / 0.53));
      dividerMat.opacity = smoothstep(0.0, 0.25, divEase) * 0.92;
      dividerBar.scale.x = Math.max(0.001, divEase);
      leftDiamond.position.x = -(dividerLen * divEase * 0.5 + 0.045);
      rightDiamond.position.x = dividerLen * divEase * 0.5 + 0.045;
      leftDiamond.scale.setScalar(divEase);
      rightDiamond.scale.setScalar(divEase);

      // Subtitle reveal (1.22s -> 1.88s)
      const subEase = easeOutCubic(clamp01((tSec - 1.22) / 0.66));
      subFrontMat.opacity = subEase;
      subBevelMat.opacity = subEase;
      subGroup.position.y = -0.56 - (1 - subEase) * 0.24;
      subGroup.position.z = 0.2 - (1 - subEase) * 0.55;
      subGroup.rotation.x = (1 - subEase) * -0.35;

      // ── Act III (1.85s -> 4.35s) & Act IV (4.35s -> 5.00s): Camera Arc & Exit ─
      const camSweepX = tSec < 3.1 ? -7.5 + sweep1 * 15.0 : -7.5 + sweep2 * 15.0;
      sweepLight.position.x = camSweepX;
      sweepLight.position.y = 0.45 + Math.sin(tSec * 1.3) * 0.32;

      const craneIn = easeOutExpo(clamp01(tSec / 1.15));
      const orbitBlend = smoothstep(0.95, 2.0, tSec);

      camera.position.x =
        (1 - craneIn) * -0.9 + orbitBlend * Math.sin(tSec * 0.58) * 0.55;
      camera.position.y =
        (1 - craneIn) * -0.28 + craneIn * 0.04 + orbitBlend * Math.cos(tSec * 0.48) * 0.16;
      camera.position.z =
        baseCameraZ + (1 - craneIn) * 1.5 - tSec * 0.075 - exitEase * 1.55;
      camera.lookAt(0, 0.02, 0);

      if (bloomPass) {
        const baseBloom = liveRefs.current.baseBloom ?? (isLightMode ? 0.2 : 0.44);
        bloomPass.strength = baseBloom + impactEnvelope * 0.14 + exitEase * 0.12;
      }

      if (elapsedMs >= durationMs - 420 && !completedRef.current) {
        setIsExiting(true);
      }

      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      if (isWarmupFrame) {
        startAt = performance.now();
        prevNow = startAt;
      }

      if (elapsedMs >= durationMs) {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
      for (const d of disposables) {
        d.dispose();
      }
      liveRefs.current.studioEnvRT?.dispose();
      if (!liveRefs.current.studioEnvRT) {
        studioEnvRT.dispose();
      }
      composer?.dispose();
      renderTarget?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      liveRefs.current = {};
    };
  }, [durationMs]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="DRAGORIANO Workout Tracker splash screen. Tap anywhere to skip."
      onClick={triggerSkip}
      className={`fixed inset-0 z-[100] select-none overflow-hidden transition-opacity duration-300 cursor-pointer ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {fallbackMode === 'none' ? (
        <div ref={mountRef} className="h-full w-full" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-page/90 px-6 text-center backdrop-blur-2xl">
          <h1 className="text-3xl font-black uppercase tracking-[0.26em] text-primary-400">
            DRAGORIANO
          </h1>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.38em] text-muted">
            Workout Tracker
          </p>
        </div>
      )}

      {/* Tap-anywhere Liquid Glass skip cue & 5s progress bar */}
      <div className="pointer-events-none fixed bottom-8 left-1/2 flex w-[calc(100%-3rem)] max-w-[320px] -translate-x-1/2 flex-col items-center gap-2.5 pb-safe">
        <div className="liquid-glass-strong rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-content/90">
          Tap anywhere to skip
        </div>
        <div
          role="progressbar"
          aria-label="Splash screen progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct}
          className="h-[3px] w-40 overflow-hidden rounded-full bg-content/15 backdrop-blur-sm"
        >
          <div
            className="h-full rounded-full bg-primary-400 transition-[width] duration-75 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
