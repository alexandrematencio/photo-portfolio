import { Select, Stack, Text } from '@sanity/ui';
import { set, unset, useFormValue, type StringInputProps } from 'sanity';

/**
 * Le choix d'une référence dans un « Appel de référence » du journal
 * (`journalNoteRef.refKey`). La valeur stockée est le `_key` d'une entrée du
 * champ `references` de l'article : l'auteur la choisit dans une liste qui
 * montre la référence en clair, il ne tape jamais une clé.
 *
 * La liste se lit sur le DOCUMENT (`useFormValue(['references'])`), donc une
 * référence ajoutée en bas du formulaire y apparaît aussitôt, sans Publish.
 */

type Span = { text?: string };
type Ref = { _key: string; citation?: { children?: Span[] }[] };

function citationText(ref: Ref) {
  return (ref.citation ?? []).map((b) => (b.children ?? []).map((c) => c.text ?? '').join('')).join(' ');
}

export function NoteRefInput(props: StringInputProps) {
  const refs = (useFormValue(['references']) as Ref[] | undefined) ?? [];
  const { value, onChange, readOnly } = props;
  const known = refs.some((r) => r._key === value);

  if (refs.length === 0) {
    return (
      <Text size={1} muted>
        L’article n’a encore aucune référence. Les ajouter dans le champ « Références », en bas du formulaire, puis revenir ici.
      </Text>
    );
  }

  return (
    <Stack space={2}>
      <Select
        value={value ?? ''}
        disabled={readOnly}
        onChange={(e) => {
          const next = e.currentTarget.value;
          onChange(next ? set(next) : unset());
        }}
      >
        <option value="">— Choisir une référence —</option>
        {value && !known && <option value={value}>⚠ Référence introuvable ({value})</option>}
        {refs.map((r) => (
          <option key={r._key} value={r._key}>
            {citationText(r).slice(0, 110) || r._key}
          </option>
        ))}
      </Select>
    </Stack>
  );
}
