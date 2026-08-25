import { Badge, Box, Card, Flex, Grid, Stack, Text } from '@sanity/ui';
import { IntentLink } from 'sanity/router';

import type { PhotoRecord } from './photoIndexQuery';
import type { ThumbFn } from './SearchCard';

/**
 * Planche-contact : un photographe reconnaît une IMAGE, pas une ligne de texte.
 *
 * ⚠️ Ce composant est le SLOT de rendu d'un résultat. Pour une autre affaire on
 * le remplace par une carte produit ; le moteur ne s'en aperçoit pas (spec §9.3).
 */
export function ResultGrid({
  hits,
  thumbUrl,
}: {
  hits: { doc: PhotoRecord }[];
  thumbUrl: ThumbFn;
}) {
  return (
    <Grid columns={[3, 4, 6]} gap={2}>
      {hits.map(({ doc }) => {
        const url = thumbUrl(doc.image ?? undefined, 220);
        return (
          <IntentLink
            key={doc.id}
            intent="edit"
            params={{ id: doc.id, type: 'photo' }}
            style={{ textDecoration: 'none' }}
          >
            <Card radius={2} overflow="hidden" tone="transparent" border>
              <Stack space={2}>
                <Box
                  style={{
                    aspectRatio: '1 / 1',
                    background: url
                      ? `center/cover no-repeat url(${url})`
                      : 'var(--card-border-color)',
                  }}
                />
                <Box padding={2}>
                  <Stack space={2}>
                    <Flex gap={2} align="center">
                      <Text size={1} weight="medium" textOverflow="ellipsis">
                        {doc.title ?? 'Sans titre'}
                      </Text>
                      {doc.hasDraft && (
                        <Badge tone="caution" fontSize={0}>
                          brouillon
                        </Badge>
                      )}
                    </Flex>
                    <Text size={0} muted textOverflow="ellipsis">
                      {[doc.year, doc.location].filter(Boolean).join(' · ')}
                    </Text>
                  </Stack>
                </Box>
              </Stack>
            </Card>
          </IntentLink>
        );
      })}
    </Grid>
  );
}
