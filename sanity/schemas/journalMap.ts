/**
 * LA CONCEPT MAP DU JOURNAL (phase 3, docs/superpowers/plans/2026-10-28-journal-map.md).
 *
 * Singleton `journalMap`, écrit en BROUILLON par `npm run map:build -- --write`
 * depuis le vault Obsidian, qui fait foi. Tout est en lecture seule ici : une
 * thèse ou une rime se corrige dans le vault, puis on réexporte. Le seul geste
 * du Studio est Publish, qui rend la carte publique au prochain build.
 */
import { defineArrayMember, defineField, defineType } from 'sanity';

const KIND_LABEL: Record<string, string> = { article: 'Article', thesis: 'Thèse', mechanism: 'Mécanisme' };

const journalMapNode = defineType({
  name: 'journalMapNode',
  title: 'Nœud',
  type: 'object',
  readOnly: true,
  fields: [
    defineField({ name: 'nodeId', title: 'Identifiant', type: 'string' }),
    defineField({
      name: 'kind',
      title: 'Type',
      type: 'string',
      options: { list: Object.entries(KIND_LABEL).map(([value, title]) => ({ value, title })) },
    }),
    defineField({ name: 'label', title: 'Libellé', type: 'string' }),
    defineField({ name: 'slug', title: 'Adresse (article)', type: 'string' }),
    defineField({ name: 'series', title: 'Série', type: 'string' }),
    defineField({ name: 'part', title: 'Partie', type: 'number' }),
    defineField({ name: 'themes', title: 'Thématiques', type: 'array', of: [defineArrayMember({ type: 'string' })] }),
    defineField({ name: 'article', title: 'Article (thèse)', type: 'string' }),
    defineField({ name: 'order', title: 'Ordre', type: 'number' }),
    defineField({ name: 'definition', title: 'Définition', type: 'text', rows: 3 }),
    defineField({ name: 'quote', title: 'Citation', type: 'text', rows: 3 }),
    defineField({ name: 'quoteArticle', title: 'Article de la citation', type: 'string' }),
    defineField({ name: 'anchor', title: 'Paragraphe d’ancre (_key)', type: 'string' }),
    defineField({ name: 'section', title: 'Intertitre de repli (_key)', type: 'string' }),
    defineField({ name: 'covers', title: 'Paragraphes couverts', type: 'array', of: [defineArrayMember({ type: 'string' })] }),
    defineField({ name: 'print', title: 'Empreinte du paragraphe', type: 'string' }),
    defineField({ name: 'x', type: 'number' }),
    defineField({ name: 'y', type: 'number' }),
  ],
  preview: {
    select: { title: 'label', kind: 'kind', article: 'article', slug: 'slug', quoteArticle: 'quoteArticle' },
    prepare: ({ title, kind, article, slug, quoteArticle }) => ({
      title,
      subtitle: [KIND_LABEL[kind] ?? kind, (article ?? '').replace(/^a:/, '') || slug || quoteArticle].filter(Boolean).join(' · '),
    }),
  },
});

const journalMapEdge = defineType({
  name: 'journalMapEdge',
  title: 'Lien',
  type: 'object',
  readOnly: true,
  fields: [
    defineField({ name: 'source', type: 'string' }),
    defineField({ name: 'target', type: 'string' }),
    defineField({
      name: 'kind',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          { value: 'part', title: 'Thèse de l’article' },
          { value: 'next', title: 'Thèse suivante' },
          { value: 'uses', title: 'Emploie le mécanisme' },
          { value: 'rhyme', title: 'Rime' },
        ],
      },
    }),
    defineField({ name: 'why', title: 'Pourquoi (rime)', type: 'string' }),
  ],
  preview: {
    select: { source: 'source', target: 'target', kind: 'kind' },
    prepare: ({ source, target, kind }) => ({ title: `${source} → ${target}`, subtitle: kind }),
  },
});

/** Un libellé traduit (EN/RU), écrit par `npm run map:translate` (lib/journal/conceptMapI18n.ts). */
const journalMapText = defineType({
  name: 'journalMapText',
  title: 'Traduction',
  type: 'object',
  readOnly: true,
  fields: [
    defineField({ name: 'lang', title: 'Langue', type: 'string' }),
    defineField({ name: 'id', title: 'Nœud ou rime', type: 'string' }),
    defineField({ name: 'field', title: 'Texte', type: 'string' }),
    defineField({ name: 'text', title: 'Traduction', type: 'text', rows: 2 }),
    defineField({ name: 'src', title: 'Empreinte du français', type: 'string' }),
    defineField({ name: 'auto', title: 'Citation reprise de l’article traduit', type: 'boolean' }),
  ],
  preview: {
    select: { lang: 'lang', field: 'field', text: 'text', id: 'id' },
    prepare: ({ lang, field, text, id }) => ({ title: text, subtitle: `${String(lang).toUpperCase()} · ${field} · ${id}` }),
  },
});

export const journalMap = defineType({
  name: 'journalMap',
  title: 'Concept Map',
  type: 'document',
  readOnly: true,
  fieldsets: [{ name: 'data', title: 'Données exportées', options: { collapsible: true, collapsed: true } }],
  fields: [
    defineField({
      name: 'exportedAt',
      title: 'Exportée du vault le',
      type: 'datetime',
      description: 'Écrite par `npm run map:build -- --write`. Se corrige dans le vault Obsidian, jamais ici.',
    }),
    defineField({ name: 'nodes', title: 'Nœuds', type: 'array', fieldset: 'data', of: [defineArrayMember({ type: 'journalMapNode' })] }),
    defineField({ name: 'edges', title: 'Liens', type: 'array', fieldset: 'data', of: [defineArrayMember({ type: 'journalMapEdge' })] }),
    defineField({
      name: 'translations',
      title: 'Libellés en anglais et en russe',
      description: 'Écrits par `npm run map:translate`, publiés avec la carte.',
      type: 'array',
      fieldset: 'data',
      of: [defineArrayMember({ type: 'journalMapText' })],
    }),
  ],
  preview: {
    select: { exportedAt: 'exportedAt', nodes: 'nodes' },
    prepare: ({ exportedAt, nodes }) => ({
      title: 'Concept Map',
      subtitle: exportedAt ? `Export du ${String(exportedAt).slice(0, 10)} · ${(nodes ?? []).length} nœuds` : 'Pas encore exportée',
    }),
  },
});

export const journalMapSchemas = [journalMapNode, journalMapEdge, journalMapText, journalMap];
