/**
 * Pastille « Concept Map » d'un article français : combien de nœuds de la
 * carte publiée ne retrouvent plus leur citation dans le texte AFFICHÉ —
 * brouillon compris, donc on le voit en écrivant, avant Publish. Rien quand
 * tout est en place (un recalage automatique n'est pas une alerte).
 */
import { useEffect, useMemo, useState } from 'react';
import { useClient, type DocumentBadgeComponent } from 'sanity';
import { articleSlugOf, checkConceptMap, JOURNAL_MAP_ID, type StoredMapNode } from '@/lib/journal/conceptMap';
import { mapBody, STATUS_LABEL, type MapBlock } from '@/lib/journal/mapAnchors';

type PostDoc = { slug?: { current?: string }; translationOf?: unknown; body?: MapBlock[]; aiNote?: MapBlock[] };

export const ConceptMapBadge: DocumentBadgeComponent = (props) => {
  const doc = (props.draft ?? props.published) as PostDoc | null;
  const slug = doc && !doc.translationOf ? doc.slug?.current : undefined;
  const client = useClient({ apiVersion: '2026-01-01' });
  const [nodes, setNodes] = useState<StoredMapNode[] | null>(null);

  useEffect(() => {
    if (!slug) return;
    let live = true;
    client
      .withConfig({ perspective: 'published' })
      .fetch<StoredMapNode[] | null>(`*[_id == $id][0].nodes[article == "a:" + $slug || quoteArticle == $slug]`, { id: JOURNAL_MAP_ID, slug })
      .then((n) => live && setNodes(n ?? []))
      .catch(() => live && setNodes([]));
    return () => {
      live = false;
    };
  }, [client, slug]);

  const issues = useMemo(() => {
    if (!slug || !nodes?.length) return [];
    // Les mécanismes cités ici mais employés ailleurs : seule leur citation compte.
    const mine = nodes.filter((n) => articleSlugOf(n) === slug);
    // La note sur l'IA est ancrable comme le corps (MAP_POSTS_QUERY).
    const body = mapBody(doc?.body, doc?.aiNote);
    return checkConceptMap({ nodes: mine }, { fr: [{ _id: '', slug, body }], tr: [] }).issues;
  }, [nodes, slug, doc?.body, doc?.aiNote]);

  if (!issues.length) return null;
  return {
    // Le détail et la marche à suivre sont dans le résumé en tête du formulaire (`conceptMapDrift`).
    label: `Concept Map : ${issues.length > 1 ? `${issues.length} citations perdues` : '1 citation perdue'}`,
    title: [...issues.map((i) => `${i.label} — ${STATUS_LABEL[i.status]}`), 'Détail et solution : encadré jaune en tête du formulaire.'].join('\n'),
    color: 'warning',
  };
};
