import { ScrollPhysicsGallery } from '@/components/gallery/ScrollPhysicsGallery';
import { HomeHeroSplash } from '@/components/site/HomeHeroSplash';
import { SplashScreen } from '@/components/site/SplashScreen';
import { getHomepagePhotos, getSiteSettings } from '@/lib/sanity/queries';
import { resolveMotion } from '@/lib/motion/presets';
import { resolveHeroImages } from '@/lib/site/hero';

/**
 * /splash-test — sandbox route mirroring the homepage so we can prototype
 * the entrance splash without touching `/`.
 *
 * ROLLBACK (in a single prompt):
 *   1) delete `app/(site)/splash-test/` (this folder)
 *   2) delete `components/site/SplashScreen.tsx`
 *   3) delete `components/site/HomeHeroSplash.tsx`
 *   4) revert the one-line branch in `components/site/SiteHeader.tsx` that
 *      adds `pathname === '/splash-test'` to the `hideHeader` check.
 *
 * Nothing else on the site is touched. The real `/` keeps using HomeHero and
 * is fully unaffected.
 */

export const metadata = {
  title: 'Splash test — ALXMTNC',
  robots: { index: false, follow: false },
};

export const revalidate = 60;

export default async function SplashTestPage() {
  const [photos, settings] = await Promise.all([
    getHomepagePhotos(),
    getSiteSettings(),
  ]);
  const motion = resolveMotion(settings?.motion);
  const hero = resolveHeroImages(settings?.hero);

  return (
    <>
      {/* `verticalMobile` est un opt-in sandbox : sur < md, stack ALX / slot /
          MTNC à la verticale avec une typo plus grosse. La home `/` continue
          d'utiliser le layout horizontal (default). À fusionner sur `/` quand
          le rendu mobile est validé. */}
      <SplashScreen verticalMobile />
      <HomeHeroSplash hero={hero} />
      <ScrollPhysicsGallery photos={photos} motion={motion} />
    </>
  );
}
