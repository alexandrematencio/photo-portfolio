import { FlatGallery } from '@/components/gallery/FlatGallery';
import { getAllPhotos } from '@/lib/sanity/queries';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Flat Gallery',
  description:
    'Full catalogue: every photograph grouped by year, location or type.',
  path: '/flat-gallery',
});

export const revalidate = 60;

export default async function FlatGalleryPage() {
  const photos = await getAllPhotos();
  return (
    <section>
      <header className="px-4 md:px-8 py-8">
        <h1 className="font-black uppercase text-4xl md:text-6xl tracking-tight leading-none">
          Flat Gallery
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.3em] text-[var(--color-fg-muted)]">
          {photos.length} photo{photos.length === 1 ? '' : 's'} · grouped by year, location or type
        </p>
      </header>
      <FlatGallery photos={photos} />
    </section>
  );
}
