import { FlatGallery } from '@/components/gallery/FlatGallery';
import { getAllPhotos } from '@/lib/sanity/queries';
import { buildMetadata } from '@/lib/seo/metadata';
import { MICRO_LABEL, PAGE_TITLE } from '@/lib/site/typography';

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
    <div className="flex flex-col gap-10 md:gap-14">
      {/* Header — stays inside the editorial 1107 column for typographic coherence */}
      <header
        className="max-w-[1107px] flex flex-col gap-3"
        style={{ paddingLeft: 32, paddingRight: 32 }}
      >
        <h1 className={PAGE_TITLE}>
          ARCHIVES
        </h1>
        <p className={`${MICRO_LABEL} text-[var(--color-fg-muted)]`}>
          {photos.length} photo{photos.length === 1 ? '' : 's'} · grouped by year, location, style, camera or lens
        </p>
      </header>

      {/* Gallery — full-bleed (only 32 px edge gutters), photos breathe */}
      <FlatGallery photos={photos} />
    </div>
  );
}
