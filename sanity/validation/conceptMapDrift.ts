import type { Path, ValidationContext, ValidationError } from 'sanity';
import { articleSlugOf, checkConceptMap, JOURNAL_MAP_ID, type StoredMapNode } from '@/lib/journal/conceptMap';
import { mapBody, type MapBlock } from '@/lib/journal/mapAnchors';

/**
 * La dérive de la Concept Map, dite DANS le formulaire de l'article
 * (2026-10-30, demande Alexandre : « 2 à reprendre — 2 quoi ? »). La pastille
 * du document ne disait qu'un nombre ; ici chaque nœud dit quelle phrase il
 * cherche, ce qu'il est arrivé, et comment réparer depuis le Studio. Un
 * avertissement, jamais une erreur : le site renvoie déjà au meilleur
 * endroit trouvé, la publication n'a pas à attendre la carte.
 *
 * Le texte vérifié est celui affiché (brouillon compris) : corps puis note
 * sur l'IA, comme `MAP_POSTS_QUERY`.
 */

/** La carte change rarement : une lecture par minute suffit, pas une par frappe. */
let cache: { at: number; nodes: Promise<StoredMapNode[]> } | null = null;

function mapNodes(context: ValidationContext) {
  if (!cache || Date.now() - cache.at > 60_000) {
    const client = context.getClient({ apiVersion: '2026-01-01' }).withConfig({ perspective: 'published' });
    cache = { at: Date.now(), nodes: client.fetch<StoredMapNode[] | null>(`*[_id == $id][0].nodes`, { id: JOURNAL_MAP_ID }).then((n) => n ?? []) };
  }
  return cache.nodes;
}

const short = (s: string) => (s.length > 120 ? `${s.slice(0, 117)}…` : s);

export async function conceptMapDrift(body: unknown, context: ValidationContext): Promise<true | ValidationError[]> {
  const doc = context.document as { language?: string; slug?: { current?: string }; aiNote?: MapBlock[] } | undefined;
  const slug = doc?.slug?.current;
  // Les traductions suivent les clés du français : la carte ne se vérifie que là.
  if (!slug || (doc?.language && doc.language !== 'fr')) return true;

  let nodes: StoredMapNode[];
  try {
    nodes = (await mapNodes(context)).filter((n) => articleSlugOf(n) === slug);
  } catch {
    return true; // Carte illisible (réseau) : ne pas inventer d'alerte.
  }
  if (!nodes.length) return true;

  const text = mapBody((Array.isArray(body) ? body : []) as MapBlock[], doc?.aiNote);
  const { issues, nodes: checked } = checkConceptMap({ nodes }, { fr: [{ _id: '', slug, body: text }], tr: [] });
  const inBody = new Set(((Array.isArray(body) ? body : []) as MapBlock[]).map((b) => b._key));

  return issues.map((issue) => {
    const node = checked.get(issue.nodeId)!;
    const kind = node.kind === 'mechanism' ? 'Le mécanisme' : 'La thèse';
    const quote = `« ${short(node.quote ?? '')} »`;
    const fix = 'Pour réparer ici : remettre cette phrase dans le texte (la casse et la ponctuation finale ne comptent pas), la carte la retrouve seule.';
    const keep = 'Ça ne bloque pas la publication';
    const message =
      issue.status === 'reworded'
        ? `Concept Map — ${kind} « ${issue.label} » cite ${quote}, qui n’est plus dans ce paragraphe. ${fix} ${keep} : le lien de la carte mène toujours à ce paragraphe.`
        : issue.status === 'section'
          ? `Concept Map — ${kind} « ${issue.label} » cite ${quote}, mais son paragraphe a été supprimé. ${fix} ${keep} : en attendant, la carte renvoie à l’intertitre.`
          : `Concept Map — ${kind} « ${issue.label} » cite ${quote}, introuvable dans l’article. ${fix} ${keep} : en attendant, la carte renvoie au début de l’article.`;
    // Le clic du résumé mène au paragraphe d'ancre quand il est dans le corps.
    const path: Path | undefined = node.target.kind !== 'article' && inBody.has(node.target.key) ? [{ _key: node.target.key }] : undefined;
    return { message, ...(path ? { path } : {}) };
  });
}
