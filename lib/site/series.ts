import type { Photo, SeriesWithPhotos } from '@/lib/sanity/queries';

/**
 * Préparation des données de la page /series — fonctions PURES, sans React ni
 * Sanity client. Testables seules, et réutilisables telles quelles le jour où
 * les pages indexables /series/[slug] arriveront (spec §9).
 */

export type PreparedSeries = {
  _id: string;
  title: string;
  slug: string;
  subtitle?: string;
  year?: number;
  /**
   * Cover résolue : `coverPhoto` si défini et présent, sinon la 1ʳᵉ photo —
   * donc la première de l'ordre éditorial dès qu'il en existe un.
   */
  cover: Photo;
  /** Photos de la série, cover comprise, dans l'ordre d'affichage. */
  photos: Photo[];
};

/**
 * Applique un ordre éditorial (tableau de références) à une liste d'items.
 *
 * Sert aux DEUX tris de la page /series : l'ordre des photos dans une série
 * (`series.photoOrder`) et l'ordre des séries dans la rangée
 * (`siteSettings.seriesOrder`). Même contrat dans les deux cas :
 *
 * **Le tableau est une CLÉ DE TRI, pas une liste d'appartenance** (CLAUDE.md
 * §11.12 : deux sources de vérité = dérive garantie). Cette fonction est ce
 * qui rend la distinction tenable — elle croise les deux listes, si bien que
 * le tableau peut être vide, incomplet OU périmé sans jamais fausser ce qui
 * s'affiche :
 *
 * - référence pointant un item qui n'existe plus dans la liste → **ignorée** ;
 * - item absent du tableau → **ajouté à la fin**, dans l'ordre de repli
 *   d'entrée. Une photo fraîchement rattachée (ou une série fraîchement créée)
 *   arrive donc en dernier ; l'éditeur la remonte quand il le décide, jamais
 *   dans l'urgence d'un import.
 *
 * Aucune maintenance n'est donc requise côté Studio : rien à « resynchroniser ».
 */
function applyOrder<T extends { _id: string }>(
  items: T[],
  orderRefs: string[] | null
): T[] {
  if (!orderRefs || orderRefs.length === 0) return items;
  const byId = new Map(items.map((item) => [item._id, item]));
  const ordered: T[] = [];
  const placed = new Set<string>();
  for (const ref of orderRefs) {
    const item = byId.get(ref);
    // `placed` couvre aussi le doublon dans le tableau : `Rule.unique()` est
    // une validation Studio, pas une garantie sur la donnée déjà en base.
    if (item && !placed.has(ref)) {
      ordered.push(item);
      placed.add(ref);
    }
  }
  for (const item of items) {
    if (!placed.has(item._id)) ordered.push(item);
  }
  return ordered;
}

/**
 * Filtre les séries vides (rien à montrer → exclues du site public, le
 * Dashboard Studio les signale déjà), applique l'ordre éditorial des photos
 * DANS chaque série, ordonne les SÉRIES entre elles, et résout la cover.
 *
 * `seriesOrderRefs` (`siteSettings.seriesOrder`) : 1ʳᵉ du tableau = 1ʳᵉ pile à
 * gauche de la rangée, dernière = dernière à droite. Repli quand il est vide
 * ou incomplet : l'ordre d'entrée de la GROQ (`order` asc, titre asc) — une
 * série jamais rangée s'affiche donc après celles qui le sont.
 *
 * L'ordre est appliqué APRÈS le filtrage des séries vides : une série vide
 * listée dans `seriesOrder` ne laisse pas de trou.
 */
export function prepareSeries(
  raw: SeriesWithPhotos[],
  seriesOrderRefs: string[] | null = null
): PreparedSeries[] {
  const prepared: PreparedSeries[] = [];
  for (const s of raw) {
    // Une photo sans asset image n'est pas affichable — on l'écarte AVANT de
    // compter, pour qu'une série entièrement vide d'images soit exclue aussi.
    // Et avant d'ordonner : une photo cassée listée dans `photoOrder` ne doit
    // pas laisser de trou.
    const photos = applyOrder(
      (s.photos ?? []).filter((p) => p.image?.asset?._ref),
      s.photoOrderRefs ?? null
    );
    if (photos.length === 0) continue;
    if (!s.slug?.current) continue;
    const cover =
      (s.coverRef && photos.find((p) => p._id === s.coverRef)) || photos[0];
    prepared.push({
      _id: s._id,
      title: s.title,
      slug: s.slug.current,
      subtitle: s.subtitle,
      year: s.year,
      cover,
      photos,
    });
  }
  return applyOrder(prepared, seriesOrderRefs);
}

/* `seriesSlugFromHash` vivait ici : `#boats` → `boats` si le slug existait.
   Retiré le 2026-08-23 avec le contrat d'ancre de /series (cf.
   SeriesExperience) — l'URL n'ouvre plus de série, il n'y a donc plus rien à
   lire dans le fragment. */

function cityOf(location: string): string {
  const city = location.split(',')[0].trim();
  return city.replace(/(^|\s)(\p{L})/gu, (_m, sp: string, ch: string) => sp + ch.toUpperCase());
}

/**
 * Phrase factuelle sur une série, DÉDUITE de ses photos — le repli de
 * `/series/[slug]` tant que l'éditeur n'a rien écrit : une page ne s'ouvre
 * jamais sur du vide. « 22 photographs · Djerba · 2023–2026 ».
 */
export function seriesFacts(photos: Photo[]): string {
  const counts = new Map<string, number>();
  for (const p of photos) {
    if (!p.location) continue;
    const city = cityOf(p.location);
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  const places = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([c]) => c);
  const years = photos.map((p) => p.year).filter((y): y is number => Number.isFinite(y));
  const span =
    years.length === 0
      ? ''
      : Math.min(...years) === Math.max(...years)
        ? String(years[0])
        : `${Math.min(...years)}–${Math.max(...years)}`;
  const n = photos.length;
  return [`${n} photograph${n > 1 ? 's' : ''}`, places.join(', '), span]
    .filter(Boolean)
    .join(' · ');
}
