import type {
  StructureBuilder,
  StructureResolverContext,
} from 'sanity/structure';

import { photoGridPane } from './photoGrid';

const API_VERSION = '2026-01-01';

// Toutes les listes de photos passent par `photoGridPane` (planche-contact
// quand rien n'est ouvert, colonne dès qu'une photo l'est — §11.21). La
// condition GROQ se donne SANS `_type == "photo"`.

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
                  photoGridPane(S, {
                    id: 'series-photos-grid',
                    title: 'Photos de cette série',
                    filter: 'references($id)',
                    params: { id: seriesId },
                    create: {
                      template: 'photo-by-series',
                      params: { seriesId },
                    },
                    emptyText:
                      'Aucune photo dans cette série. « Nouvelle photo » en crée une déjà rattachée.',
                  })
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
      photoGridPane(S, {
        id: 'photos-without-series-grid',
        title: 'Photos sans série',
        filter: '!defined(series) || count(series) == 0',
        sort: 'updated',
        create: {},
        emptyText: 'Toutes les photos sont rattachées à une série.',
      })
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
                photoGridPane(S, {
                  id: `style-${style._id}-grid`,
                  title: style.title,
                  filter: '$id in styles[]._ref',
                  params: { id: style._id },
                  create: {
                    template: 'photo-by-style',
                    params: { styleId: style._id },
                  },
                  emptyText: 'Aucune photo dans ce style.',
                })
              )
          ),
          S.listItem()
            .title('Sans style')
            .id('style-none')
            .child(
              photoGridPane(S, {
                id: 'style-none-grid',
                title: 'Photos sans style',
                filter: '!defined(styles) || count(styles) == 0',
                sort: 'updated',
                create: {},
                emptyText: 'Toutes les photos ont un style.',
              })
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
                photoGridPane(S, {
                  id: `location-${i}-grid`,
                  title: location,
                  filter: 'location == $location',
                  params: { location },
                  create: {
                    template: 'photo-by-location',
                    params: { location },
                  },
                  emptyText: 'Aucune photo pour ce lieu.',
                })
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
                photoGridPane(S, {
                  id: `${opts.nodeId}-${doc._id}-grid`,
                  title: doc.title,
                  filter: `${opts.field}._ref == $id`,
                  params: { id: doc._id },
                  create: {
                    template: `photo-by-${opts.docType}`,
                    params: { [`${opts.docType}Id`]: doc._id },
                  },
                  emptyText: 'Aucune photo avec ce matériel.',
                })
              )
          ),
          S.listItem()
            .title(opts.emptyLabel)
            .id(`${opts.nodeId}-none`)
            .child(
              photoGridPane(S, {
                id: `${opts.nodeId}-none-grid`,
                title: opts.emptyLabel,
                filter: `!defined(${opts.field})`,
                sort: 'updated',
                create: {},
                emptyText: 'Le matériel est renseigné sur toutes les photos.',
              })
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
                photoGridPane(S, {
                  id: `year-${year}-grid`,
                  title: `Photos ${year}`,
                  filter: 'year == $year',
                  params: { year },
                  sort: 'title',
                  create: { template: 'photo-by-year', params: { year } },
                  emptyText: 'Aucune photo cette année-là.',
                })
              )
          )
        );
    });
}

function curatedPhotosNode(S: StructureBuilder) {
  // Vue de consultation, dans l'ORDRE de la home (`orderQuery`). L'ordre se
  // change au Tableau de bord (glisser-déposer) ou dans Réglages du site →
  // Curation ; l'ajout et le retrait, dans les Réglages seulement.
  return S.listItem()
    .title('La curation (home)')
    .id('photos-curated')
    .child(
      photoGridPane(S, {
        id: 'photos-curated-grid',
        title: 'Photos de la home — dans l’ordre du site',
        filter: '_id in *[_id == "siteSettings"][0].curation[]._ref',
        orderQuery: '*[_id == "siteSettings"][0].curation[]._ref',
        // Une mutation des Réglages (ordre, ajout, retrait) doit relire, or le
        // listener n'évalue son filtre que sur les documents mutés.
        listenAlso: '_id in ["siteSettings", "drafts.siteSettings"]',
        // Pas de création ici : on ne peut pas créer une photo DANS la curation
        // (l'appartenance vit sur siteSettings, pas sur la photo). Un bouton de
        // création produirait une photo absente de cette liste — trompeur.
        create: null,
        emptyText:
          'Aucune photo curatée : la home est vide. Réglages du site → Curation.',
      })
    );
}

/**
 * Photos retirées du site par leur interrupteur `hidden` — la vue d'où on les
 * remet en ligne. `== true` et pas `!= false` : un champ absent veut dire
 * visible. Pas de bouton de création, même raison qu'à « La curation ».
 */
function hiddenPhotosNode(S: StructureBuilder) {
  return S.listItem()
    .title('Masquées du site')
    .id('photos-hidden')
    .child(
      photoGridPane(S, {
        id: 'photos-hidden-grid',
        title: 'Photos masquées du site',
        filter: 'hidden == true',
        sort: 'updated',
        create: null,
        emptyText: 'Aucune photo masquée : tout le catalogue est en ligne.',
      })
    );
}

/**
 * « Toutes ». ⚠️ Ce n'était plus un `documentTypeListItem('photo')` depuis le
 * 2026-09-10 : un panneau composant ne répond à aucun intent, donc une photo
 * ouverte depuis le Tableau de bord ou la recherche globale s'ouvre dans
 * l'éditeur de repli de Sanity (à la racine), pas ici. Assumé (§11.21).
 */
function allPhotosNode(S: StructureBuilder) {
  return S.listItem()
    .title('Toutes')
    .id('photos-all')
    .child(
      photoGridPane(S, {
        id: 'photos-all-grid',
        title: 'Toutes les photos',
        filter: 'true',
        create: {},
        emptyText: 'Aucune photo dans le catalogue.',
      })
    );
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
      photoGridPane(S, {
        id: 'photos-recent-grid',
        title: 'Ajoutées les 30 derniers jours',
        filter: 'dateTime(_createdAt) > dateTime(now()) - 60*60*24*30',
        sort: 'created',
        create: null,
        emptyText: 'Aucune photo ajoutée ces 30 derniers jours.',
      })
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
          hiddenPhotosNode(S),
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
