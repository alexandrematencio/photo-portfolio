import { isKeySegment, type ObjectSchemaType, type Path, type SchemaType, type ValidationMarker } from 'sanity';

/**
 * Les erreurs d'un document, dites en mots d'auteur (2026-10-20).
 *
 * Sanity sait qu'un document est bloqué, mais le dit mal : Publish grisé, une
 * pastille rouge sur l'onglet « Tous les champs », et rien au survol. Le
 * marqueur de validation porte pourtant tout ce qu'il faut — un chemin
 * (`['body', {_key}, 'alt']`) et un message. Ce module traduit le chemin en
 * libellés du formulaire (« Texte › Image 7 › Description (texte
 * alternatif) ») pour trois consommateurs : le résumé en tête du formulaire
 * (`DocumentValidationSummary`), l'infobulle de Publish
 * (`withExplainedPublish`) et celle des onglets.
 */

export type ValidationIssue = {
  level: ValidationMarker['level'];
  path: Path;
  /** Le premier champ du chemin : sert à rattacher l'erreur à un onglet. */
  field: string | undefined;
  /** Les libellés du formulaire, du champ racine à la valeur fautive. */
  where: string[];
  message: string;
};

type Item = { _key?: string; _type?: string; style?: string; children?: { text?: string }[] };

function blockLabel(item: Item): string {
  const text = (item.children ?? []).map((c) => c.text ?? '').join('').trim();
  const kind = item.style === 'h2' ? 'Intertitre' : 'Paragraphe';
  if (!text) return kind;
  const words = text.split(/\s+/);
  return `${kind} « ${words.slice(0, 6).join(' ')}${words.length > 6 ? '…' : ''} »`;
}

/** Les libellés d'un chemin, et la valeur qu'il désigne. */
function walk(root: SchemaType, document: unknown, path: Path): { where: string[]; value: unknown } {
  const where: string[] = [];
  let type: SchemaType | undefined = root;
  let value: unknown = document;

  for (const segment of path) {
    if (typeof segment === 'string') {
      const field: { name: string; type: SchemaType } | undefined = (type as ObjectSchemaType | undefined)?.fields?.find(
        (f) => f.name === segment,
      );
      // Les enfants d'un paragraphe : le paragraphe suffit à situer l'erreur.
      if (!(segment === 'children' && type?.name === 'block')) where.push(field?.type.title ?? segment);
      type = field?.type;
      value = (value as Record<string, unknown> | undefined)?.[segment];
      continue;
    }
    const items: Item[] = Array.isArray(value) ? value : [];
    const index =
      typeof segment === 'number' ? segment : isKeySegment(segment) ? items.findIndex((i) => i?._key === segment._key) : -1;
    const item = items[index];
    const of: SchemaType[] = (type as { of?: SchemaType[] } | undefined)?.of ?? [];
    const itemType = of.find((t) => t.name === (item?._type ?? of[0]?.name)) ?? of[0];
    if (itemType?.name === 'block') {
      if (item) where.push(blockLabel(item));
    } else if (itemType?.name === 'span') {
      // Un morceau de texte n'a pas de nom pour l'auteur.
    } else {
      // Le rang parmi les éléments du même genre : « Image 7 », pas « élément 47 ».
      const rank = items.slice(0, index + 1).filter((i) => i?._type === item?._type).length;
      where.push(`${itemType?.title ?? 'Élément'}${rank > 0 ? ` ${rank}` : ''}`);
    }
    type = itemType;
    value = item;
  }
  return { where, value };
}

/** « 200 signes au plus. » ne dit pas de combien on dépasse : on l'ajoute. */
function withCount(message: string, value: unknown): string {
  if (typeof value === 'string' && /signes au (plus|moins)\.?$/.test(message)) {
    return `${message.replace(/\.$/, '')} — il y en a ${value.length}.`;
  }
  return message;
}

const LEVEL_ORDER: Record<ValidationMarker['level'], number> = { error: 0, warning: 1, info: 2 };

export function describeValidation(
  schemaType: SchemaType,
  document: unknown,
  markers: ValidationMarker[],
): ValidationIssue[] {
  return markers
    .map((marker) => {
      const { where, value } = walk(schemaType, document, marker.path);
      return {
        level: marker.level,
        path: marker.path,
        field: typeof marker.path[0] === 'string' ? marker.path[0] : undefined,
        where: where.length ? where : ['Document'],
        message: withCount(marker.message, value),
      };
    })
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

export const formatIssue = (issue: ValidationIssue) => `${issue.where.join(' › ')} : ${issue.message}`;

export const countLabel = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
