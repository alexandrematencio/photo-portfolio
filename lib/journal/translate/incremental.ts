/**
 * TRADUCTION INCRÉMENTALE (2026-10-18, demande Alexandre : « quand je change
 * une phrase, je ne veux pas que tout l'article soit retraduit »).
 *
 * Chaque traduction garde, dans son champ caché `translationSource`, le texte
 * FRANÇAIS de chaque unité tel qu'il était quand elle a été écrite. À la
 * demande suivante, `planUnits` compare unité par unité :
 *
 * - texte français identique ET traduction présente → la traduction est
 *   REPRISE telle quelle, retouches d'Alexandre comprises, sans appel ;
 * - texte modifié → l'unité part au modèle AVEC l'ancien français et
 *   l'ancienne traduction, pour qu'il ne reprenne que ce qui a changé ;
 * - unité neuve (ou traduction écrite avant ce mécanisme) → traduite.
 *
 * Une unité disparue du français disparaît de la traduction : la structure
 * (ordre des blocs, figures, références) est toujours reconstruite depuis le
 * français par `applyUnits`, jamais par le modèle.
 *
 * Aucune dépendance Node : testé hors ligne par `check-translate-markup`.
 */
import { extractUnits, type SourcePost, type Unit } from './units';

/** Texte français de chaque unité au moment où la traduction a été écrite. */
export type SourceSnapshot = Record<string, string>;

/** Une unité à envoyer au modèle. Les deux champs `previous*` vont ensemble. */
export type PendingUnit = Unit & { previousSource?: string; previousTranslation?: string };

export type UnitPlan = {
  /** Unités reprises de la traduction existante, par id. */
  reused: Map<string, string>;
  /** Unités à traduire, dans l'ordre de l'article. */
  pending: PendingUnit[];
};

export const snapshotOf = (post: SourcePost): SourceSnapshot =>
  Object.fromEntries(extractUnits(post).map((u) => [u.id, u.text]));

/** Lit le champ `translationSource` ; illisible ou absent → `null` (tout sera traduit). */
export function readSnapshot(raw: unknown): SourceSnapshot | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as SourceSnapshot) : null;
  } catch {
    return null;
  }
}

/**
 * @param source       l'article français (version publiée)
 * @param translation  la traduction existante (brouillon s'il existe, sinon publiée), ou `null`
 * @param snapshot     son `translationSource`, ou `null`
 * @param full         tout retraduire, sans rien reprendre
 */
export function planUnits(
  source: SourcePost,
  translation: SourcePost | null,
  snapshot: SourceSnapshot | null,
  full = false,
): UnitPlan {
  const translated = new Map((translation ? extractUnits(translation) : []).map((u) => [u.id, u.text]));
  const reused = new Map<string, string>();
  const pending: PendingUnit[] = [];

  for (const unit of extractUnits(source)) {
    const previousSource = full ? undefined : snapshot?.[unit.id];
    const previousTranslation = full ? undefined : translated.get(unit.id);
    if (previousSource === unit.text && previousTranslation) reused.set(unit.id, previousTranslation);
    else if (previousSource !== undefined && previousTranslation) pending.push({ ...unit, previousSource, previousTranslation });
    else pending.push(unit);
  }
  return { reused, pending };
}

/** JSON aux clés triées : deux documents égaux se sérialisent pareil, quel que soit l'ordre des champs. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}
