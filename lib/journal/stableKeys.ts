/**
 * CLÉS STABLES À L'IMPORT (2026-10-29, phase 1 de la Concept Map).
 *
 * Le `_key` d'un bloc du corps est l'ancre publique de son paragraphe
 * (`#p-<clé>`) : un lien partagé, un nœud de la Concept Map pointent dessus.
 * `import-journal` numérotait les clés par position (`k0`, `k1`…) : un
 * paragraphe inséré en tête décalait toutes les suivantes, et chaque lien
 * tombait sur le paragraphe voisin. Désormais, réimporter un article redonne
 * à chaque bloc la clé qu'il avait déjà :
 *
 * 1. texte identique (même type, même style) → la clé existante ;
 * 2. bloc retouché resté à sa place — même type, même rang parmi les blocs
 *    de ce type, clé encore libre → la clé existante ;
 * 3. sinon, bloc neuf → la clé neuve qu'il a reçue à la lecture du Markdown.
 *
 * Aucune dépendance Node : testé hors ligne par `check-map-anchors`.
 */

export type KeyedBlock = { _key: string; _type: string; style?: string; text?: string; children?: { text?: string }[] };

/** Type + style : un intertitre ne reprend jamais la clé d'un paragraphe. */
const kind = (b: KeyedBlock) => `${b._type}:${b.style ?? ''}`;

const textOf = (b: KeyedBlock) =>
  (b.text ?? (b.children ?? []).map((c) => c.text ?? '').join('')).replace(/\s+/g, ' ').trim();

/** Renvoie `incoming` avec les clés de `existing` reprises là où c'est le même bloc. */
export function reuseKeys<T extends KeyedBlock>(incoming: T[], existing: KeyedBlock[]): T[] {
  const free = new Set(existing.map((b) => b._key));
  const keys: (string | undefined)[] = new Array(incoming.length);

  // 1. Texte identique, dans l'ordre : deux paragraphes identiques gardent chacun le leur.
  const byText = new Map<string, string[]>();
  for (const b of existing) {
    const sig = `${kind(b)}|${textOf(b)}`;
    byText.set(sig, [...(byText.get(sig) ?? []), b._key]);
  }
  incoming.forEach((b, i) => {
    const queue = byText.get(`${kind(b)}|${textOf(b)}`);
    const k = queue?.shift();
    if (k && textOf(b)) {
      keys[i] = k;
      free.delete(k);
    }
  });

  // 2. Retouché sur place : même rang parmi les blocs de même type.
  const rank = (list: KeyedBlock[], i: number) => list.slice(0, i).filter((b) => kind(b) === kind(list[i])).length;
  const existingByRank = new Map(existing.map((b, i) => [`${kind(b)}#${rank(existing, i)}`, b._key]));
  incoming.forEach((b, i) => {
    if (keys[i]) return;
    const k = existingByRank.get(`${kind(b)}#${rank(incoming, i)}`);
    if (k && free.has(k)) {
      keys[i] = k;
      free.delete(k);
    }
  });

  return incoming.map((b, i) => (keys[i] ? { ...b, _key: keys[i]! } : b));
}
