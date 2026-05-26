import type { MotionSettings } from '@/lib/sanity/queries';

/**
 * Bornes "adoucies" par défaut — conformes au mantra CLAUDE.md §3
 * « le motion design est un majordome, pas un acteur ».
 * Exposées dans Sanity siteSettings.motion pour tweaker sans redéployer.
 */
export const DEFAULT_MOTION: MotionSettings = {
  scaleMin: 0.94,
  skewMax: 5,
  rotXMax: 15,
  velocityDivisorScale: 20000,
  velocityDivisorSkew: -400,
  velocityDivisorRotX: -80,
};

export function resolveMotion(input?: Partial<MotionSettings> | null): MotionSettings {
  return {
    scaleMin: input?.scaleMin ?? DEFAULT_MOTION.scaleMin,
    skewMax: input?.skewMax ?? DEFAULT_MOTION.skewMax,
    rotXMax: input?.rotXMax ?? DEFAULT_MOTION.rotXMax,
    velocityDivisorScale:
      input?.velocityDivisorScale ?? DEFAULT_MOTION.velocityDivisorScale,
    velocityDivisorSkew:
      input?.velocityDivisorSkew ?? DEFAULT_MOTION.velocityDivisorSkew,
    velocityDivisorRotX:
      input?.velocityDivisorRotX ?? DEFAULT_MOTION.velocityDivisorRotX,
  };
}
