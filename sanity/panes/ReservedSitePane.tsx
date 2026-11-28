import { Box, Card, Stack, Text } from '@sanity/ui';
import type { UserComponent } from 'sanity/structure';

export type ReservedSiteOptions = {
  host: string;
  /** Une phrase : pourquoi il n'y a rien à éditer, et ce qui changera. */
  why: string;
};

/**
 * Volet d'un site annoncé mais pas encore en ligne (design.amatencio.com).
 *
 * Il reste dans la liste des sites plutôt que de s'y cacher : une place
 * réservée évite de reclasser tout le Studio le jour où le site arrive, et un
 * volet qui dit POURQUOI il est vide vaut mieux qu'une entrée absente ou
 * grisée sans explication. Même parti pris que « Soon » dans le menu
 * « All sites » du site (`SITES`, lib/site/nav.ts).
 */
export const ReservedSitePane: UserComponent = (props) => {
  const { host, why } = props.options as ReservedSiteOptions;
  return (
    <Box padding={4}>
      <Card padding={4} radius={2} border tone="transparent">
        <Stack gap={3}>
          <Text size={1} weight="semibold">
            {host} — pas encore de contenu
          </Text>
          <Text size={1} muted>
            {why}
          </Text>
        </Stack>
      </Card>
    </Box>
  );
};
