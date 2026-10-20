import { useEffect, useMemo, useRef } from 'react';
import { Box, Button, Card, Flex, Stack, Text } from '@sanity/ui';
import { ErrorOutlineIcon, WarningOutlineIcon } from '@sanity/icons';
import {
  getPublishedId,
  useValidationStatus,
  type InputProps,
  type ObjectInputProps,
  type ObjectSchemaType,
} from 'sanity';
import { countLabel, describeValidation, formatIssue, type ValidationIssue } from '@/sanity/lib/validationSummary';

/**
 * Le résumé des erreurs, en tête de TOUT formulaire de document (2026-10-20,
 * demande Alexandre : « Publish grisé, une pastille rouge, et aucune
 * infobulle »).
 *
 * Branché en `form.components.input` (studio.config.ts) : il ne s'interpose
 * que sur l'input RACINE d'un document et rend le formulaire natif dessous.
 * Trois choses :
 * - une carte rouge qui liste ce qui bloque Publish, chaque ligne menant au
 *   champ fautif ; une carte jaune pour ce qui est seulement à vérifier ;
 * - rien du tout quand le document est propre — pas de « tout va bien » ;
 * - une infobulle (`title`) sur chaque onglet de groupe qui porte une pastille,
 *   que Sanity rend sans texte. Les onglets sont des boutons natifs : on n'y
 *   pose qu'un attribut, sur le DOM, à chaque rendu (Sanity ne gère pas
 *   `title` sur ce bouton, il ne l'efface donc pas).
 */

const MAX_LINES = 12;
/** `ALL_FIELDS_GROUP_NAME` de Sanity, non exporté. */
const ALL_FIELDS = 'all-fields';

function IssueList({
  issues,
  tone,
  icon,
  heading,
  onOpen,
}: {
  issues: ValidationIssue[];
  tone: 'critical' | 'caution';
  icon: React.ReactNode;
  heading: string;
  onOpen: (issue: ValidationIssue) => void;
}) {
  const shown = issues.slice(0, MAX_LINES);
  return (
    <Card tone={tone} border radius={2} padding={3}>
      <Stack space={3}>
        <Flex gap={2} align="center">
          <Text size={1}>{icon}</Text>
          <Text size={1} weight="semibold">
            {heading}
          </Text>
        </Flex>
        <Stack space={1}>
          {shown.map((issue, i) => (
            <Button
              key={i}
              mode="bleed"
              tone={tone}
              padding={2}
              justify="flex-start"
              onClick={() => onOpen(issue)}
              title="Aller au champ"
            >
              <Stack space={2}>
                <Text size={1} weight="medium" muted>
                  {issue.where.join(' › ')}
                </Text>
                <Text size={1}>{issue.message}</Text>
              </Stack>
            </Button>
          ))}
          {issues.length > MAX_LINES && (
            <Box paddingX={2} paddingTop={1}>
              <Text size={1} muted>
                Et {issues.length - MAX_LINES} de plus : corriger celles-ci d’abord.
              </Text>
            </Box>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

function tabTooltip(issues: ValidationIssue[]): string {
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const lines: string[] = [];
  if (errors.length) {
    lines.push(`${countLabel(errors.length, 'erreur bloque', 'erreurs bloquent')} la publication :`);
    lines.push(...errors.slice(0, 5).map((i) => `• ${formatIssue(i)}`));
    if (errors.length > 5) lines.push(`• et ${errors.length - 5} de plus`);
  }
  if (warnings.length) {
    if (lines.length) lines.push('');
    lines.push(`${countLabel(warnings.length, 'point', 'points')} à vérifier (sans bloquer) :`);
    lines.push(...warnings.slice(0, 3).map((i) => `• ${formatIssue(i)}`));
    if (warnings.length > 3) lines.push(`• et ${warnings.length - 3} de plus`);
  }
  lines.push('', 'Le détail, avec un lien vers chaque champ, est en tête du formulaire.');
  return lines.join('\n');
}

function DocumentValidationSummary(props: ObjectInputProps) {
  const { schemaType, value, onPathFocus } = props;
  const documentId = getPublishedId(String(value?._id ?? props.id));
  const { validation } = useValidationStatus(documentId, schemaType.name, true);
  const issues = useMemo(
    () => describeValidation(schemaType, value, validation.filter((m) => m.level !== 'info')),
    [schemaType, value, validation],
  );
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');

  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const groups = (schemaType as ObjectSchemaType).groups ?? [];
    root.current?.querySelectorAll<HTMLElement>('[data-testid^="group-tab-"]').forEach((tab) => {
      const name = tab.dataset.testid!.slice('group-tab-'.length);
      const fields = name === ALL_FIELDS ? null : new Set(groups.find((g) => g.name === name)?.fields?.map((f) => f.name));
      const mine = issues.filter((i) => !fields || (i.field && fields.has(i.field)));
      if (mine.length) tab.title = tabTooltip(mine);
      else tab.removeAttribute('title');
    });
  });

  return (
    <div ref={root}>
      <Stack space={4}>
        {errors.length > 0 && (
          <IssueList
            issues={errors}
            tone="critical"
            icon={<ErrorOutlineIcon />}
            heading={`Publication bloquée : ${countLabel(errors.length, 'erreur à corriger', 'erreurs à corriger')}`}
            onOpen={(i) => onPathFocus(i.path)}
          />
        )}
        {warnings.length > 0 && (
          <IssueList
            issues={warnings}
            tone="caution"
            icon={<WarningOutlineIcon />}
            heading={`${countLabel(warnings.length, 'point', 'points')} à vérifier — n’empêche pas de publier`}
            onOpen={(i) => onPathFocus(i.path)}
          />
        )}
        {props.renderDefault(props)}
      </Stack>
    </div>
  );
}

/** `form.components.input` : le résumé sur la racine d'un document, le natif partout ailleurs. */
export function FormInputWithSummary(props: InputProps) {
  if (props.id === 'root' && props.schemaType.type?.name === 'document') {
    return <DocumentValidationSummary {...(props as ObjectInputProps)} />;
  }
  return props.renderDefault(props);
}
