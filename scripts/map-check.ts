/**
 * GARDE DE LA CONCEPT MAP (phase 3, docs/superpowers/plans/2026-10-28-journal-map.md).
 *
 *   npm run map:check
 *
 * Relit la carte PUBLIÉE (`journalMap`) contre les articles publiés : chaque
 * ancre est recalée (`lib/journal/mapAnchors.ts`), la dérive et les clés
 * manquantes en EN/RU sont listées. N'écrit rien et sort toujours en 0 : le
 * build du site fait le même recalage en mémoire (`checkConceptMap`), une
 * carte en dérive ne doit jamais empêcher un article de paraître.
 */
import { createClient } from '@sanity/client';
import { checkConceptMap, JOURNAL_MAP_QUERY, MAP_POSTS_QUERY, type JournalMapDoc, type MapPosts } from '../lib/journal/conceptMap';
import { STATUS_LABEL } from '../lib/journal/mapAnchors';

async function main() {
  const client = createClient({ projectId: 'yh5i5diw', dataset: 'production', apiVersion: '2026-01-01', useCdn: false });
  const [map, posts] = await Promise.all([client.fetch<JournalMapDoc | null>(JOURNAL_MAP_QUERY), client.fetch<MapPosts>(MAP_POSTS_QUERY)]);
  if (!map?.nodes?.length) {
    console.log('Concept Map : aucune carte publiée (npm run map:build -- --write, puis Publish).');
    return;
  }
  const { nodes, issues, moved, translationGaps } = checkConceptMap(map, posts);
  console.log(`Concept Map exportée le ${map.exportedAt?.slice(0, 16).replace('T', ' ') ?? '?'} — ${nodes.size} nœuds ancrés`);
  console.log(`  ${nodes.size - moved - issues.length} en place, ${moved} recalés automatiquement, ${issues.length} en dérive`);
  for (const i of issues) console.log(`  ⚠ ${i.slug} · ${i.label} — ${STATUS_LABEL[i.status]}`);
  for (const g of translationGaps) console.log(`  ⚠ ${g.slug} (${g.language}) : ${g.missing.length} ancre(s) absente(s) de la traduction`);
  if (issues.length || moved) console.log('  → à reprendre dans le vault, puis npm run map:build -- --write');
}

main().catch((e) => console.warn(`Concept Map : vérification impossible (${e instanceof Error ? e.message : e})`));
