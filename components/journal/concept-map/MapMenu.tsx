'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { ChevronLeft, ChevronRight, SlidersHorizontal, X, type LucideIcon } from 'lucide-react';
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
 * - chaque catégorie s'enroule sur son en-tête, indépendamment des autres : on
 *   ne garde dépliées que celles dont on se sert (mémorisé dans ce navigateur) ;
 * - le repli se commande par une languette posée sur le bord du menu, à
 *   mi-hauteur — la poignée de panneau de Google Maps : on la trouve sans la
 *   chercher, et elle ne partage sa ligne avec rien ;
 * - au pied, un bloc à part, un ton plus bas encore : les compteurs, « Tout
 *   montrer », puis « Réglages », seul sur sa ligne, qui déplie ses
 *   glissières vers le haut ;
 * - sur téléphone, pas de colonne : une rangée d'icônes au-dessus de la carte,
 *   chacune ouvre sa catégorie dans un tiroir qui monte du bas.
 *
 * La liste du menu défile seule ; à ses bouts, le défilement passe à la page
 * (pas d'`overscroll-behavior: contain`) : on sort du menu sans lâcher le geste.
 *
 * Un clic sur une icône de la bande rouvre le menu À cette catégorie, dépliée.
 * Le menu se replie de lui-même quand une thèse ou un mécanisme choisi dans la
 * liste s'allume sur la carte — c'est `ConceptMapExplorer` qui le décide.
 */

export type MenuSection = {
  id: string;
  icon: LucideIcon;
  label: string;
  /** Un filtre de la catégorie trie la carte, ou son nœud est allumé : un voyant. */
  lit?: boolean;
  /** Affiché dans l'en-tête : le nombre d'entrées. */
  count?: number;
  body: ReactNode;
};

/**
 * Ouvert : la verticale du titre de la page (`--map-menu-open`, cf. `.map-frame`
 * dans globals.css) — 272 px, la colonne de filtres d'avant (220) plus l'icône
 * et son retrait, là où le titre n'est pas calé par le rail.
 */
const MENU_OPEN = 'var(--map-menu-open, 272px)';
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

const OPEN_KEY = 'concept-map:sections';
/** Dépliées au premier passage : les filtres. L'index (thèses, mécanismes) est long, il attend qu'on le demande. */
const OPEN_DEFAULT = ['view', 'series', 'themes', 'structures'];

type Labels = { menu: string; collapse: string; expand: string; settings: string; close: string };

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
  const [unrolled, setUnrolled] = useState<ReadonlySet<string>>(() => new Set(OPEN_DEFAULT));
  const full = useRef<HTMLDivElement>(null);
  const tuneId = useId();
  const asideId = useId();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? 'null');
      if (Array.isArray(saved) && saved.every((x) => typeof x === 'string')) setUnrolled(new Set(saved));
    } catch {}
  }, []);
  const roll = useCallback((id: string, on: boolean) => {
    setUnrolled((u) => {
      if (u.has(id) === on) return u;
      const next = new Set(u);
      if (on) next.add(id);
      else next.delete(id);
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

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

  // Rouvert depuis une icône : on descend jusqu'à sa catégorie, une fois le contenu revenu et déplié.
  useEffect(() => {
    if (!open || !target) return;
    const id = window.setTimeout(() => {
      full.current?.querySelector(`[data-section="${target}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      setTarget(null);
    }, OPEN_MS + FOLDER_MS);
    return () => window.clearTimeout(id);
  }, [open, target]);

  const reveal = (id: string) => {
    if (id === 'settings') setTuning(true);
    else roll(id, true);
    setTarget(id);
    onOpen(true);
  };

  const t = (ms: number, ease: string, delay = 0) => (motion ? `${ms}ms ${ease} ${delay}ms` : '0ms');
  const settingsOpen = tuning && !!settings;
  const edge = open ? MENU_OPEN : `${MENU_SHUT}px`;
  const slide = open ? t(OPEN_MS, EASE_OUT) : t(CLOSE_MS, EASE_INOUT, FADE_MS / 2);

  return (
    <>
      <aside
        id={asideId}
        ref={asideRef}
        aria-label={labels.menu}
        className="relative hidden shrink-0 overflow-hidden border-r border-[var(--color-line)] bg-[var(--color-bg-raised)] motion-reduce:!transition-none md:block"
        style={{ width: edge, transition: `width ${slide}` }}
      >
        {/* Le menu ouvert, à largeur fixe : la colonne qui se resserre le rogne, le texte ne se recompose pas. */}
        <div
          ref={full}
          inert={!open}
          className="absolute inset-y-0 left-0 flex flex-col motion-reduce:!transition-none"
          style={{ width: MENU_OPEN, opacity: open ? 1 : 0, transition: `opacity ${open ? t(160, EASE_OUT, OPEN_MS / 2) : t(FADE_MS, EASE_IN)}` }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            {sections.map((s) => (
              <Section key={s.id} section={s} open={unrolled.has(s.id)} onToggle={() => roll(s.id, !unrolled.has(s.id))} />
            ))}
          </div>
          <div className="flex flex-col border-t border-[var(--color-line)] bg-[var(--color-bg-elev)]">
            <div className="flex flex-col gap-2" style={{ padding: `14px 16px 14px ${PAD_LEFT + INDENT}px` }}>
              {counts}
            </div>
            {settings && (
              <>
                <div
                  id={tuneId}
                  inert={!settingsOpen}
                  className="grid transition-[grid-template-rows] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                  style={{ gridTemplateRows: settingsOpen ? '1fr' : '0fr', transitionDuration: `${FOLDER_MS}ms` }}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div data-section="settings" className="border-t border-[var(--color-line)]" style={{ padding: `14px 16px 4px ${PAD_LEFT + INDENT}px` }}>
                      {settings}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  aria-expanded={settingsOpen}
                  aria-controls={tuneId}
                  onClick={() => setTuning((v) => !v)}
                  className={cn(
                    MICRO_LABEL,
                    'flex w-full items-center gap-[10px] border-t border-[var(--color-line)] text-left transition-colors duration-200 motion-reduce:transition-none',
                    settingsOpen ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
                  )}
                  style={{ height: 46, paddingLeft: PAD_LEFT, paddingRight: 16 }}
                >
                  <SlidersHorizontal aria-hidden size={ICON} strokeWidth={1.75} className="flex-none" />
                  {labels.settings}
                  <span aria-hidden className="flex-1" />
                  {/* Les glissières montent : le chevron pointe vers elles. */}
                  <Chevron turned={settingsOpen ? 90 : -90} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* La bande : une icône par catégorie, au même endroit que dans le menu ouvert. */}
        <div
          inert={open}
          className="absolute inset-y-0 left-0 flex flex-col motion-reduce:!transition-none"
          style={{ width: MENU_SHUT, opacity: open ? 0 : 1, transition: `opacity ${open ? t(80, EASE_IN) : t(140, EASE_OUT, CLOSE_MS)}` }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {sections.map((s) => (
              <StripButton key={s.id} icon={s.icon} label={s.label} lit={s.lit} onClick={() => reveal(s.id)} />
            ))}
          </div>
          {settings && (
            <div className="border-t border-[var(--color-line)] bg-[var(--color-bg-elev)]">
              <StripButton icon={SlidersHorizontal} label={labels.settings} onClick={() => reveal('settings')} />
            </div>
          )}
        </div>
      </aside>

      {/* La languette : sur le bord du menu, à mi-hauteur, elle suit la colonne qui se resserre. */}
      <button
        type="button"
        aria-controls={asideId}
        aria-expanded={open}
        aria-label={open ? labels.collapse : labels.expand}
        title={`${open ? labels.collapse : labels.expand} ( [ )`}
        onClick={() => onOpen(!open)}
        className="absolute top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-r-[6px] border border-l-0 border-[color-mix(in_srgb,var(--color-fg)_22%,transparent)] bg-[var(--color-bg-raised)] text-[var(--color-fg)] shadow-[2px_1px_6px_rgba(10,10,10,0.12)] hover:bg-[var(--color-bg-elev)] focus-visible:bg-[var(--color-bg-elev)] motion-reduce:!transition-none md:flex"
        style={{ left: `calc(${edge} - 1px)`, width: 24, height: 64, transition: `left ${slide}, background-color 200ms` }}
      >
        {/* Encre pleine et trait appuyé (2026-10-30, Alexandre : « bien plus évident, sans être flashy »). */}
        {open ? <ChevronLeft aria-hidden size={18} strokeWidth={2.5} /> : <ChevronRight aria-hidden size={18} strokeWidth={2.5} />}
      </button>

      <PhoneBar sections={sections} counts={counts} settings={settings} labels={labels} sheet={sheet} onSheet={onSheet} />
    </>
  );
}

function Chevron({ turned }: { turned: number }) {
  return (
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
      className="flex-none transition-[rotate] duration-200 ease-out motion-reduce:transition-none"
      style={{ rotate: `${turned}deg` }}
    >
      <path d="M2.75 1.25 5.5 4 2.75 6.75" />
    </svg>
  );
}

function Section({ section: s, open, onToggle }: { section: MenuSection; open: boolean; onToggle: () => void }) {
  const Icon = s.icon;
  const bodyId = useId();
  return (
    <section data-section={s.id} aria-label={s.label} className="border-b border-[var(--color-line)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
        className={cn(
          MICRO_LABEL,
          'flex w-full items-center gap-[10px] text-left transition-colors duration-200 motion-reduce:transition-none',
          open ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
        )}
        style={{ height: 46, paddingLeft: PAD_LEFT, paddingRight: 16 }}
      >
        <Icon aria-hidden size={ICON} strokeWidth={1.75} className="flex-none" />
        <span className="min-w-0 truncate">{s.label}</span>
        <StateDot on={!open && !!s.lit} />
        <span aria-hidden className="flex-1" />
        {s.count != null && <span className="tabular-nums font-normal">{s.count}</span>}
        <Chevron turned={open ? 90 : 0} />
      </button>
      <div
        id={bodyId}
        inert={!open}
        className="grid transition-[grid-template-rows] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? '1fr' : '0fr', transitionDuration: `${FOLDER_MS}ms` }}
      >
        <div className="min-h-0 overflow-hidden">
          <div style={{ padding: `0 16px 14px ${PAD_LEFT + INDENT}px` }}>{s.body}</div>
        </div>
      </div>
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
    ...sections.map((s) => ({ id: s.id, icon: s.icon, label: s.label, lit: s.lit, body: s.body })),
    ...(settings ? [{ id: 'settings', icon: SlidersHorizontal, label: labels.settings, lit: false, body: settings }] : []),
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
              'relative flex flex-1 items-center justify-center border-r border-[var(--color-line)] transition-colors duration-200 last:border-r-0 motion-reduce:transition-none',
              sheet === id ? 'bg-[var(--color-bg-elev)] text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]',
            )}
            style={{ height: 48 }}
          >
            <Icon aria-hidden size={ICON} strokeWidth={1.75} />
            {lit && <span aria-hidden className="absolute rounded-full bg-[var(--color-link)]" style={{ width: 5, height: 5, top: 10, right: 'calc(50% - 15px)' }} />}
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
