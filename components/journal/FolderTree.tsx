'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { StateDot } from '@/components/site/StateDot';
import { TagSwatch } from '@/components/journal/TagSwatch';
import { cn } from '@/lib/utils/cn';
import type { FolderState } from '@/lib/journal/folder-memory';

/**
 * L'ARBORESCENCE DE FILTRES du journal, sortie de `JournalIndex` le
 * 2026-10-29 pour servir aussi à la Concept Map (thèses/, mécanismes/).
 * Rien n'y a changé, sauf le nombre d'une entrée, devenu facultatif.
 */

/** Une entrée : clé, libellé, nombre (facultatif), pastille de couleur. */
export type Filter = { key: string; label: string; count?: number; color?: string | null };

/** Padding vertical d'une ligne de choix ; la branche de l'arborescence se cale sur le centre de sa première ligne. */
export const ITEM_PAD = 6;

/**
 * « séries/ » et « thématiques/ » (2026-10-24, demande Alexandre : les
 * onglets ne disaient pas assez qu'on passe de l'un à l'autre ; le téléphone a
 * suivi le même jour). Une arborescence de serveur, volontairement
 * rudimentaire : deux dossiers l'un sous l'autre, un seul ouvert. Ce qui le
 * fait comprendre : le chevron qui tourne, l'icône de dossier qui s'ouvre, la barre oblique et la
 * fonte à chasse fixe des noms, le nombre d'entrées au fer droit, et les
 * branches qui raccrochent chaque entrée à son dossier. Le dossier fermé
 * reste en vue à sa place : on voit ce qu'on peut ouvrir.
 *
 * L'ordre ne bouge jamais (séries au-dessus). Ouvrir l'un ferme l'autre, et,
 * comme les onglets d'avant, ne touche à aucun filtre : le voyant d'un dossier
 * FERMÉ dit qu'il trie encore. Le contenu se déplie en hauteur
 * (`grid-template-rows` 0fr → 1fr, aucune hauteur mesurée) ; replié, il est
 * `inert` — ni focus clavier ni lecteur d'écran dans une liste invisible.
 */

/** Retrait des entrées sous leur dossier : la branche part du milieu du chevron. */
export const TREE_INDENT = 22;

/** Abscisse de la branche verticale : le centre du chevron (8 px). */
const TREE_TRUNK = 4;

export function Folder({
  id,
  name,
  state,
  settled,
  onToggle,
  lit,
  entries,
  roomy = false,
  peek,
  children,
}: {
  id: string;
  name: string;
  /** `peek` : chevron baissé, seul l'aperçu est déplié (premier passage). */
  state: FolderState;
  /** Faux jusqu'à la relecture de la mémoire : aucune transition avant. */
  settled: boolean;
  onToggle: () => void;
  /** L'aperçu du premier passage : l'entrée courante et « voir les n … ». */
  peek: ReactNode;
  /** Son filtre trie-t-il encore ? Ne s'affiche que dossier fermé. */
  lit: boolean;
  /** Nombre d'entrées du dossier, « Tout » exclu. */
  entries: number;
  /** Téléphone : une ligne plus haute, à la mesure d'un doigt. */
  roomy?: boolean;
  /** Le contenu : `FolderList` (desktop) ou `FolderFlow` (téléphone). */
  children: ReactNode;
}) {
  const open = state === 'open';
  const down = state !== 'closed';
  const motion = settled ? `${FOLDER_MS}ms` : '0ms';
  // Le rognage ne sert qu'au dépliage : une fois ouvert, le contenu déborde
  // librement (un anneau de focus, un tiroir posé en `absolute`).
  const [clip, setClip] = useState(true);
  useEffect(() => {
    if (!open) return setClip(true);
    const id = window.setTimeout(() => setClip(false), FOLDER_MS);
    return () => window.clearTimeout(id);
  }, [open]);
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-[8px] text-left font-mono text-[13px] leading-none transition-colors duration-200 motion-reduce:transition-none',
          down ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
        )}
        style={{ paddingBlock: roomy ? 12 : 8 }}
      >
        <svg
          aria-hidden
          width={8}
          height={8}
          viewBox="0 0 8 8"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn('flex-none transition-[rotate] duration-200 ease-out motion-reduce:transition-none', down && 'rotate-90')}
        >
          <path d="M2.75 1.25 5.5 4 2.75 6.75" />
        </svg>
        <FolderIcon open={down} />
        <span className="min-w-0 truncate">{name.toLocaleLowerCase()}/</span>
        <StateDot on={!open && lit} />
        {/* Le reset de `globals.css` remet les marges à zéro : un `ml-auto` serait avalé. */}
        <span aria-hidden className="flex-1" />
        <span className="tabular-nums text-[var(--color-fg-muted)]">{entries}</span>
      </button>
      {/* Deux régions empilées : l'aperçu se replie pendant que la liste se
          déplie, la hauteur passe de l'une à l'autre sans rien mesurer. */}
      <div
        inert={state !== 'peek'}
        className="grid transition-[grid-template-rows] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ gridTemplateRows: state === 'peek' ? '1fr' : '0fr', transitionDuration: motion }}
      >
        <div className="min-h-0 overflow-hidden">{peek}</div>
      </div>
      <div
        id={id}
        inert={!open}
        className="grid transition-[grid-template-rows] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? '1fr' : '0fr', transitionDuration: motion }}
      >
        <div className={cn('min-h-0', clip && 'overflow-hidden')}>{children}</div>
      </div>
    </div>
  );
}

/** Durée du dépliage d'un dossier. */
export const FOLDER_MS = 300;

/** Un trait de l'arborescence : le tronc (arrêté au rameau sur la dernière entrée, └) et le rameau. */
function Branch({ y, last }: { y: number | string; last: boolean }) {
  return (
    <>
      <span
        aria-hidden
        className="absolute w-px bg-[var(--color-fg-muted)] opacity-40"
        style={{ left: TREE_TRUNK, top: 0, height: last ? y : '100%' }}
      />
      <span
        aria-hidden
        className="absolute h-px bg-[var(--color-fg-muted)] opacity-40"
        style={{ left: TREE_TRUNK, top: y, width: TREE_INDENT - TREE_TRUNK - 6 }}
      />
    </>
  );
}

/**
 * Une entrée de dossier, façon `ls` (2026-10-24, Alexandre) : chasse fixe,
 * minuscules, le nombre d'articles entre parenthèses, estompé. Le choix actif passe à
 * l'encre et en gras, voyant allumé. La chasse fixe la sépare aussi des
 * thématiques en capitales sous chaque ligne de l'index : un filtre ne se
 * confond pas avec une étiquette.
 */
function LsEntry({
  filter: f,
  on,
  onChange,
  dash = false,
  type = 'ls',
}: {
  filter: Filter;
  on: boolean;
  onChange: (key: string) => void;
  /** Tiret de tête, pour les entrées mises à la suite sur téléphone. */
  dash?: boolean;
  type?: EntryType;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(f.key)}
      className={cn(
        'flex items-center gap-[8px] text-left transition-colors duration-200 motion-reduce:transition-none',
        // L'interligne APRÈS la taille : tailwind-merge efface un `leading-*` placé avant un `text-[…px]`.
        ENTRY_TYPE[type],
        'leading-[1.3]',
        on ? 'text-[var(--color-fg)] font-bold' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
      )}
      style={{ paddingBlock: ITEM_PAD }}
    >
      <StateDot on={on} />
      <TagSwatch color={f.color ?? null} />
      <span>
        {dash && <span aria-hidden className="font-normal text-[var(--color-fg-muted)]">- </span>}
        {f.label.toLocaleLowerCase()} {f.count !== undefined && <span className="opacity-70">({f.count})</span>}
      </span>
    </button>
  );
}

/**
 * La fonte d'une entrée : `ls`, chasse fixe à 13 px (accueil du journal) ;
 * `index`, Switzer à 12 px (thèses/ et mécanismes/ de la Concept Map,
 * demande Alexandre du 2026-10-29).
 */
type EntryType = 'ls' | 'index';
const ENTRY_TYPE: Record<EntryType, string> = { ls: 'font-mono text-[13px]', index: 'font-[family-name:var(--font-index)] text-[12px]' };
const ENTRY_SIZE: Record<EntryType, number> = { ls: 13, index: 12 };

/** Centre de la première ligne d'une entrée : corps × 1,3 d'interligne. */
const branchY = (type: EntryType) => ITEM_PAD + (ENTRY_SIZE[type] * 1.3) / 2;

/** Desktop (`ls -1`) : une entrée par ligne, chacune sur sa branche. */
export function FolderList({
  items,
  isOn,
  onChange,
  type = 'ls',
  children,
}: {
  items: Filter[];
  isOn: (key: string) => boolean;
  onChange: (key: string) => void;
  type?: EntryType;
  children?: ReactNode;
}) {
  return (
    <>
      <ul className="flex flex-col" style={{ paddingBottom: 10 }}>
        {items.map((f, i) => (
          <li key={f.key} className="relative" style={{ paddingLeft: TREE_INDENT }}>
            <Branch y={branchY(type)} last={i === items.length - 1} />
            <LsEntry filter={f} on={isOn(f.key)} onChange={onChange} type={type} />
          </li>
        ))}
      </ul>
      {children}
    </>
  );
}

/**
 * Téléphone (`ls`) : les entrées à la suite, sur une seule branche (└). Une
 * par ligne pousserait l'index d'un écran entier vers le bas ; le champ
 * `ListSelector` qui était là cachait les choix et répétait le nom du dossier.
 */
export function FolderFlow({
  items,
  isOn,
  onChange,
  after,
}: {
  items: Filter[];
  isOn: (key: string) => boolean;
  onChange: (key: string) => void;
  after?: ReactNode;
}) {
  return (
    <div style={{ paddingBottom: 14 }}>
      <div className="relative" style={{ paddingLeft: TREE_INDENT }}>
        <Branch y={branchY('ls')} last />
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {items.map((f) => (
            <li key={f.key}>
              <LsEntry filter={f} on={isOn(f.key)} onChange={onChange} dash />
            </li>
          ))}
        </ul>
      </div>
      {after && <div style={{ paddingTop: 12, paddingLeft: TREE_INDENT }}>{after}</div>}
    </div>
  );
}

/**
 * L'aperçu d'un dossier au premier passage (2026-10-24, Alexandre) : l'entrée
 * courante sur sa branche (└, séries seulement) puis « voir les n … » en
 * italique, qui ouvre le dossier entier. Il dit qu'il y a des choix sans
 * pousser les premiers titres de l'index sous l'écran.
 */
export function FolderPeek({
  current,
  isOn,
  onChange,
  more,
  onMore,
}: {
  current?: Filter;
  isOn?: (key: string) => boolean;
  onChange?: (key: string) => void;
  more: string;
  onMore: () => void;
}) {
  return (
    <div className="flex flex-col" style={{ paddingBottom: 10 }}>
      {current && isOn && onChange && (
        <div className="relative" style={{ paddingLeft: TREE_INDENT }}>
          <Branch y={branchY('ls')} last />
          <LsEntry filter={current} on={isOn(current.key)} onChange={onChange} />
        </div>
      )}
      <button
        type="button"
        onClick={onMore}
        className="w-fit text-left font-mono text-[13px] italic leading-[1.3] text-[var(--color-fg-muted)] transition-colors duration-200 hover:text-[var(--color-fg)] motion-reduce:transition-none"
        style={{ paddingBlock: ITEM_PAD, marginLeft: TREE_INDENT }}
      >
        <span aria-hidden>- </span>
        {more}
      </button>
    </div>
  );
}

/** Le dossier de l'arborescence : fermé, un classeur ; ouvert, la face avant basculée. */
function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      width={15}
      height={15}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinejoin="round"
      className="flex-none"
    >
      {open ? (
        <>
          <path d="M2 12.5V3.5h4l1.5 1.5H12.5v2" />
          <path d="M2 12.5 4 7h10.5l-2 5.5z" />
        </>
      ) : (
        <path d="M2 12.5V3.5h4l1.5 1.5H14v7.5z" />
      )}
    </svg>
  );
}
