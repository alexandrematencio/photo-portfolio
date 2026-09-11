import { FlatGallery } from '@/components/gallery/FlatGallery';
import { getAllPhotos } from '@/lib/sanity/queries';
import { buildMetadata } from '@/lib/seo/metadata';
import { MICRO_LABEL } from '@/lib/site/typography';
import { PageShell } from '@/components/site/PageShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, imageGalleryJsonLd } from '@/lib/seo/jsonld';

export const metadata = buildMetadata({
  title: 'Archives',
  description:
    'Full catalogue: every photograph grouped by year, location, style, camera or lens.',
  path: '/archives',
});

export const revalidate = 60;

export default async function ArchivesPage() {
  const photos = await getAllPhotos();
  const jsonLd = [
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Archives', path: '/archives' },
    ]),
    // TOUTES les photos visibles : c'est la page-catalogue, donc l'URL stable
    // de chaque ImageObject (ancre #photo-<slug>) vit ici.
    imageGalleryJsonLd({
      name: 'Archives — A. Matencio',
      path: '/archives',
      description:
        'Full catalogue: every photograph grouped by year, location, style, camera or lens.',
      photos,
    }),
  ];
  return (
    <>
      <JsonLd data={jsonLd} />
      {/* `bleed` : la console et la grille vont d'un bord à l'autre et portent
          // leurs propres gouttières ; le cadre passe donc sur le seul bloc de
          // titre, qui garde la mesure éditoriale — même corps et même gouttière
          // que les six autres pages, sans que la grille s'y trouve enfermée.
      */}
      <PageShell
      bleed
      // La page s'ouvre sur sa console, pas sur du texte : l'écart sous le
      // titre est celui d'une bande de commandes (48), et `FlatGallery` pose
      // le même en dessous d'elle. Cf. `PAGE_CONTROLS_GAP`.
      controlBand
      title="ARCHIVES"
      subtitle={
        <p className={`${MICRO_LABEL} text-[var(--color-fg-muted)]`}>
          {photos.length} photo{photos.length === 1 ? '' : 's'} · grouped by
          year, location, style, camera or lens
        </p>
      }
    >
      <FlatGallery photos={photos} />
      </PageShell>
    </>
  );
}
