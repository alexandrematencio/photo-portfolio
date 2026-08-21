import { SeriesExperience } from '@/components/series/SeriesExperience';
import { getSeriesWithPhotos } from '@/lib/sanity/queries';
import { prepareSeries } from '@/lib/site/series';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Series',
  description:
    'Curated photographic series by A. Matencio — each one a folder to open and wander through.',
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

  return <SeriesExperience series={series} />;
}
