import { ScrollPhysicsGallery } from '@/components/gallery/ScrollPhysicsGallery';
import { HomeHero } from '@/components/site/HomeHero';
import { SplashScreen } from '@/components/site/SplashScreen';
import { getHomepagePhotos, getSiteSettings } from '@/lib/sanity/queries';
import { resolveMotion } from '@/lib/motion/presets';
import { resolveHeroImages } from '@/lib/site/hero';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Portfolio',
  description:
    "Immersive portfolio of A. Matencio — street, landscape and portrait photography.",
  path: '/',
});

export const revalidate = 60;

export default async function HomePage() {
  const [photos, settings] = await Promise.all([
    getHomepagePhotos(),
    getSiteSettings(),
  ]);
  const motion = resolveMotion(settings?.motion);
  const hero = resolveHeroImages(settings?.hero);

  return (
    <>
      {/* SplashScreen — overlay z-9999 qui joue l'animation d'intro ALXMTNC
          puis dispatch SPLASH_REVEAL_EVENT pour déclencher l'entrance du
          HomeHero (photo unfurl + nav items "pondus" + arrow). Le hero
          rend déjà toute sa structure DOM (photo/nav/arrow à opacity:0) :
          le splash flotte par-dessus pendant qu'il joue, puis fade out.
          Honore prefers-reduced-motion (skip direct + reveal:skip pour que
          le hero affiche tout immédiatement).
          `verticalMobile`: sur < md, stack ALX / slot / MTNC à la verticale,
          left-aligned dans un bloc centré. Typo agrandie et slot à hauteur
          line-box pour matcher l'extent vertical des lettres. Desktop
          inchangé. */}
      <SplashScreen verticalMobile />

      <HomeHero hero={hero} />

      <ScrollPhysicsGallery photos={photos} motion={motion} />
    </>
  );
}
