import { THEME_COLORS } from '../../utils/theme';

export interface SplashPalette {
  c200: string;
  c300: string;
  c400: string;
  c500: string;
  c600: string;
  c700: string;
  c900: string;
  c950: string;
}

export function getSplashPalette(themeColor: string): SplashPalette {
  const palette = THEME_COLORS[themeColor] ?? THEME_COLORS.emerald;
  return {
    c200: palette[200],
    c300: palette[300],
    c400: palette[400],
    c500: palette[500],
    c600: palette[600],
    c700: palette[700],
    c900: palette[900],
    c950: palette[950],
  };
}

export interface HeroFramingParams {
  width: number;
  height: number;
  fovDeg: number;
  heroWidth: number;
  heroHeight: number;
  baseCameraZ: number;
  minCameraZDelta?: number;
  maxFrontZ?: number;
  portraitFillX?: number;
  landscapeFillX?: number;
  maxFillY?: number;
}

export interface HeroFramingResult {
  heroScale: number;
  emblemBoost: number;
  visibleWidth: number;
  visibleHeight: number;
  aspect: number;
  isPortrait: boolean;
}

/**
 * Computes uniform scale and gyroscope emblem proportions so the hero wordmark
 * fits within safe margins across narrow portrait phones and widescreen desktops.
 */
export function computeHeroFraming({
  width,
  height,
  fovDeg,
  heroWidth,
  heroHeight,
  baseCameraZ,
  minCameraZDelta = 0.55,
  maxFrontZ = 0.72,
  portraitFillX = 0.82,
  landscapeFillX = 0.64,
  maxFillY = 0.48,
}: HeroFramingParams): HeroFramingResult {
  const safeW = Math.max(width, 1);
  const safeH = Math.max(height, 1);
  const aspect = safeW / safeH;

  const frontDist = Math.max(2.0, baseCameraZ - minCameraZDelta - maxFrontZ);
  const visibleHeight = 2 * Math.tan((fovDeg * Math.PI) / 360) * frontDist;
  const visibleWidth = visibleHeight * aspect;
  const isPortrait = aspect < 0.85;

  const targetFillX = isPortrait ? portraitFillX : landscapeFillX;
  const scaleX = (visibleWidth * targetFillX) / Math.max(heroWidth, 0.01);
  const scaleY = (visibleHeight * maxFillY) / Math.max(heroHeight, 0.01);
  const heroScale = Math.min(1.05, scaleX, scaleY);
  const emblemBoost = isPortrait ? 1.18 : 1.0;

  return {
    heroScale,
    emblemBoost,
    visibleWidth,
    visibleHeight,
    aspect,
    isPortrait,
  };
}

export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

export function easeOutExpo(t: number): number {
  const x = clamp01(t);
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

export function easeOutBackSubtle(t: number): number {
  const x = clamp01(t);
  const c1 = 0.85;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function easeInOutQuart(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
}
