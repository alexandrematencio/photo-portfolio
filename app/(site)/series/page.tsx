import { SeriesExperience } from '@/components/series/SeriesExperience';
import { getSeriesWithPhotos } from '@/lib/sanity/queries';
import { prepareSeries } from '@/lib/site/series';
import { buildMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, imageGalleryJsonLd, pageUrl } from '@/lib/seo/jsonld';

export const metadata = buildMetadata({
  title: 'Series',
  description:
    'Photographic series by Alexandre Matencio — Les Olympiades, Peredelkino, Djerba, Moscow, Rando Topo and more. Each one a folder to open and wander through.',
  path: '/series',
});

export const revalidate = 60;

export default async function SeriesPage() {
  const { items, seriesOrderRefs } = await getSeriesWithPhotos();
  const series = prepareSeries(items, seriesOrderRefs);

  if (series.length === 0) {
    return (
      <div className="py-32 text-center text-[var(--color-fg-muted)] text-sm">
        No series yet. Compose some from{' '}
        <a href="/studio" className="underline">
          /studio
        </a>
        .
      </div>
    );
  }

  const jsonLd = [
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Series', path: '/series' },
    ]),
    // Une galerie par série. L'URL de /series n'ouvre aucune série (invariant
    // 16) : l'@id garde son ancre, mais l'`url` est désormais la page
    // indexable de la série (/series/[slug]).
    ...series.map((s) =>
      imageGalleryJsonLd({
        name: s.title,
        path: `/series/${s.slug}`,
        id: `${pageUrl('/series')}#series-${s.slug}`,
        description: s.subtitle,
        photos: s.photos,
      })
    ),
  ];
  return (
    <>
      <JsonLd data={jsonLd} />
      <SeriesExperience series={series} />
    </>
  );
}
