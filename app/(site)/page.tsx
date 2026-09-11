import { ScrollPhysicsGallery } from '@/components/gallery/ScrollPhysicsGallery';
import { HomeHero } from '@/components/site/HomeHero';
import { SplashScreen } from '@/components/site/SplashScreen';
import { JsonLd } from '@/components/seo/JsonLd';
import { getHomepagePhotos, getSiteSettings } from '@/lib/sanity/queries';
import { resolveMotion } from '@/lib/motion/presets';
import { resolveHeroImages } from '@/lib/site/hero';
import { buildMetadata } from '@/lib/seo/metadata';
import { webSiteJsonLd, imageGalleryJsonLd } from '@/lib/seo/jsonld';

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
      {/* La curation de la home est un sous-ensemble de /archives ; les
          ImageObjects portent le même @id (#photo-<slug>) dans les deux galeries
          pour que Google les reconnaisse comme la même entité. */}
      <JsonLd
        data={[
          webSiteJsonLd(),
          imageGalleryJsonLd({
            name: 'Selected Works',
            path: '/',
            description: 'Curated selection of photographs by A. Matencio.',
            photos,
          }),
        ]}
      />
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

      {/* H1 de la home. Invisible parce que le titre VISUEL de la page est le
          glyph ALXMTNC du hero : sans lui, le document commençait au H2
          « Selected Works » — hiérarchie amputée (CLAUDE.md §5.4). */}
      <h1 className="sr-only">A. Matencio — street, landscape and portrait photography</h1>

      <HomeHero hero={hero} />

      <ScrollPhysicsGallery photos={photos} motion={motion} />
    </>
  );
}
