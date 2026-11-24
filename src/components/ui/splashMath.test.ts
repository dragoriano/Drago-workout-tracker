import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeHeroFraming, getSplashPalette } from './splashMath';
import { SELECTABLE_THEME_COLORS } from '../../utils/theme';

const VIEWPORTS: Array<{ name: string; width: number; height: number; portrait: boolean }> = [
  { name: 'SE Portrait 320x568', width: 320, height: 568, portrait: true },
  { name: 'Android Tall 360x800', width: 360, height: 800, portrait: true },
  { name: 'Mobile Classic 375x667', width: 375, height: 667, portrait: true },
  { name: 'iPhone 14 390x844', width: 390, height: 844, portrait: true },
  { name: 'Pixel 7 412x915', width: 412, height: 915, portrait: true },
  { name: 'iPhone Pro Max 430x932', width: 430, height: 932, portrait: true },
  { name: 'Tablet 768x1024', width: 768, height: 1024, portrait: true },
  { name: 'Laptop 1280x800', width: 1280, height: 800, portrait: false },
  { name: 'Desktop 1920x1080', width: 1920, height: 1080, portrait: false },
];

describe('computeHeroFraming', () => {
  const heroWidth = 7.35;
  const heroHeight = 4.2;
  const fovDeg = 38;
  const baseCameraZ = 10.6;

  for (const vp of VIEWPORTS) {
    it(`frames hero within safe horizontal and vertical bounds on ${vp.name}`, () => {
      const framing = computeHeroFraming({
        width: vp.width,
        height: vp.height,
        fovDeg,
        heroWidth,
        heroHeight,
        baseCameraZ,
      });

      assert.equal(framing.isPortrait, vp.portrait);
      assert.ok(framing.heroScale > 0.25, `heroScale (${framing.heroScale}) should be > 0.25`);
      assert.ok(
        heroWidth * framing.heroScale <= framing.visibleWidth * 0.84 + 1e-6,
        `wordmark width exceeds safe horizontal margin on ${vp.name}`,
      );
      assert.ok(
        heroHeight * framing.heroScale <= framing.visibleHeight * 0.50 + 1e-6,
        `hero height exceeds vertical bound on ${vp.name}`,
      );
    });
  }
});

describe('getSplashPalette', () => {
  it('returns distinct valid hex palettes for all 6 selectable themes', () => {
    const seenPrimary = new Set<string>();
    const hexRe = /^#[0-9a-f]{6}$/i;

    for (const color of SELECTABLE_THEME_COLORS) {
      const palette = getSplashPalette(color);
      for (const value of Object.values(palette)) {
        assert.match(value, hexRe);
      }
      seenPrimary.add(palette.c500);
    }

    assert.equal(seenPrimary.size, SELECTABLE_THEME_COLORS.length);
  });

  it('falls back cleanly to emerald on unknown theme colors', () => {
    assert.deepEqual(getSplashPalette('unknown-theme'), getSplashPalette('emerald'));
  });
});
