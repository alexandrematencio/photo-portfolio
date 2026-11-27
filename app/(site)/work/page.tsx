import { PageShell } from '@/components/site/PageShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { CarouselScene } from '@/components/work/CarouselScene';
import { getSeriesWithPhotos } from '@/lib/sanity/queries';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbJsonLd, imageGalleryJsonLd, pageUrl } from '@/lib/seo/jsonld';
import { splitSeriesAndWork } from '@/lib/site/series';
import { MICRO_LABEL } from '@/lib/site/typography';

/**
 * /work — l'étage entre /series (des récits) et /archives (le fonds complet) :
 * des collections par genre, une par onglet. Contenu : `workPage.collections`
 * (Studio, rubrique « Pages »), cf. `sanity/schemas/pages.ts`.
 */
export const metadata = buildMetadata({
  title: 'Work',
  description:
    'Selected photographs by Alexandre Matencio, sorted by genre: street photography, portraits, architecture and shapes, quiet realism.',
  path: '/work',
});

export const revalidate = 60;

export default async function WorkPage() {
  const { items, seriesOrderRefs, workRefs } = await getSeriesWithPhotos();
  const { work } = splitSeriesAndWork(items, seriesOrderRefs, workRefs);
  const total = work.reduce((n, c) => n + c.photos.length, 0);

  const jsonLd = [
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Work', path: '/work' },
    ]),
    ...work.map((c) =>
      imageGalleryJsonLd({
        name: c.title,
        path: `/series/${c.slug}`,
        id: `${pageUrl('/work')}#work-${c.slug}`,
        description: c.subtitle,
        photos: c.photos,
      })
    ),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageShell
        bleed
        title="WORK"
        subtitle={
          <p className={`${MICRO_LABEL} text-[var(--color-fg-muted)]`}>
            {work.length} collection{work.length === 1 ? '' : 's'} · {total} photo
            {total === 1 ? '' : 's'} · sorted by genre
          </p>
        }
      >
        {work.length > 0 ? (
          work.map((c, i) => <CarouselScene key={c._id} collection={c} index={i} />)
        ) : (
          <p className="py-32 text-center text-sm text-[var(--color-fg-muted)]">
            No collections yet.
          </p>
        )}
      </PageShell>
    </>
  );
}
