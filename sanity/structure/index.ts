import type {
  StructureBuilder,
  StructureResolverContext,
} from 'sanity/structure';

const PHOTO_CATEGORIES: { value: string; label: string }[] = [
  { value: 'landscape', label: 'Paysage' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'streetphotography', label: 'Photo de rue' },
];

function siteSettingsNode(S: StructureBuilder) {
  return S.listItem()
    .title('Réglages du site')
    .id('siteSettings')
    .child(
      S.document().schemaType('siteSettings').documentId('siteSettings')
    );
}

function photosBySeriesNode(S: StructureBuilder) {
  return S.listItem()
    .title('Par série')
    .id('photos-by-series')
    .child(
      S.documentTypeList('series')
        .title('Choisis une série')
        .child((seriesId) =>
          S.documentList()
            .title('Photos de cette série')
            .filter('_type == "photo" && references($id)')
            .params({ id: seriesId })
        )
    );
}

function photosWithoutSeriesNode(S: StructureBuilder) {
  return S.listItem()
    .title('Sans série')
    .id('photos-without-series')
    .child(
      S.documentList()
        .title('Photos sans série')
        .filter('_type == "photo" && !defined(series)')
        .defaultOrdering([{ field: '_updatedAt', direction: 'desc' }])
    );
}

function photosByCategoryNode(S: StructureBuilder) {
  return S.listItem()
    .title('Par catégorie')
    .id('photos-by-category')
    .child(
      S.list()
        .title('Catégories')
        .items(
          PHOTO_CATEGORIES.map(({ value, label }) =>
            S.listItem()
              .title(label)
              .id(`category-${value}`)
              .child(
                S.documentList()
                  .title(label)
                  .filter('_type == "photo" && category == $cat')
                  .params({ cat: value })
              )
          )
        )
    );
}

function photosByYearNode(S: StructureBuilder, context: StructureResolverContext) {
  return S.listItem()
    .title('Par année')
    .id('photos-by-year')
    .child(async () => {
      const client = context.getClient({ apiVersion: '2026-01-01' });
      const years = await client.fetch<number[]>(
        `array::unique(*[_type=="photo" && defined(year)].year) | order(@ desc)`
      );
      return S.list()
        .title('Années')
        .items(
          years.map((year) =>
            S.listItem()
              .title(String(year))
              .id(`year-${year}`)
              .child(
                S.documentList()
                  .title(`Photos ${year}`)
                  .filter('_type == "photo" && year == $year')
                  .params({ year })
              )
          )
        );
    });
}

function photosOnHomepageNode(S: StructureBuilder) {
  return S.listItem()
    .title('Sur la home')
    .id('photos-on-homepage')
    .child(
      S.documentList()
        .title('Photos affichées sur la home')
        .filter('_type == "photo" && onHomepage == true')
        .defaultOrdering([{ field: 'order', direction: 'asc' }])
    );
}

function allPhotosNode(S: StructureBuilder) {
  return S.documentTypeListItem('photo')
    .title('Toutes')
    .id('photos-all');
}

function photosGroupNode(S: StructureBuilder, context: StructureResolverContext) {
  return S.listItem()
    .title('Photos')
    .id('photos-group')
    .child(
      S.list()
        .title('Photos')
        .items([
          photosBySeriesNode(S),
          photosWithoutSeriesNode(S),
          photosByCategoryNode(S),
          photosByYearNode(S, context),
          photosOnHomepageNode(S),
          S.divider(),
          allPhotosNode(S),
        ])
    );
}

function seriesByYearNode(S: StructureBuilder, context: StructureResolverContext) {
  return S.listItem()
    .title('Par année')
    .id('series-by-year')
    .child(async () => {
      const client = context.getClient({ apiVersion: '2026-01-01' });
      const years = await client.fetch<number[]>(
        `array::unique(*[_type=="series" && defined(year)].year) | order(@ desc)`
      );
      return S.list()
        .title('Années')
        .items(
          years.map((year) =>
            S.listItem()
              .title(String(year))
              .id(`series-year-${year}`)
              .child(
                S.documentList()
                  .title(`Séries ${year}`)
                  .filter('_type == "series" && year == $year')
                  .params({ year })
              )
          )
        );
    });
}

function seriesGroupNode(S: StructureBuilder, context: StructureResolverContext) {
  return S.listItem()
    .title('Séries')
    .id('series-group')
    .child(
      S.list()
        .title('Séries')
        .items([
          S.documentTypeListItem('series').title('Toutes').id('series-all'),
          seriesByYearNode(S, context),
        ])
    );
}

export function buildStructure(
  S: StructureBuilder,
  context: StructureResolverContext
) {
  return S.list()
    .title('Contenu')
    .items([
      siteSettingsNode(S),
      S.divider(),
      photosGroupNode(S, context),
      seriesGroupNode(S, context),
    ]);
}
