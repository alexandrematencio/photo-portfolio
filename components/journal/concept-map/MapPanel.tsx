'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { TagSwatch } from '@/components/journal/TagSwatch';
import { frenchSpaces } from '@/lib/journal/french';
import { DICT, quoteMarks, type Lang } from '@/lib/journal/i18n';
import { EDITORIAL_H3, JOURNAL_LINK_DECORATION, MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import type { MapViewNode } from '@/lib/journal/conceptMapData';
import type { MapIndex } from './model';

/**
 * Le panneau d'un nœud choisi sur la carte (ou dans la liste) :
 *   thèse      sa place dans l'article, sa citation, « Lire le passage → » ;
 *   mécanisme  sa définition, les articles qui l'emploient et leurs passages, ses rimes ;
 *   article    chapô, série, ses thèses dans l'ordre.
 * Les noms de nœuds sont des boutons : on se promène dans la carte sans la
 * quitter. Les liens « Lire » mènent au paragraphe (`PassageArrival`).
 */

const QUOTE = 'font-[family-name:var(--font-quote)] text-[18px] font-medium leading-[1.35] text-[var(--color-fg)]';
const TEXT = 'text-[15px] font-medium leading-[1.5] text-[var(--color-fg)]';
const SUBHEAD = cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]');

export function ReadLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={cn(JOURNAL_LINK_DECORATION, 'group w-fit text-[15px] font-bold')}>
      {children}{' '}
      <span aria-hidden className="inline-block no-underline transition-[translate] duration-200 ease-out group-hover:translate-x-[3px] group-focus-visible:translate-x-[3px] motion-reduce:transition-none">
        →
      </span>
    </Link>
  );
}

function NodeButton({ node, onSelect, children }: { node: MapViewNode; onSelect: (id: string) => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className="text-left text-[15px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--color-fg)] underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-200 hover:decoration-current focus-visible:decoration-current motion-reduce:transition-none"
    >
      {children ?? frenchSpaces(node.label)}
    </button>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-[var(--color-line)]" style={{ paddingTop: 16 }}>
      <h3 className={SUBHEAD}>{title}</h3>
      {children}
    </section>
  );
}

function Quote({ text, lang }: { text: string; lang: Lang }) {
  const [open, close] = quoteMarks(lang);
  return <blockquote className={QUOTE}>{frenchSpaces(`${open}${text}${close}`)}</blockquote>;
}

export function MapPanel({ ix, id, onSelect, onClose }: { ix: MapIndex; id: string; onSelect: (id: string) => void; onClose?: () => void }) {
  const node = ix.byId.get(id);
  if (!node) return null;
  const article = (aid: string) => ix.byId.get(aid);
  const lang = ix.view.lang;
  const t = DICT[lang].map;

  let kicker: ReactNode;
  let body: ReactNode;
  if (node.kind === 'thesis') {
    const a = article(node.articles[0]);
    const siblings = ix.thesesOfArticle.get(node.articles[0]) ?? [];
    const mechs = (ix.mechsOfThesis.get(id) ?? []).map((m) => ix.byId.get(m)!).filter(Boolean);
    kicker = t.thesisOf(siblings.indexOf(id) + 1, siblings.length);
    body = (
      <>
        {node.quote && <Quote text={node.quote} lang={lang} />}
        <ReadLink href={node.href}>{t.readPassage}</ReadLink>
        {a && (
          <Block title={t.inArticle}>
            <NodeButton node={a} onSelect={onSelect} />
          </Block>
        )}
        {mechs.length > 0 && (
          <Block title={t.mechanismsUsed(mechs.length)}>
            <ul className="flex flex-col gap-2">
              {mechs.map((m) => (
                <li key={m.id} className="flex items-baseline gap-2">
                  <TagSwatch color={(m.theme && ix.themeColor.get(m.theme)) || null} />
                  <NodeButton node={m} onSelect={onSelect} />
                </li>
              ))}
            </ul>
          </Block>
        )}
      </>
    );
  } else if (node.kind === 'mechanism') {
    const theses = (ix.thesesOfMech.get(id) ?? []).map((t) => ix.byId.get(t)!).filter(Boolean);
    const rhymes = ix.rhymes.get(id) ?? [];
    kicker = (
      <span className="flex items-center gap-2">
        {t.mechanism}
        {node.theme && (
          <>
            <span aria-hidden>·</span>
            <TagSwatch color={ix.themeColor.get(node.theme) ?? null} />
            {node.theme}
          </>
        )}
      </span>
    );
    body = (
      <>
        {node.definition && <p className={TEXT}>{frenchSpaces(node.definition)}</p>}
        {node.quote && <Quote text={node.quote} lang={lang} />}
        {node.quote && node.href && <ReadLink href={node.href}>{t.readPassage}</ReadLink>}
        <Block title={t.usedIn(node.articles.length)}>
          <ul className="flex flex-col gap-4">
            {node.articles.map((aid) => {
              const a = article(aid);
              if (!a) return null;
              return (
                <li key={aid} className="flex flex-col gap-2">
                  <NodeButton node={a} onSelect={onSelect} />
                  <ul className="flex flex-col gap-1.5" style={{ paddingLeft: 14 }}>
                    {theses
                      .filter((th) => th.articles[0] === aid)
                      .map((th) => (
                        <li key={th.id} className="flex flex-col gap-0.5">
                          <NodeButton node={th} onSelect={onSelect}>
                            <span className="font-medium">{frenchSpaces(th.label)}</span>
                          </NodeButton>
                          <Link href={th.href} className={cn(JOURNAL_LINK_DECORATION, 'w-fit text-[13px] font-bold')}>
                            {t.readPassage} →
                          </Link>
                        </li>
                      ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Block>
        {rhymes.length > 0 && (
          <Block title={t.rhymes(rhymes.length)}>
            <ul className="flex flex-col gap-3">
              {rhymes.map((r) => {
                const m = ix.byId.get(r.id);
                if (!m) return null;
                return (
                  <li key={r.id} className="flex flex-col gap-1">
                    <NodeButton node={m} onSelect={onSelect} />
                    {r.why && <p className="text-[13px] leading-[1.45] text-[var(--color-fg-muted)]">{frenchSpaces(r.why)}</p>}
                  </li>
                );
              })}
            </ul>
          </Block>
        )}
      </>
    );
  } else {
    const theses = (ix.thesesOfArticle.get(id) ?? []).map((t) => ix.byId.get(t)!).filter(Boolean);
    kicker = node.series ? `${node.series}${node.part ? ` · ${t.part(node.part)}` : ''}` : t.article;
    body = (
      <>
        {node.dek && <p className={TEXT}>{frenchSpaces(node.dek)}</p>}
        <ReadLink href={node.href}>{t.readArticle}</ReadLink>
        <Block title={t.thesesHeading(theses.length)}>
          <ol className="flex flex-col gap-2">
            {theses.map((t, i) => (
              <li key={t.id} className="flex items-baseline gap-3">
                <span className={cn(MICRO_LABEL, 'w-4 flex-none text-[var(--color-fg-muted)]')}>{i + 1}</span>
                <NodeButton node={t} onSelect={onSelect} />
              </li>
            ))}
          </ol>
        </Block>
      </>
    );
  }

  return (
    <div key={id} className="concept-panel flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <p className={SUBHEAD}>{kicker}</p>
        {/* Dans l'article, c'est l'en-tête du tiroir qui ferme (ArticleMap). */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={DICT[lang].close}
            className={cn(MICRO_LABEL, '-mt-1 text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] focus-visible:text-[var(--color-fg)] motion-reduce:transition-none')}
            style={{ padding: 4 }}
          >
            <svg aria-hidden width={12} height={12} viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        )}
      </div>
      <h2 className={EDITORIAL_H3}>{frenchSpaces(node.label)}</h2>
      {body}
    </div>
  );
}
