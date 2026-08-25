import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, Flex, Stack, Text, TextInput } from '@sanity/ui';
import { CloseIcon, SearchIcon } from '@sanity/icons';
import { useRouter } from 'sanity/router';

import { useFacetedSearch } from '@/lib/search';
import type { Primitive } from '@/lib/search';

import { photoSearchConfig } from './photoSearchConfig';
import {
  rebaseDrafts,
  type PhotoIndexRow,
  type PhotoRecord,
} from './photoIndexQuery';

const MAX_PHOTO_SUGGESTIONS = 6;

export type ThumbFn = (
  image: { asset?: { _ref: string } } | null | undefined,
  size: number
) => string | null;

/**
 * La carte de recherche du Tableau de bord.
 *
 * Un SEUL champ porte les deux intentions : le texte libre et les facettes. Les
 * valeurs de facette sont PROPOSÉES dans la liste déroulante, jamais exigées
 * sous forme de syntaxe — c'est ce qui rend le filtrage avancé accessible sans
 * rien apprendre (spec §5.2).
 *
 * ⚠️ Toute ligne cliquable composite est un `<Card as="button">` et JAMAIS un
 * `<Button>` : `ButtonProps` de `@sanity/ui` v3 n'expose pas `children`, une
 * ligne passée en enfant ne s'afficherait pas — sans erreur, typecheck vert
 * (CLAUDE.md §11.13).
 */
export function SearchCard({ rows }: { rows: PhotoIndexRow[] }) {
  const router = useRouter();
  const docs = useMemo(() => rebaseDrafts(rows), [rows]);
  const { text, setText, chips, toggleFacet, clearAll, isPristine, result } =
    useFacetedSearch<PhotoRecord>(docs, photoSearchConfig);

  const inputRef = useRef<HTMLInputElement>(null);
  const [cursor, setCursor] = useState(0);

  const openPhoto = useCallback(
    (id: string) => router.navigateIntent('edit', { id, type: 'photo' }),
    [router]
  );

  // Les deux natures de la liste déroulante, dans l'ordre où elles s'affichent.
  const options = useMemo(
    () => [
      ...result.hits
        .slice(0, MAX_PHOTO_SUGGESTIONS)
        .map((hit) => ({ kind: 'photo' as const, hit })),
      ...result.suggestions.map((suggestion) => ({
        kind: 'facet' as const,
        suggestion,
      })),
    ],
    [result.hits, result.suggestions]
  );

  useEffect(() => setCursor(0), [text, chips.length]);

  /**
   * `/` met le focus dans le champ — SAUF si le focus est déjà dans une zone de
   * saisie, sinon on ne pourrait plus taper de slash nulle part dans le Studio.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** Pose un jeton et vide le mot en cours de frappe. */
  const applySuggestion = useCallback(
    (facetKey: string, value: Primitive) => {
      toggleFacet(facetKey, value);
      setText('');
      inputRef.current?.focus();
    },
    [toggleFacet, setText]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((c) => Math.min(c + 1, options.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        const option = options[cursor];
        if (!option) return;
        event.preventDefault();
        if (option.kind === 'facet') {
          applySuggestion(option.suggestion.facetKey, option.suggestion.value);
        } else {
          openPhoto(option.hit.doc.id);
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (text !== '') setText('');
        else clearAll();
        return;
      }
      // Sur un champ VIDE, Backspace retire le dernier jeton — l'affordance que
      // tout le monde attend d'un champ à jetons, et dont l'absence se remarque.
      if (event.key === 'Backspace' && text === '' && chips.length > 0) {
        event.preventDefault();
        const last = chips[chips.length - 1];
        toggleFacet(last.facetKey, last.value);
      }
    },
    [
      options,
      cursor,
      text,
      chips,
      applySuggestion,
      setText,
      clearAll,
      toggleFacet,
      openPhoto,
    ]
  );

  return (
    <Card padding={4} radius={2} shadow={1}>
      <Stack space={3}>
        <Flex gap={2} align="center" wrap="wrap">
          <Box paddingRight={1}>
            <Text muted>
              <SearchIcon />
            </Text>
          </Box>

          {chips.map((chip) => (
            <Card
              key={`${chip.facetKey}:${chip.value}`}
              as="button"
              __unstable_focusRing
              padding={2}
              radius={2}
              tone="primary"
              onClick={() => toggleFacet(chip.facetKey, chip.value)}
              title={`Retirer le filtre « ${chip.label} »`}
            >
              <Flex gap={2} align="center">
                <Text size={1}>{chip.label}</Text>
                <Text size={1} muted>
                  <CloseIcon />
                </Text>
              </Flex>
            </Card>
          ))}

          <Box flex={1} style={{ minWidth: 220 }}>
            <TextInput
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.currentTarget.value)}
              onKeyDown={onKeyDown}
              placeholder="Chercher une photo — titre, lieu, année, boîtier…   ( / )"
              border={false}
              fontSize={2}
            />
          </Box>

          {!isPristine && (
            <Button
              mode="bleed"
              fontSize={1}
              text="Tout effacer"
              onClick={clearAll}
            />
          )}
        </Flex>

        {options.length > 0 && (
          <Stack space={1}>
            {options.map((option, i) =>
              option.kind === 'photo' ? (
                <Card
                  key={`p:${option.hit.doc.id}`}
                  as="button"
                  __unstable_focusRing
                  padding={2}
                  radius={2}
                  tone={i === cursor ? 'primary' : 'default'}
                  onClick={() => openPhoto(option.hit.doc.id)}
                >
                  <Flex justify="space-between" gap={3}>
                    <Text size={1}>{option.hit.doc.title ?? 'Sans titre'}</Text>
                    <Text size={1} muted>
                      {[option.hit.doc.year, option.hit.doc.location]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Flex>
                </Card>
              ) : (
                <Card
                  key={`f:${option.suggestion.facetKey}:${option.suggestion.value}`}
                  as="button"
                  __unstable_focusRing
                  padding={2}
                  radius={2}
                  tone={i === cursor ? 'primary' : 'transparent'}
                  onClick={() =>
                    applySuggestion(
                      option.suggestion.facetKey,
                      option.suggestion.value
                    )
                  }
                >
                  <Flex justify="space-between" gap={3}>
                    <Text size={1}>{option.suggestion.label}</Text>
                    <Text size={1} muted>
                      {option.suggestion.facetLabel.toLowerCase()} ·{' '}
                      {option.suggestion.count}
                    </Text>
                  </Flex>
                </Card>
              )
            )}
          </Stack>
        )}

        {!isPristine && (
          <Text size={1} muted>
            {result.total} résultat{result.total > 1 ? 's' : ''}
          </Text>
        )}

        {result.didYouMean && (
          <Card padding={3} radius={2} tone="caution">
            <Flex gap={2} align="center" wrap="wrap">
              <Text size={1}>Aucun résultat. Chercher</Text>
              <Button
                mode="bleed"
                fontSize={1}
                text={result.didYouMean}
                onClick={() => setText(result.didYouMean ?? '')}
              />
              <Text size={1}>?</Text>
            </Flex>
          </Card>
        )}
      </Stack>
    </Card>
  );
}
