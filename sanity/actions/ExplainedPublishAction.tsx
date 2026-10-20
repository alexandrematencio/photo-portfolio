import { useMemo } from 'react';
import { Stack, Text } from '@sanity/ui';
import { useTranslation, type DocumentActionComponent } from 'sanity';
import { structureLocaleNamespace, useDocumentPane } from 'sanity/structure';
import { countLabel, describeValidation, formatIssue } from '@/sanity/lib/validationSummary';

const MAX_LINES = 5;

/**
 * Le Publish NATIF, dont l'infobulle dit enfin POURQUOI il est grisé
 * (2026-10-20). Sanity le désactive dès qu'une erreur existe, avec une
 * phrase générique ; ici l'infobulle liste les erreurs elles-mêmes, dans les
 * mots du formulaire. Les autres raisons d'un Publish grisé (rien à publier,
 * document qui se charge…) sont traduites par `studioMessagesFr`.
 *
 * Ne remplace QUE la phrase générique de validation : un Publish grisé pour
 * une autre raison (droits insuffisants, rien à publier) garde la sienne,
 * qui reste la vraie.
 *
 * Enveloppe n'importe quelle action `publish`, y compris celle qui date la
 * première publication d'un article (`createDatedPublishAction`) : branchée
 * sur tous les types dans studio.config.ts.
 */
export function withExplainedPublish(original: DocumentActionComponent): DocumentActionComponent {
  const ExplainedPublishAction: DocumentActionComponent = (props) => {
    const result = original(props);
    const { schemaType, value, validation } = useDocumentPane();
    const { t } = useTranslation(structureLocaleNamespace);
    const errors = useMemo(
      () => describeValidation(schemaType, value, validation.filter((m) => m.level === 'error')),
      [schemaType, value, validation],
    );
    if (!result || !errors.length || result.title !== t('action.publish.validation-issues.tooltip')) return result;
    return {
      ...result,
      title: (
        <Stack space={3} style={{ maxWidth: 360 }}>
          <Text size={1} weight="semibold">
            {`Publication bloquée : ${countLabel(errors.length, 'erreur à corriger', 'erreurs à corriger')}`}
          </Text>
          {errors.slice(0, MAX_LINES).map((issue, i) => (
            <Text key={i} size={1}>
              {formatIssue(issue)}
            </Text>
          ))}
          <Text size={1} muted>
            {errors.length > MAX_LINES
              ? `Et ${errors.length - MAX_LINES} de plus. La liste complète est en tête du formulaire.`
              : 'Chaque erreur mène à son champ depuis la liste en tête du formulaire.'}
          </Text>
        </Stack>
      ),
    };
  };
  ExplainedPublishAction.action = 'publish';
  ExplainedPublishAction.displayName = 'ExplainedPublishAction';
  return ExplainedPublishAction;
}
