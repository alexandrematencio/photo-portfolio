import type { SanityClient } from 'sanity';

/**
 * Création d'un document RÉFÉRENÇABLE depuis l'endroit où l'on s'aperçoit qu'il
 * manque — un champ de référence, une action document. Une seule mécanique pour
 * les deux consommateurs (`quickRefInput.tsx`, `AssignToSeriesAction.tsx`) :
 * `slugify` vivait en double, et un slug dé-doublonné d'un côté seulement, c'est
 * un document livré d'emblée en erreur de validation de l'autre.
 *
 * **Créé PUBLIÉ, jamais en brouillon** : une référence qui pointe un brouillon
 * déclenche l'avertissement « référence vers un document non publié » de Sanity,
 * et le site — qui lit en perspective `published` (§8.4) — ne verrait rien.
 *
 * Le document naît avec son seul titre + slug. C'est délibéré : le geste sert à
 * ne pas interrompre la saisie en cours, pas à remplir la fiche. Elle se
 * complète ensuite dans son propre panneau (alias d'une taxonomie, description
 * et couverture d'une série).
 *
 * ⚠️ Réservé aux **petits ensembles fermés** — même périmètre que
 * `quickRefInput.tsx` : la lecture des slugs ramène TOUS les documents du type.
 * Sur 4 boîtiers ou 13 séries, c'est un aller-retour instantané ; sur 198
 * photos, ce serait à repenser.
 */

/** « Pas de vin à la fête » → « pas-de-vin-a-la-fete » (accents strippés). */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

/**
 * Clé de comparaison de deux titres saisis à la main : casse, accents et
 * espaces multiples n'y comptent pas. Sert UNIQUEMENT à repérer qu'un document
 * portant ce nom existe déjà — « street » et « Street » ne doivent pas donner
 * deux styles, la taxonomie se fragmenterait à la première faute de frappe.
 */
export function sameTitle(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  return norm(a) === norm(b);
}

export type CreatedRefDoc = { _id: string; title: string };

export async function createRefDoc(
  client: SanityClient,
  opts: {
    /** Type du document créé : 'series', 'style', 'camera', 'lens'. */
    type: string;
    /** Titre saisi par l'éditeur, déjà trimmé. */
    title: string;
    /** Slug de repli si le titre ne produit aucun caractère slugifiable. */
    slugFallback: string;
  }
): Promise<CreatedRefDoc> {
  const base = slugify(opts.title) || opts.slugFallback;

  // Perspective `raw` : les BROUILLONS comptent aussi. Un slug déjà réservé par
  // un brouillon passerait ici inaperçu, et les deux documents entreraient en
  // collision au moment du Publish — trop tard pour le dire à l'éditeur.
  const taken = await client
    .withConfig({ perspective: 'raw' })
    .fetch<(string | null)[]>(`*[_type == $type].slug.current`, {
      type: opts.type,
    });

  const used = new Set(taken.filter((s): s is string => Boolean(s)));
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;

  const created = await client.create({
    _type: opts.type,
    title: opts.title,
    slug: { _type: 'slug', current: slug },
  });

  return { _id: created._id, title: opts.title };
}
