'use client';

/**
 * État de la Concept Map contre les articles publiés : ce qui est en place,
 * recalé tout seul, en dérive, et les ancres absentes d'une traduction.
 *
 * Deux usages : l'onglet « État » du document Concept Map (la version
 * affichée, brouillon compris, pour juger AVANT Publish) et la carte du
 * Tableau de bord (la version publiée, celle que lit le site).
 */
import { useEffect, useMemo, useState } from 'react';
import { Badge, Box, Card, Flex, Heading, Spinner, Stack, Text } from '@sanity/ui';
import { EditIcon } from '@sanity/icons';
import { IntentLink } from 'sanity/router';
import { useClient } from 'sanity';
import { checkConceptMap, JOURNAL_MAP_QUERY, MAP_POSTS_QUERY, type JournalMapDoc, type MapPosts } from '@/lib/journal/conceptMap';
import { STATUS_LABEL } from '@/lib/journal/mapAnchors';

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function ConceptMapStatus({ map: given }: { map?: JournalMapDoc | null }) {
  const client = useClient({ apiVersion: '2026-01-01' });
  const [published, setPublished] = useState<JournalMapDoc | null | undefined>(given === undefined ? undefined : null);
  const [posts, setPosts] = useState<MapPosts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const read = client.withConfig({ perspective: 'published' });
    Promise.all([given === undefined ? read.fetch<JournalMapDoc | null>(JOURNAL_MAP_QUERY) : Promise.resolve(null), read.fetch<MapPosts>(MAP_POSTS_QUERY)])
      .then(([m, p]) => {
        if (!live) return;
        if (given === undefined) setPublished(m);
        setPosts(p);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [client, given]);

  const map = given === undefined ? published : given;
  const result = useMemo(() => (map?.nodes?.length && posts ? checkConceptMap(map, posts) : null), [map, posts]);
  const postId = useMemo(() => new Map((posts?.fr ?? []).map((p) => [p.slug, { id: p._id, title: p.title ?? p.slug }])), [posts]);

  if (error) return <Text size={1}>Lecture impossible : {error}</Text>;
  if (map === undefined || !posts) return <Spinner muted />;
  if (!map?.nodes?.length)
    return (
      <Text size={1} muted>
        Pas encore de carte {given === undefined ? 'publiée' : 'exportée'}. Depuis le dépôt : <code>npm run map:build -- --write</code>, puis Publish.
      </Text>
    );

  const { nodes, issues, moved, translationGaps } = result!;
  const ok = nodes.size - moved - issues.length;
  const bySlug = new Map<string, typeof issues>();
  for (const i of issues) bySlug.set(i.slug, [...(bySlug.get(i.slug) ?? []), i]);

  return (
    <Stack space={4}>
      <Flex gap={2} wrap="wrap" align="center">
        <Badge tone="positive">{ok} en place</Badge>
        {moved > 0 && <Badge tone="primary">{plural(moved, 'recalé', 'recalés')} automatiquement</Badge>}
        <Badge tone={issues.length ? 'caution' : 'positive'}>{issues.length} en dérive</Badge>
        {translationGaps.length > 0 && <Badge tone="critical">{plural(translationGaps.length, 'traduction', 'traductions')} sans leurs ancres</Badge>}
        {map.exportedAt && (
          <Text size={1} muted>
            Export du vault : {new Date(map.exportedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
          </Text>
        )}
      </Flex>

      {issues.length === 0 && translationGaps.length === 0 && (
        <Text size={1} muted>
          ✓ Chaque thèse et chaque mécanisme retrouve sa citation dans le texte publié.
          {moved > 0 && ' Les ancres recalées le sont déjà sur le site ; un nouvel export les fixera.'}
        </Text>
      )}

      {[...bySlug].map(([slug, list]) => (
        <Stack space={2} key={slug}>
          <IntentLink intent="edit" params={{ id: postId.get(slug)?.id ?? slug, type: 'post' }} style={{ textDecoration: 'none' }}>
            <Card padding={2} radius={1} tone="transparent" __unstable_focusRing>
              <Flex gap={2} align="center">
                <EditIcon style={{ opacity: 0.5 }} />
                <Text size={1} weight="semibold">
                  {postId.get(slug)?.title ?? slug} — {list.length} nœud{list.length > 1 ? 's' : ''} à reprendre
                </Text>
              </Flex>
            </Card>
          </IntentLink>
          <Stack space={2} paddingLeft={4}>
            {list.map((i) => (
              <Text size={1} key={i.nodeId}>
                {i.label} <span style={{ opacity: 0.6 }}>— {STATUS_LABEL[i.status]}</span>
              </Text>
            ))}
          </Stack>
        </Stack>
      ))}

      {translationGaps.map((g) => (
        <IntentLink key={g._id} intent="edit" params={{ id: g._id, type: 'post' }} style={{ textDecoration: 'none' }}>
          <Card padding={2} radius={1} tone="transparent" __unstable_focusRing>
            <Text size={1}>
              {postId.get(g.slug)?.title ?? g.slug} ({g.language.toUpperCase()}) : {g.missing.length} paragraphe(s) pointé(s) par la carte
              absent(s) de la traduction — clés à réaligner (<code>npm run align-translation-keys</code>)
            </Text>
          </Card>
        </IntentLink>
      ))}

      {(issues.length > 0 || moved > 0) && (
        <Text size={1} muted>
          Le site renvoie déjà au meilleur endroit trouvé. Pour corriger : reprendre la citation dans le vault Obsidian, puis{' '}
          <code>npm run map:build -- --write</code> et Publish.
        </Text>
      )}
    </Stack>
  );
}

/** Onglet « État » du document Concept Map. */
export function ConceptMapStatusView(props: { document: { displayed: JournalMapDoc } }) {
  return (
    <Box padding={4}>
      <Stack space={4}>
        <Heading size={1}>La carte contre le texte publié</Heading>
        <ConceptMapStatus map={props.document.displayed} />
      </Stack>
    </Box>
  );
}
