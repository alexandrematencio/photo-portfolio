import { ScrollPhysicsGallery } from '@/components/gallery/ScrollPhysicsGallery';
import { HomeHero } from '@/components/site/HomeHero';
import { getHomepagePhotos, getSiteSettings } from '@/lib/sanity/queries';
import { resolveMotion } from '@/lib/motion/presets';
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

  return (
    <>
      <HomeHero />

      <ScrollPhysicsGallery photos={photos} motion={motion} />
    </>
  );
}
