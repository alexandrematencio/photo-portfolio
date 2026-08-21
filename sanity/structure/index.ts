import type {
  StructureBuilder,
  StructureResolverContext,
} from 'sanity/structure';

const API_VERSION = '2026-01-01';

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
        // PAS de bouton de création ici. Ce panneau déclare un `.child()`
        // (la liste des photos), et un child explicite REMPLACE la résolution
        // par défaut vers le formulaire — y compris pour un document tout juste
        // créé. Un « + » ouvrirait donc la liste de photos au lieu du formulaire
        // de série : aucun champ édité, donc aucun draft matérialisé, donc rien
        // de créé. Le bouton tournait littéralement à vide.
        // La création/édition des séries vit dans le groupe « Séries » (pas de
        // `.child()` override → le formulaire s'ouvre normalement).
        .initialValueTemplates([])
        // Enfant = liste à 2 entrées, PAS directement la liste de photos.
        // Un `S.menuItem().intent({type:'edit'})` avait été essayé ici pour
        // garder l'édition à portée sans clic supplémentaire : il s'affiche
        // comme une case à cocher et ne navigue pas. On revient donc à des
        // primitives sûres (`S.document()`), quitte à payer un clic de plus.
        .child((seriesId) =>
          S.list()
            .title('Série')
            .items([
              // Libellés explicites : l'ordre des photos se règle sur le
              // DOCUMENT série (champ « Ordre des photos »), pas dans la liste
              // de photos — Sanity ne sait pas réordonner une liste de
              // documents au glisser-déposer. Sans le dire, on cherche la
              // fonctionnalité là où elle ne peut pas être.
              S.listItem()
                .title('Réglages de la série — ordre des photos, cover')
                .id('series-edit')
                .child(S.document().documentId(seriesId).schemaType('series')),
              S.listItem()
                .title('Photos de cette série — éditer une par une')
                .id('series-photos')
                .child(
                  S.documentList()
                    .title('Photos de cette série')
                    .filter('_type == "photo" && references($id)')
                    .params({ id: seriesId })
                    .initialValueTemplates([
                      S.initialValueTemplateItem('photo-by-series', {
                        seriesId,
                      }),
                    ])
                ),
            ])
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
        .filter('_type == "photo" && (!defined(series) || count(series) == 0)')
        .defaultOrdering([{ field: '_updatedAt', direction: 'desc' }])
    );
}

function photosByStyleNode(
  S: StructureBuilder,
  context: StructureResolverContext
) {
  return S.listItem()
    .title('Par style')
    .id('photos-by-style')
    .child(async () => {
      const client = context.getClient({ apiVersion: API_VERSION });
      const styles = await client.fetch<{ _id: string; title: string }[]>(
        `*[_type == "style" && !(_id in path('drafts.**'))] | order(title asc) { _id, title }`
      );
      return S.list()
        .title('Styles')
        .items([
          ...styles.map((style) =>
            S.listItem()
              .title(style.title)
              .id(`style-${style._id}`)
              .child(
                S.documentList()
                  .title(style.title)
                  .filter('_type == "photo" && $id in styles[]._ref')
                  .params({ id: style._id })
                  .initialValueTemplates([
                    S.initialValueTemplateItem('photo-by-style', {
                      styleId: style._id,
                    }),
                  ])
              )
          ),
          S.listItem()
            .title('Sans style')
            .id('style-none')
            .child(
              S.documentList()
                .title('Photos sans style')
                .filter(
                  '_type == "photo" && (!defined(styles) || count(styles) == 0)'
                )
            ),
        ]);
    });
}

function photosByLocationNode(
  S: StructureBuilder,
  context: StructureResolverContext
) {
  return S.listItem()
    .title('Par lieu')
    .id('photos-by-location')
    .child(async () => {
      const client = context.getClient({ apiVersion: API_VERSION });
      const locations = await client.fetch<string[]>(
        `array::unique(*[_type == "photo" && defined(location)].location) | order(@ asc)`
      );
      return S.list()
        .title('Lieux')
        .items(
          locations.map((location, i) =>
            S.listItem()
              .title(location)
              .id(`location-${i}`)
              .child(
                S.documentList()
                  .title(location)
                  .filter('_type == "photo" && location == $location')
                  .params({ location })
                  .initialValueTemplates([
                    S.initialValueTemplateItem('photo-by-location', { location }),
                  ])
              )
          )
        );
    });
}

function photosByTaxonomyRefNode(
  S: StructureBuilder,
  context: StructureResolverContext,
  opts: {
    nodeTitle: string;
    nodeId: string;
    docType: 'camera' | 'lens';
    field: 'camera' | 'lens';
    emptyLabel: string;
  }
) {
  return S.listItem()
    .title(opts.nodeTitle)
    .id(opts.nodeId)
    .child(async () => {
      const client = context.getClient({ apiVersion: API_VERSION });
      const docs = await client.fetch<{ _id: string; title: string }[]>(
        `*[_type == $type && !(_id in path('drafts.**'))] | order(title asc) { _id, title }`,
        { type: opts.docType }
      );
      return S.list()
        .title(opts.nodeTitle)
        .items([
          ...docs.map((doc) =>
            S.listItem()
              .title(doc.title)
              .id(`${opts.nodeId}-${doc._id}`)
              .child(
                S.documentList()
                  .title(doc.title)
                  .filter(`_type == "photo" && ${opts.field}._ref == $id`)
                  .params({ id: doc._id })
                  .initialValueTemplates([
                    S.initialValueTemplateItem(`photo-by-${opts.docType}`, {
                      [`${opts.docType}Id`]: doc._id,
                    }),
                  ])
              )
          ),
          S.listItem()
            .title(opts.emptyLabel)
            .id(`${opts.nodeId}-none`)
            .child(
              S.documentList()
                .title(opts.emptyLabel)
                .filter(`_type == "photo" && !defined(${opts.field})`)
            ),
        ]);
    });
}

function photosByYearNode(S: StructureBuilder, context: StructureResolverContext) {
  return S.listItem()
    .title('Par année')
    .id('photos-by-year')
    .child(async () => {
      const client = context.getClient({ apiVersion: API_VERSION });
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
                  .initialValueTemplates([
                    S.initialValueTemplateItem('photo-by-year', { year }),
                  ])
              )
          )
        );
    });
}

function curatedPhotosNode(S: StructureBuilder) {
  // Vue de consultation. L'édition (ajout / retrait / réordonnancement) se
  // fait dans Réglages du site → champ « Curation » (drag & drop).
  return S.listItem()
    .title('La curation (home)')
    .id('photos-curated')
    .child(
      S.documentList()
        .title('Photos de la home — ordre à éditer dans Réglages du site')
        .filter(
          '_type == "photo" && _id in *[_id == "siteSettings"][0].curation[]._ref'
        )
        // Pas de « + » ici : on ne peut pas créer une photo DANS la curation
        // (l'appartenance vit sur siteSettings, pas sur la photo). Un bouton de
        // création produirait une photo absente de cette liste — trompeur.
        .initialValueTemplates([])
    );
}

function allPhotosNode(S: StructureBuilder) {
  return S.documentTypeListItem('photo')
    .title('Toutes')
    .id('photos-all');
}

/**
 * Photos entrées dans le catalogue au cours des 30 derniers jours.
 *
 * La vue qu'on cherche juste après un import : `upload-photos` dépose des
 * photos sans série, sans curation et avec une légende auto à relire, et rien
 * ne les distinguait ensuite du reste du catalogue — il fallait trier « Toutes »
 * à la main pour retrouver ce qu'on venait d'ajouter.
 *
 * Fenêtre GLISSANTE, calculée par GROQ (`now()`), jamais en JS au moment de
 * construire la structure : la structure n'est bâtie qu'une fois par session
 * de Studio, une borne figée là vieillirait silencieusement pendant que
 * l'éditeur travaille. `dateTime(...)` des deux côtés — `_createdAt` est une
 * chaîne, la comparer telle quelle à un datetime ne compare rien.
 *
 * `_createdAt` et non `_updatedAt` : on veut « arrivées récemment », pas
 * « retouchées récemment ». Une photo de 2015 dont on corrige la légende
 * aujourd'hui n'a rien à faire ici.
 *
 * Pas de bouton de création : une photo créée à la main dans le Studio n'a pas
 * d'image, et surtout ce panneau est une FENÊTRE sur le catalogue, pas un
 * dossier où déposer quelque chose (même raison qu'à « La curation »).
 */
function recentPhotosNode(S: StructureBuilder) {
  return S.listItem()
    .title('Ajoutées récemment (30 j)')
    .id('photos-recent')
    .child(
      S.documentList()
        .title('Ajoutées les 30 derniers jours')
        .filter(
          '_type == "photo" && dateTime(_createdAt) > dateTime(now()) - 60*60*24*30'
        )
        .defaultOrdering([{ field: '_createdAt', direction: 'desc' }])
        .initialValueTemplates([])
    );
}

function photosGroupNode(S: StructureBuilder, context: StructureResolverContext) {
  return S.listItem()
    .title('Photos')
    .id('photos-group')
    .child(
      S.list()
        .title('Photos')
        .items([
          recentPhotosNode(S),
          photosBySeriesNode(S),
          photosWithoutSeriesNode(S),
          photosByStyleNode(S, context),
          photosByYearNode(S, context),
          photosByLocationNode(S, context),
          photosByTaxonomyRefNode(S, context, {
            nodeTitle: 'Par boîtier',
            nodeId: 'photos-by-camera',
            docType: 'camera',
            field: 'camera',
            emptyLabel: 'Sans boîtier renseigné',
          }),
          photosByTaxonomyRefNode(S, context, {
            nodeTitle: 'Par objectif',
            nodeId: 'photos-by-lens',
            docType: 'lens',
            field: 'lens',
            emptyLabel: 'Sans objectif renseigné',
          }),
          curatedPhotosNode(S),
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
      const client = context.getClient({ apiVersion: API_VERSION });
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
                  .initialValueTemplates([
                    S.initialValueTemplateItem('series-by-year', { year }),
                  ])
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

function taxonomiesGroupNode(S: StructureBuilder) {
  return S.listItem()
    .title('Taxonomies')
    .id('taxonomies-group')
    .child(
      S.list()
        .title('Taxonomies')
        .items([
          S.documentTypeListItem('style').title('Styles').id('taxonomy-styles'),
          S.documentTypeListItem('camera')
            .title('Boîtiers')
            .id('taxonomy-cameras'),
          S.documentTypeListItem('lens')
            .title('Objectifs')
            .id('taxonomy-lenses'),
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
      taxonomiesGroupNode(S),
    ]);
}
