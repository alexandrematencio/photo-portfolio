'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import type { Dict } from '@/lib/journal/i18n';

/**
 * Les commandes posées sur le cadre de `/concept-map` (2026-10-30, Alexandre) :
 * « Aide ? » en haut à droite, le faux clavier de navigation en bas à droite.
 */

export type NavKey = 'up' | 'down' | 'left' | 'right' | 'in' | 'out' | 'reset';

/** Les touches du vrai clavier, une fois la carte « armée » (clic dans la carte, le menu ou le faux clavier). */
export const KEY_OF: Record<string, NavKey> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  '+': 'in',
  '=': 'in',
  '-': 'out',
  _: 'out',
  '0': 'reset',
};

type Labels = Dict['map'];

const GLYPH: Record<Exclude<NavKey, 'reset'>, string> = {
  up: 'M1.5 5 4 2.5 6.5 5',
  down: 'M1.5 3 4 5.5 6.5 3',
  left: 'M5 1.5 2.5 4 5 6.5',
  right: 'M3 1.5 5.5 4 3 6.5',
  in: 'M4 1.5v5M1.5 4h5',
  out: 'M1.5 4h5',
};

/** Côté d'une touche : 3 × 17 + 2 × 2 = 55 px, sous les 1,5 cm demandés (≈ 57 px). */
const KEY = 17;
const GAP = 2;

/**
 * Le faux clavier : une interface d'an 2000 relue en minimal — touches en
 * léger relief (dégradé de papier, liseré d'ombre dessous), qui s'enfoncent
 * d'un pixel en 100 ms, et un voyant qui s'allume quand le vrai clavier
 * pilote la carte. Les vraies touches enfoncent aussi les fausses : on voit
 * ce qu'on fait.
 *
 * Tenir une flèche (pointeur ou clavier) fait glisser la carte ; le reste agit
 * à l'appui. Au clavier, Entrée ou Espace sur une fausse touche donne un pas.
 */
export function MapKeys({ t, armed, lit, onPress }: { t: Labels; armed: boolean; lit: ReadonlySet<NavKey>; onPress: (k: NavKey, on: boolean) => void }) {
  const key = (k: NavKey, label: string, glyph: ReactNode, wide = false) => (
    <button
      key={k}
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        onPress(k, true);
      }}
      onPointerUp={() => onPress(k, false)}
      onPointerCancel={() => onPress(k, false)}
      onLostPointerCapture={() => onPress(k, false)}
      onClick={(e) => {
        if (e.detail !== 0) return;
        onPress(k, true);
        window.setTimeout(() => onPress(k, false), 180);
      }}
      data-on={lit.has(k) || undefined}
      className={cn(
        'flex touch-none select-none items-center justify-center rounded-[3px] border border-[var(--color-line)]',
        'bg-[linear-gradient(#ffffff,#f3f1ec)] shadow-[inset_0_-1px_0_rgba(10,10,10,0.07),0_1px_0_rgba(10,10,10,0.05)]',
        'transition-[translate,box-shadow,color] duration-100 ease-out motion-reduce:transition-none',
        'data-[on]:translate-y-px data-[on]:bg-[linear-gradient(#ecebe6,#f6f5f1)] data-[on]:shadow-[inset_0_1px_1px_rgba(10,10,10,0.12)]',
        armed ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
        wide && 'col-span-3 justify-between',
      )}
      style={{ height: KEY, paddingInline: wide ? 5 : 0 }}
    >
      {glyph}
    </button>
  );
  const chevron = (k: Exclude<NavKey, 'reset'>) => (
    <svg aria-hidden width={8} height={8} viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={GLYPH[k]} />
    </svg>
  );
  return (
    <div role="group" aria-label={t.keys.group} className="grid" style={{ gridTemplateColumns: `repeat(3, ${KEY}px)`, gap: GAP }}>
      {key('out', t.keys.out, chevron('out'))}
      {key('up', t.keys.up, chevron('up'))}
      {key('in', t.keys.in, chevron('in'))}
      {key('left', t.keys.left, chevron('left'))}
      {key('down', t.keys.down, chevron('down'))}
      {key('right', t.keys.right, chevron('right'))}
      {key(
        'reset',
        t.keys.reset,
        <>
          {/* Le voyant : allumé tant que les flèches du clavier pilotent la carte. */}
          <span
            aria-hidden
            className="rounded-full transition-[background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none"
            style={{
              width: 4,
              height: 4,
              backgroundColor: armed ? 'var(--color-link)' : 'var(--color-line)',
              boxShadow: armed ? '0 0 4px var(--color-link)' : 'none',
            }}
          />
          <svg aria-hidden width={9} height={9} viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round">
            <path d="M1 3V1h2M6 1h2v2M8 6v2H6M3 8H1V6" />
          </svg>
          <span aria-hidden style={{ width: 4 }} />
        </>,
        true,
      )}
    </div>
  );
}

/**
 * « Aide ? » : un mot, pas une icône seule — on le trouve en le cherchant,
 * il ne réclame rien sinon. Ouvre une fiche non modale sous lui : les gestes,
 * puis les touches. Se ferme sur Échap, sur « ? », d'un clic ailleurs ou sur ×.
 */
export function MapHelp({ t, open, onOpen }: { t: Labels; open: boolean; onOpen: (open: boolean) => void }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', esc, true);
    };
  }, [open, onOpen]);

  return (
    <div ref={box} className="pointer-events-auto relative flex flex-col items-end">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onOpen(!open)}
        className={cn(
          MICRO_LABEL,
          'font-medium transition-colors duration-200 motion-reduce:transition-none',
          open ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-visible:text-[var(--color-fg)]',
        )}
        style={{ paddingBlock: 2 }}
      >
        {t.help}
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={t.helpTitle}
          className="map-help absolute right-0 top-full overflow-y-auto border border-[var(--color-line)] bg-[var(--color-bg-raised)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
          style={{ marginTop: 8, width: 'min(300px, calc(100vw - 56px))', maxHeight: 'min(480px, calc(100dvh - 14rem))', padding: 16 }}
        >
          <div className="flex items-start justify-between gap-4">
            <p className="text-[14px] font-medium leading-[18px] text-[var(--color-fg)]">{t.helpTitle}</p>
            <button type="button" aria-label={t.close} onClick={() => onOpen(false)} className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]" style={{ padding: 3 }}>
              <svg aria-hidden width={10} height={10} viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </button>
          </div>
          <HelpTable title={t.helpMouseTitle} rows={t.helpMouse} />
          <HelpTable title={t.helpKeysTitle} rows={t.helpKeys} kbd note={t.helpKeysArm} />
          <p className="text-[12px] leading-[17px] text-[var(--color-fg-muted)]" style={{ marginTop: 14 }}>
            {t.helpLabels}
          </p>
        </div>
      )}
    </div>
  );
}

function HelpTable({ title, rows, kbd = false, note }: { title: string; rows: readonly (readonly [string, string])[]; kbd?: boolean; note?: string }) {
  return (
    <div style={{ marginTop: 14 }}>
      <p className={cn(MICRO_LABEL, 'text-[var(--color-fg-faint)]')}>{title}</p>
      {note && (
        <p className="text-[12px] leading-[17px] text-[var(--color-fg-muted)]" style={{ marginTop: 6 }}>
          {note}
        </p>
      )}
      <dl className="grid items-baseline gap-x-3 gap-y-1.5" style={{ gridTemplateColumns: 'max-content 1fr', marginTop: 8 }}>
        {rows.map(([how, what]) => (
          <div key={how} className="contents">
            <dt className="text-[12px] leading-[17px] text-[var(--color-fg)]">
              {kbd
                ? how.split(' ').map((k) => (
                    <kbd
                      key={k}
                      className="mr-1 inline-flex min-w-[17px] justify-center rounded-[3px] border border-[var(--color-line)] bg-[linear-gradient(#ffffff,#f3f1ec)] font-mono text-[11px] leading-[15px] shadow-[inset_0_-1px_0_rgba(10,10,10,0.07)]"
                      style={{ paddingInline: 4 }}
                    >
                      {k}
                    </kbd>
                  ))
                : how}
            </dt>
            <dd className="text-[12px] leading-[17px] text-[var(--color-fg-muted)]">{what}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
