import Link from 'next/link';
import { DICT, articlePath, headingSeparator, quoteMarks, seriesPath, type Lang } from '@/lib/journal/i18n';
import { REFERENCES_ID, articleSections, headingSubject } from '@/lib/journal/sections';
import { frenchSpaces } from '@/lib/journal/french';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import {
  EDITORIAL_ANNEX,
  EDITORIAL_BODY,
  EDITORIAL_H2,
  EDITORIAL_LEAD,
  EDITORIAL_PULLQUOTE,
  EDITORIAL_SIDENOTE,
  JOURNAL_LINK_DECORATION,
  MICRO_LABEL,
} from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import { AUTHOR_NAME } from '@/lib/site/author';
import type { Article, ArticleSummary, Inline, InlineLink, InlineMark } from '@/lib/journal/types';
import { StateDot } from '@/components/site/StateDot';
import { DraftLabel, NoteCall, NoteRow, NotesProvider, type RowNote } from './Notes';
import { JournalFigure } from './figures';
import { ArticleImage } from './ArticleImage';
import { Highlight } from './Highlight';
import { PassageArrival } from './PassageArrival';
import { VerdictTable } from './VerdictTable';
import { DataTable } from './DataTable';
import { MapMark } from './concept-map/ArticleMap';

/** Les marques de la Concept Map, par clé de paragraphe (`ArticleView`). */
export type MapMarks = Record<string, { id: string; label: string; anchor: boolean }>;

/**
 * Corps d'un article du journal (brand book §14). Rythme vertical repris de
 * `RHYTHM` (PortableBody) — chapô 40, courant 24, H2 64 / 24 — et un cran
 * ajouté pour les objets que l'article introduit (figure, image, tableau) :
 * 64 de part et d'autre. L'exergue, elle, garde l'écart courant (24) dessus
 * et dessous (demande Alexandre, 2026-10-25) : à 64, ses deux filets se
 * lisaient comme un changement de partie. Marges en style inline : le reset
 * `* { margin: 0 }` avale les utilities (CLAUDE.md §7.5–7.8).
 */
const RHYTHM = { lead: 40, body: 24, h2Top: 64, h2Bottom: 24, object: 64 } as const;

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Numérotation : références en chiffres dans l'ordre de leur premier appel,
 * notes à trancher en lettres dans l'ordre du texte. Les deux suites ne se
 * mélangent pas — une question de l'auteur n'est pas une source. Une note à
 * trancher est identifiée par sa POSITION (bloc, rang), pas par son texte :
 * deux questions identiques restent deux notes.
 */
type Numbering = { refs: Map<string, string>; drafts: Map<Inline, string> };

function numberNotes(article: Article): Numbering {
  const refs = new Map<string, string>();
  const drafts = new Map<Inline, string>();
  for (const block of article.blocks) {
    if (block.type !== 'p') continue;
    for (const node of block.inline) {
      if (node.t === 'ref' && !refs.has(node.key)) refs.set(node.key, String(refs.size + 1));
      if (node.t === 'draft') drafts.set(node, LETTERS[drafts.size] ?? `z${drafts.size}`);
    }
  }
  return { refs, drafts };
}

function renderMarked(text: string, marks: InlineMark[], key: number): ReactNode {
  let node: ReactNode = frenchSpaces(text);
  if (marks.includes('cite')) {
    // Titre d'œuvre : la graisse remplace l'italique (brand book §5.2).
    node = <cite className="not-italic font-bold">{node}</cite>;
  }
  if (marks.includes('em')) node = <em>{node}</em>;
  if (marks.includes('strong')) node = <strong>{node}</strong>;
  return <Fragment key={key}>{node}</Fragment>;
}

/** Un passage lié. Sans adresse (article cible non résolu, aperçu du Studio) : la couleur seule. */
function renderLinked(node: ReactNode, link: InlineLink, key: number): ReactNode {
  if (!('href' in link)) return <span key={key} className={JOURNAL_LINK_DECORATION}>{node}</span>;
  if (link.href.startsWith('/'))
    return <Link key={key} href={link.href} className={JOURNAL_LINK_DECORATION}>{node}</Link>;
  return (
    <a key={key} href={link.href} target="_blank" rel="noopener noreferrer" className={JOURNAL_LINK_DECORATION}>
      {node}
    </a>
  );
}

const lit = (node: Inline | undefined) => node?.t === 'text' && node.marks.includes('highlight');

/**
 * Les passages surlignés qui se suivent forment UN seul trait : une emphase
 * ou un lien au milieu d'une phrase surlignée la découpe en plusieurs spans,
 * et autant de `<mark>` partiraient ensemble au lieu de courir d'un bout à
 * l'autre. Un appel de note pris entre deux passages surlignés reste dans le trait.
 */
function renderInline(nodes: Inline[], numbering?: Numbering): ReactNode[] {
  const out: ReactNode[] = [];
  let run: ReactNode[] = [];
  const flush = (i: number) => {
    if (run.length) out.push(<Highlight key={`hl${i}`}>{run}</Highlight>);
    run = [];
  };
  renderNodes(nodes, numbering).forEach((rendered, i) => {
    const node = nodes[i];
    const bridged = node.t !== 'text' && run.length > 0 && lit(nodes.slice(i + 1).find((n) => n.t === 'text'));
    if (lit(node) || bridged) run.push(rendered);
    else {
      flush(i);
      out.push(rendered);
    }
  });
  flush(nodes.length);
  return out;
}

function renderNodes(nodes: Inline[], numbering?: Numbering): ReactNode[] {
  return nodes.map((node, i) => {
    if (node.t === 'text') {
      const marked = renderMarked(node.text, node.marks, i);
      return node.link ? renderLinked(marked, node.link, i) : marked;
    }
    if (!numbering) return null;
    if (node.t === 'ref') {
      const id = numbering.refs.get(node.key);
      return id ? <NoteCall key={i} id={id} kind="ref" href={`#ref-${node.key}`} /> : null;
    }
    const id = numbering.drafts.get(node)!;
    return <NoteCall key={i} id={id} kind="draft" href={`#sn-${id}`} />;
  });
}

function notesOf(nodes: Inline[], article: Article, numbering: Numbering): RowNote[] {
  const notes: RowNote[] = [];
  for (const node of nodes) {
    if (node.t === 'ref') {
      const ref = article.references.find((r) => r.key === node.key);
      const id = numbering.refs.get(node.key);
      if (ref && id) notes.push({ id, kind: 'ref', body: renderInline(ref.citation) });
    } else if (node.t === 'draft') {
      notes.push({ id: numbering.drafts.get(node)!, kind: 'draft', body: frenchSpaces(node.text) });
    }
  }
  // Une référence appelée deux fois dans le même paragraphe n'a qu'une note.
  return notes.filter((n, i) => notes.findIndex((m) => m.id === n.id) === i);
}

/**
 * H2 d'article. La plupart des intertitres d'Alexandre sont construits
 * « sujet : verdict » (« La douleur fabriquée : convergence nette »). Le
 * sujet fait la dalle en capitales ; le verdict descend en étiquette sous
 * elle — même balise, la phrase reste entière pour un lecteur d'écran.
 */
function ArticleH2({ id, text, style, lang }: { id: string; text: string; style: CSSProperties; lang: Lang }) {
  const sep = headingSeparator(lang);
  const subject = headingSubject(text, lang);
  const verdict = subject === text ? null : text.slice(subject.length + sep.length);
  return (
    // `scrollMarginTop` : atteint par le sommaire, l'intertitre ne colle pas
    // au bord du conteneur de défilement.
    <h2 id={id} className={EDITORIAL_H2} style={{ scrollMarginTop: 32, ...style }}>
      {frenchSpaces(subject)}
      {verdict && (
        <>
          <span className="sr-only">{sep}</span>
          <span
            // `w-fit` : en bloc pleine largeur, l'étiquette ferait mur dans la
            // marge de notes (`flowSidenotes` mesure ce qui est DESSINÉ).
            className={cn(MICRO_LABEL, 'block w-fit tracking-normal leading-[1.2] text-[var(--color-fg-muted)]')}
            style={{ marginTop: 14 }}
          >
            {frenchSpaces(verdict)}
          </span>
        </>
      )}
    </h2>
  );
}

/**
 * La série à laquelle appartient l'article, en fin de lecture : les parties
 * dans l'ordre, la partie courante allumée (`StateDot`, l'orange dit « vous
 * êtes ici »), les autres en liens.
 */
function SeriesNav({ current, parts, style, lang }: { current: string; parts: ArticleSummary[]; style: CSSProperties; lang: Lang }) {
  const t = DICT[lang];
  const line = t.seriesLine(parts[0]?.series ?? '', parts.length);
  return (
    <nav aria-label={t.seriesNav(parts[0]?.series ?? '')} className="flex flex-col gap-4" style={style}>
      {parts[0]?.seriesSlug ? (
        <Link
          href={seriesPath(parts[0].seriesSlug, lang)}
          className={cn(MICRO_LABEL, 'group flex items-center justify-between text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')}
        >
          <span>{line}</span>
          <span aria-hidden className="transition-[translate] duration-200 ease-out group-hover:translate-x-[3px] motion-reduce:transition-none">
            →
          </span>
        </Link>
      ) : (
        <span className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')}>{line}</span>
      )}
      <ol className="flex flex-col" style={{ borderTop: '1px solid var(--color-line)' }}>
        {parts.map((p) => {
          const here = p.slug === current;
          return (
            <li key={p.slug} style={{ borderBottom: '1px solid var(--color-line)' }}>
              <Link
                href={articlePath(p.slug, p.lang)}
                aria-current={here ? 'page' : undefined}
                className="flex items-baseline gap-3 group"
                style={{ paddingBlock: 14 }}
              >
                <span className="flex self-center">
                  <StateDot on={here} />
                </span>
                <span className={cn(MICRO_LABEL, 'w-6 shrink-0 text-[var(--color-fg-muted)]')}>{p.part}</span>
                <span
                  className={cn(
                    'text-[19px] md:text-[24px] font-bold tracking-[-0.02em] leading-[1.25]',
                    here ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)]',
                  )}
                >
                  {frenchSpaces(p.title)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ArticleBody({
  article,
  series,
  signature,
  marks,
}: {
  article: Article;
  series: ArticleSummary[];
  signature: string;
  marks?: MapMarks;
}) {
  const lang = article.lang;
  const t = DICT[lang];
  const [open, close] = quoteMarks(lang);
  const numbering = numberNotes(article);
  const { idByBlock } = articleSections(article);
  const callsOf = new Map<string, string[]>();
  for (const [key, id] of numbering.refs) callsOf.set(key, [...(callsOf.get(key) ?? []), id]);
  const blocks = article.blocks;
  const leadIndex = blocks.findIndex((b) => b.type === 'p');
  // Les figures sont numérotées dans l'ordre de l'article : la boucle est Fig. 1
  // dans un texte, Fig. 3 dans un autre.
  const figureNumber = new Map<number, number>();
  blocks.forEach((b, i) => b.type === 'figure' && figureNumber.set(i, figureNumber.size + 1));

  return (
    <NotesProvider lang={lang}>
      <div className="flex flex-col">
        <noscript>
          <style>{'.journal-hl{background-size:100% 100%!important}'}</style>
        </noscript>
        <PassageArrival />
        {blocks.map((block, i) => {
          const prev = blocks[i - 1];
          const afterObject =
            prev &&
            (prev.type === 'figure' || prev.type === 'image' || prev.type === 'table' || prev.type === 'verdicts');
          const top = (base: number) => (i === 0 ? 0 : afterObject ? RHYTHM.object : base);

          switch (block.type) {
            case 'p': {
              const notes = notesOf(block.inline, article, numbering);
              const isLead = i === leadIndex;
              // Ancre du passage : `#p-<clé>` (cf. `PassageArrival`).
              const passage = block.key ? { id: `p-${block.key}`, className: 'journal-passage' } : { className: undefined };
              const after = prev?.type === 'h2' ? RHYTHM.h2Bottom : i - 1 === leadIndex ? RHYTHM.lead : RHYTHM.body;
              const m = block.key ? marks?.[block.key] : undefined;
              const mark = m && <MapMark {...m} />;
              if (isLead && notes.length === 0) {
                return (
                  <p key={i} {...passage} className={cn(EDITORIAL_LEAD, passage.className)} style={{ marginTop: top(0) }}>
                    {mark}
                    {renderInline(block.inline, numbering)}
                  </p>
                );
              }
              return (
                <NoteRow key={i} notes={notes} style={{ marginTop: top(isLead ? 0 : after) }}>
                  <p {...passage} className={cn(isLead ? EDITORIAL_LEAD : EDITORIAL_BODY, passage.className)}>
                    {mark}
                    {renderInline(block.inline, numbering)}
                  </p>
                </NoteRow>
              );
            }
            case 'h2':
              return <ArticleH2 key={i} id={idByBlock.get(i)!} text={block.text} lang={lang} style={{ marginTop: top(RHYTHM.h2Top) }} />;
            case 'quote':
              return (
                // Doublon visuel d'une phrase déjà dans le texte : masqué aux
                // lecteurs d'écran, qui la liraient deux fois. Deux filets, haut
                // ET bas : un seul se lisait comme un séparateur de sections.
                <aside
                  key={i}
                  aria-hidden
                  style={{
                    marginTop: top(RHYTHM.body),
                    // À la mesure, pas au-delà (2026-10-25) : débordant dans la
                    // marge, elle barrait la colonne de notes et repoussait le
                    // paragraphe d'avant.
                    maxWidth: 'var(--editorial-measure)',
                    borderTop: '1px solid var(--color-fg)',
                    borderBottom: '1px solid var(--color-fg)',
                    // Calés sur Newsreader (2026-10-22) : centre le bloc des
                    // capitales à la ligne de base entre les deux filets —
                    // mesuré, 29 px de part et d'autre (20/24 servaient
                    // Helvetica et laissaient le serif 5 px trop haut).
                    paddingTop: 25,
                    paddingBottom: 19,
                  }}
                >
                  <p className={EDITORIAL_PULLQUOTE}>
                    {open}
                    {frenchSpaces(block.text)}
                    {close}
                  </p>
                </aside>
              );
            case 'figure':
              return (
                <JournalFigure key={i} name={block.name} number={figureNumber.get(i)!} lang={lang} style={{ marginTop: RHYTHM.object }} />
              );
            case 'image':
              return (
                <ArticleImage
                  key={i}
                  image={block.image}
                  caption={block.caption}
                  wide={block.wide}
                  style={{ marginTop: top(RHYTHM.object) }}
                />
              );
            case 'table':
              return <DataTable key={i} head={block.head} rows={block.rows} style={{ marginTop: top(RHYTHM.object) }} />;
            case 'verdicts':
              return <VerdictTable key={i} lang={lang} rows={block.rows} style={{ marginTop: top(RHYTHM.h2Bottom) + 16 }} />;
            case 'draft':
              return (
                <aside
                  key={i}
                  className={cn(EDITORIAL_SIDENOTE, 'flex flex-col gap-1 max-w-[var(--editorial-measure)]')}
                  style={{
                    marginTop: top(RHYTHM.body),
                    borderLeft: '2px solid var(--color-line)',
                    paddingLeft: 14,
                  }}
                >
                  <DraftLabel lang={lang} />
                  <span>{frenchSpaces(block.text)}</span>
                </aside>
              );
          }
        })}

        {/* Qui écrit, à la fin du texte : le lecteur arrivé par un lien
            partagé n'a vu le nom nulle part ailleurs sur la page. */}
        <p
          className={EDITORIAL_ANNEX}
          style={{ marginTop: RHYTHM.h2Top, paddingTop: 20, borderTop: '1px solid var(--color-line)' }}
        >
          <strong className="font-bold">{AUTHOR_NAME}</strong> — {frenchSpaces(signature)}
        </p>

        {series.length > 1 && <SeriesNav current={article.slug} parts={series} lang={lang} style={{ marginTop: RHYTHM.h2Top + 32 }} />}

        {article.referenceCount > 0 && (
          <>
            <ArticleH2 id={REFERENCES_ID} text={t.referencesTitle} lang={lang} style={{ marginTop: RHYTHM.h2Top + 32 }} />
            {article.referencesNote && (
              <p className={cn(EDITORIAL_SIDENOTE, 'max-w-[var(--editorial-measure)]')} style={{ marginTop: RHYTHM.h2Bottom }}>
                {article.referencesNote}
              </p>
            )}
            <ul className="flex flex-col gap-3" style={{ marginTop: RHYTHM.body }}>
              {article.references.map(({ key, citation }) => {
                const calls = callsOf.get(key) ?? [];
                return (
                  <li key={key} id={`ref-${key}`} className={cn(EDITORIAL_ANNEX, 'scroll-mt-24 flex gap-3')}>
                    <span className="flex-1">{renderInline(citation)}</span>
                    {calls.length > 0 && (
                      <span className="shrink-0 flex gap-2">
                        {calls.map((n) => (
                          <a
                            key={n}
                            href={`#call-${n}`}
                            aria-label={t.backToCall(n)}
                            className={cn(MICRO_LABEL, 'relative top-[5px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')}
                          >
                            ↑{n}
                          </a>
                        ))}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </NotesProvider>
  );
}
