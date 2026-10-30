'use client';

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { ChevronsLeft, ChevronsRight, SlidersHorizontal, X, type LucideIcon } from 'lucide-react';
import { StateDot } from '@/components/site/StateDot';
import { FOLDER_MS } from '@/components/journal/FolderTree';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';

/**
 * Le menu de la Concept Map, en dashboard (2026-10-30, Alexandre — variantes
 * A, V3, P1, jeu d'icônes explicite, tiroir sur téléphone) :
 *
 * - dès 768 px, une colonne collée au bord gauche de l'écran, un ton sous le
 *   papier, filet à droite, filets entre les catégories. Elle se replie en une
 *   bande d'icônes et la carte prend la place (elle POUSSE la carte, elle ne
 *   passe pas dessus) ;
 * - au pied, un bloc à part, un ton plus bas encore : les compteurs, « Tout
 *   montrer », « Réglages » qui déplie ses glissières vers le haut, et le
 *   bouton qui replie ;
 * - sur téléphone, pas de colonne : une rangée d'icônes au-dessus de la carte,
 *   chacune ouvre sa catégorie dans un tiroir qui monte du bas.
 *
 * Un clic sur une icône de la bande rouvre le menu À cette catégorie. Le menu
 * se replie de lui-même quand une thèse ou un mécanisme choisi dans la liste
 * s'allume sur la carte — c'est `ConceptMapExplorer` qui le décide.
 */

export type MenuSection = {
  id: string;
  icon: LucideIcon;
  label: string;
  /** Un filtre de la catégorie trie la carte, ou son nœud est allumé : un voyant sur l'icône. */
  lit?: boolean;
  body: ReactNode;
  /** Catégorie repliable (thèses, mécanismes) : fermée, seul son en-tête reste. */
  fold?: { open: boolean; onToggle: () => void; count: number };
};

/** Ouvert : la colonne de filtres d'avant (220) plus l'icône et son retrait. */
export const MENU_OPEN = 272;
const MENU_SHUT = 52;
const ICON = 18;
/** L'icône centrée dans la bande : elle ne bouge pas d'un pixel quand le menu se replie. */
const PAD_LEFT = (MENU_SHUT - ICON) / 2;
/** Le texte d'une catégorie s'aligne sur son titre, pas sur l'icône. */
const INDENT = ICON + 10;

/** Repli : le contenu s'efface d'abord, puis la colonne se resserre (ease-in-out, elle se pose sur la bande). */
export const CLOSE_MS = 240;
/** Ouverture : la colonne s'élargit et freine (ease-out), le contenu arrive ensuite. */
const OPEN_MS = 280;
const FADE_MS = 120;
const EASE_INOUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_IN = 'cubic-bezier(0.55, 0, 1, 0.45)';

type Labels = {
  menu: string;
  collapse: string;
  expand: string;
  settings: string;
  close: string;
};

export function MapMenu({
  open,
  onOpen,
  sheet,
  onSheet,
  sections,
  counts,
  settings,
  labels,
  asideRef,
}: {
  open: boolean;
  onOpen: (open: boolean) => void;
  /** Téléphone : la catégorie ouverte dans le tiroir (`settings` pour les réglages). */
  sheet: string | null;
  onSheet: (id: string | null) => void;
  sections: MenuSection[];
  /** Les compteurs et « Tout montrer ». */
  counts: ReactNode;
  /** Les glissières ; `null` hors de la vue carte. */
  settings: ReactNode | null;
  labels: Labels;
  asideRef: Ref<HTMLElement>;
}) {
  const [tuning, setTuning] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const full = useRef<HTMLDivElement>(null);
  const tuneId = useId();

  // Pas de transition avant que le menu ait relu sa mémoire : un menu laissé
  // replié ne doit pas se replier sous les yeux au chargement.
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => (b = requestAnimationFrame(() => setMotion(true))));
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, []);

  // Rouvert depuis une icône : on descend jusqu'à sa catégorie, une fois le contenu revenu.
  useEffect(() => {
    if (!open || !target) return;
    const id = window.setTimeout(
      () => {
        full.current?.querySelector(`[data-section="${target}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        setTarget(null);
      },
      OPEN_MS + (sections.find((s) => s.id === target)?.fold ? FOLDER_MS : 0),
    );
    return () => window.clearTimeout(id);
  }, [open, target, sections]);

  const reveal = (id: string) => {
    const s = sections.find((x) => x.id === id);
    if (s?.fold && !s.fold.open) s.fold.onToggle();
    if (id === 'settings') setTuning(true);
    setTarget(id);
    onOpen(true);
  };

  const t = (ms: number, ease: string, delay = 0) => (motion ? `${ms}ms ${ease} ${delay}ms` : '0ms');
  const settingsOpen = tuning && !!settings;

  return (
    <>
      <aside
        ref={asideRef}
        aria-label={labels.menu}
        className="relative hidden shrink-0 overflow-hidden border-r border-[var(--color-line)] bg-[var(--color-bg-raised)] motion-reduce:!transition-none md:block"
        style={{
          width: open ? MENU_OPEN : MENU_SHUT,
          transition: `width ${open ? t(OPEN_MS, EASE_OUT) : t(CLOSE_MS, EASE_INOUT, FADE_MS / 2)}`,
        }}
      >
        {/* Le menu ouvert, à largeur fixe : la colonne qui se resserre le rogne, le texte ne se recompose pas. */}
        <div
          ref={full}
          inert={!open}
          className="absolute inset-y-0 left-0 flex flex-col motion-reduce:!transition-none"
          style={{
            width: MENU_OPEN,
            opacity: open ? 1 : 0,
            transition: `opacity ${open ? t(160, EASE_OUT, OPEN_MS / 2) : t(FADE_MS, EASE_IN)}`,
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {sections.map((s) => (
              <Section key={s.id} section={s} />
            ))}
          </div>
          <div className="flex flex-col border-t border-[var(--color-line)] bg-[var(--color-bg-elev)]">
            {settings && (
              <div
                id={tuneId}
                inert={!settingsOpen}
                className="grid transition-[grid-template-rows] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                style={{
                  gridTemplateRows: settingsOpen ? '1fr' : '0fr',
                  transitionDuration: `${FOLDER_MS}ms`,
                }}
              >
                <div className="min-h-0 overflow-hidden">
                  <div data-section="settings" className="border-b border-[var(--color-line)]" style={{ padding: `14px 16px 4px ${PAD_LEFT + INDENT}px` }}>
                    {settings}
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2" style={{ padding: `14px 16px 12px ${PAD_LEFT + INDENT}px` }}>
              {counts}
            </div>
            <div className="flex items-center justify-between border-t border-[var(--color-line)]" style={{ paddingLeft: PAD_LEFT, paddingRight: 8 }}>
              {settings ? (
                <button
                  type="button"
                  aria-expanded={settingsOpen}
                  aria-controls={tuneId}
                  onClick={() => setTuning((v) => !v)}
                  className={cn(
                    MICRO_LABEL,
                    'flex items-center gap-[10px] transition-colors duration-200 motion-reduce:transition-none',
                    settingsOpen ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
                  )}
                  style={{ height: 44 }}
                >
                  <SlidersHorizontal aria-hidden size={ICON} strokeWidth={1.75} />
                  {labels.settings}
                </button>
              ) : (
                <span />
              )}
              <IconButton label={labels.collapse} onClick={() => onOpen(false)}>
                <ChevronsLeft aria-hidden size={ICON} strokeWidth={1.75} />
              </IconButton>
            </div>
          </div>
        </div>

        {/* La bande : une icône par catégorie, au même endroit que dans le menu ouvert. */}
        <div
          inert={open}
          className="absolute inset-y-0 left-0 flex flex-col motion-reduce:!transition-none"
          style={{
            width: MENU_SHUT,
            opacity: open ? 0 : 1,
            transition: `opacity ${open ? t(80, EASE_IN) : t(140, EASE_OUT, CLOSE_MS)}`,
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {sections.map((s) => (
              <StripButton key={s.id} icon={s.icon} label={s.label} lit={s.lit} onClick={() => reveal(s.id)} />
            ))}
          </div>
          <div className="flex flex-col border-t border-[var(--color-line)] bg-[var(--color-bg-elev)]">
            {settings && <StripButton icon={SlidersHorizontal} label={labels.settings} onClick={() => reveal('settings')} />}
            <StripButton icon={ChevronsRight} label={labels.expand} onClick={() => onOpen(true)} />
          </div>
        </div>
      </aside>

      <PhoneBar sections={sections} counts={counts} settings={settings} labels={labels} sheet={sheet} onSheet={onSheet} />
    </>
  );
}

function Section({ section: s }: { section: MenuSection }) {
  const Icon = s.icon;
  const bodyId = useId();
  const head = (
    <>
      <Icon aria-hidden size={ICON} strokeWidth={1.75} className="flex-none" />
      <span className="min-w-0 truncate">{s.label}</span>
    </>
  );
  return (
    <section data-section={s.id} aria-label={s.label} className="border-b border-[var(--color-line)]" style={{ padding: `14px 16px 14px ${PAD_LEFT}px` }}>
      {s.fold ? (
        <>
          <button
            type="button"
            aria-expanded={s.fold.open}
            aria-controls={bodyId}
            onClick={s.fold.onToggle}
            className={cn(
              MICRO_LABEL,
              'flex w-full items-center gap-[10px] text-left transition-colors duration-200 motion-reduce:transition-none',
              s.fold.open ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
            )}
          >
            {head}
            <StateDot on={!s.fold.open && !!s.lit} />
            <span aria-hidden className="flex-1" />
            <span className="tabular-nums font-normal">{s.fold.count}</span>
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
              className={cn('flex-none transition-[rotate] duration-200 ease-out motion-reduce:transition-none', s.fold.open && 'rotate-90')}
            >
              <path d="M2.75 1.25 5.5 4 2.75 6.75" />
            </svg>
          </button>
          <div
            id={bodyId}
            inert={!s.fold.open}
            className="grid transition-[grid-template-rows] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              gridTemplateRows: s.fold.open ? '1fr' : '0fr',
              transitionDuration: `${FOLDER_MS}ms`,
            }}
          >
            <div className="min-h-0 overflow-hidden" style={{ paddingLeft: INDENT }}>
              {s.body}
            </div>
          </div>
        </>
      ) : (
        <>
          <p className={cn(MICRO_LABEL, 'flex items-center gap-[10px] text-[var(--color-fg-faint)]')}>{head}</p>
          <div style={{ paddingLeft: INDENT, paddingTop: 8 }}>{s.body}</div>
        </>
      )}
    </section>
  );
}

function StripButton({ icon: Icon, label, lit = false, onClick }: { icon: LucideIcon; label: string; lit?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="relative flex w-full flex-none items-center justify-center border-b border-[var(--color-line)] text-[var(--color-fg-muted)] transition-colors duration-200 last:border-b-0 hover:text-[var(--color-fg)] focus-visible:text-[var(--color-fg)] motion-reduce:transition-none"
      style={{ height: 46 }}
    >
      <Icon aria-hidden size={ICON} strokeWidth={1.75} />
      {lit && <span aria-hidden className="absolute rounded-full bg-[var(--color-link)]" style={{ width: 5, height: 5, top: 11, right: 11 }} />}
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex items-center justify-center text-[var(--color-fg-muted)] transition-colors duration-200 hover:text-[var(--color-fg)] focus-visible:text-[var(--color-fg)] motion-reduce:transition-none"
      style={{ width: 36, height: 44 }}
    >
      {children}
    </button>
  );
}

/** Le tiroir monte en 300 ms et freine ; il redescend plus vite, en prenant son élan. */
const SHEET_IN = 300;
export const SHEET_OUT = 220;

/**
 * Téléphone : la rangée d'icônes, les compteurs dessous, et le tiroir. Le
 * tiroir garde sa dernière catégorie le temps de redescendre.
 */
function PhoneBar({
  sections,
  counts,
  settings,
  labels,
  sheet,
  onSheet,
}: {
  sections: MenuSection[];
  counts: ReactNode;
  settings: ReactNode | null;
  labels: Labels;
  sheet: string | null;
  onSheet: (id: string | null) => void;
}) {
  const [shown, setShown] = useState<string | null>(sheet);
  useEffect(() => {
    if (sheet) return setShown(sheet);
    const id = window.setTimeout(() => setShown(null), SHEET_OUT);
    return () => window.clearTimeout(id);
  }, [sheet]);
  useEffect(() => {
    if (!sheet) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onSheet(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [sheet, onSheet]);

  const items = [
    ...sections.map((s) => ({
      id: s.id,
      icon: s.icon,
      label: s.label,
      lit: s.lit,
      body: s.body,
    })),
    ...(settings
      ? [
          {
            id: 'settings',
            icon: SlidersHorizontal,
            label: labels.settings,
            lit: false,
            body: settings,
          },
        ]
      : []),
  ];
  const current = items.find((i) => i.id === shown);
  const up = !!sheet && !!current;

  return (
    <div className="flex flex-col gap-3 md:hidden">
      <div role="toolbar" aria-label={labels.menu} className="flex border-y border-[var(--color-line)] bg-[var(--color-bg-raised)]">
        {items.map(({ id, icon: Icon, label, lit }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-expanded={sheet === id}
            onClick={() => onSheet(sheet === id ? null : id)}
            className={cn(
              'relative flex flex-1 items-center justify-center border-r border-[var(--color-line)] last:border-r-0 transition-colors duration-200 motion-reduce:transition-none',
              sheet === id ? 'bg-[var(--color-bg-elev)] text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]',
            )}
            style={{ height: 48 }}
          >
            <Icon aria-hidden size={ICON} strokeWidth={1.75} />
            {lit && (
              <span
                aria-hidden
                className="absolute rounded-full bg-[var(--color-link)]"
                style={{
                  width: 5,
                  height: 5,
                  top: 10,
                  right: 'calc(50% - 15px)',
                }}
              />
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2" style={{ paddingInline: 'var(--page-gutter)' }}>
        {counts}
      </div>

      <div
        aria-hidden
        onClick={() => onSheet(null)}
        className={cn('fixed inset-0 z-40 bg-[rgba(10,10,10,0.18)] transition-opacity motion-reduce:transition-none', up ? 'opacity-100' : 'pointer-events-none opacity-0')}
        style={{ transitionDuration: `${up ? SHEET_IN : SHEET_OUT}ms` }}
      />
      <div
        role="dialog"
        aria-label={current?.label}
        inert={!up}
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col border-t border-[var(--color-line)] bg-[var(--color-bg-raised)] shadow-[0_-2px_12px_rgba(0,0,0,0.08)] transition-[translate] motion-reduce:transition-none"
        style={{
          maxHeight: '72dvh',
          translate: up ? '0 0' : '0 100%',
          transitionDuration: `${up ? SHEET_IN : SHEET_OUT}ms`,
          transitionTimingFunction: up ? EASE_OUT : EASE_IN,
        }}
      >
        {current && (
          <>
            <div className="flex items-center justify-between border-b border-[var(--color-line)]" style={{ padding: '0 8px 0 var(--page-gutter)' }}>
              <p className={cn(MICRO_LABEL, 'flex items-center gap-[10px] text-[var(--color-fg)]')}>
                <current.icon aria-hidden size={ICON} strokeWidth={1.75} />
                {current.label}
              </p>
              <button
                type="button"
                aria-label={labels.close}
                onClick={() => onSheet(null)}
                className="flex items-center justify-center text-[var(--color-fg-muted)]"
                style={{ width: 44, height: 48 }}
              >
                <X aria-hidden size={ICON} strokeWidth={1.75} />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain" style={{ padding: '16px var(--page-gutter) 32px' }}>
              {current.body}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
