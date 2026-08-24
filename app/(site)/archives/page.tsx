import { FlatGallery } from '@/components/gallery/FlatGallery';
import { getAllPhotos } from '@/lib/sanity/queries';
import { buildMetadata } from '@/lib/seo/metadata';
import { MICRO_LABEL } from '@/lib/site/typography';
import { PageShell } from '@/components/site/PageShell';

export const metadata = buildMetadata({
  title: 'Archives',
  description:
    'Full catalogue: every photograph grouped by year, location, style, camera or lens.',
  path: '/archives',
});

export const revalidate = 60;

export default async function ArchivesPage() {
  const photos = await getAllPhotos();
  return (
    // `bleed` : la console et la grille vont d'un bord à l'autre et portent
    // leurs propres gouttières ; le cadre passe donc sur le seul bloc de
    // titre, qui garde la mesure éditoriale — même corps et même gouttière
    // que les six autres pages, sans que la grille s'y trouve enfermée.
    <PageShell
      bleed
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
  );
}
