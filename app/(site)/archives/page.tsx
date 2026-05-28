import { FlatGallery } from '@/components/gallery/FlatGallery';
import { getAllPhotos } from '@/lib/sanity/queries';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Archives',
  description:
    'Full catalogue: every photograph grouped by year, location or type.',
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
        <h1 className="text-[48px] md:text-[64px] font-black uppercase tracking-[-0.04em] leading-none text-[var(--color-fg)]">
          ARCHIVES
        </h1>
        <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-[var(--color-fg-muted)]">
          {photos.length} photo{photos.length === 1 ? '' : 's'} · grouped by year, location or type
        </p>
      </header>

      {/* Gallery — full-bleed (only 32 px edge gutters), photos breathe */}
      <FlatGallery photos={photos} />
    </div>
  );
}
