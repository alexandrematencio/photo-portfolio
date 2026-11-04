'use client';

import { useId, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import type { Dict } from '@/lib/journal/i18n';
import { FORCE_DEFAULTS, type ForceMode, type ForceSettings, type LinkKind } from './forces';

/**
 * Les réglages de la carte, en UN seul endroit : « Réglages » du menu
 * (2026-11-03, Alexandre : deux panneaux de réglages, c'était un de trop).
 * Le motif est celui du panneau de graphe d'Obsidian et des inspecteurs de
 * Figma : des groupes nommés, chacun avec sa remise à zéro, qui n'apparaît que
 * si le groupe a bougé (comme « Effacer × » des filtres). Le menu est à
 * gauche, la carte à droite : on règle en regardant.
 *
 * - « Affichage » : taille des bulles, distance d'affichage des noms ;
 * - « Disposition » : les forces. « Uniforme » = les quatre réglages
 *   d'Obsidian, la même force pour tous les liens ; « Par lien » ouvre la
 *   force des liens en une force par type de lien. Les deux noms répondent à la
 *   même question (comment la force des liens se répartit), seule différence
 *   entre les modes (2026-11-03, Alexandre : « Simple » / « Avancé » disaient
 *   un niveau de difficulté, pas ce qui change ; « Par relation » passait
 *   sur deux lignes à 240 px).
 *
 * Ouvert à tous depuis le 2026-11-03 (Alexandre), en FR/EN/RU (`dict.map.tuning`).
 * `?forces=b` ouvre la carte en « Par lien ».
 */

export type LabState = { mode: ForceMode; a: ForceSettings; b: ForceSettings; size: number; live: boolean; replay: number };

// v2 (2026-11-04) : plages d'Obsidian — les réglages enregistrés avant n'ont plus le même sens.
const KEY = 'concept-map-forces-lab-v2';
export function loadLab(mode: ForceMode): LabState {
  const fresh: LabState = { mode, a: FORCE_DEFAULTS, b: FORCE_DEFAULTS, size: 1, live: false, replay: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Partial<LabState>;
    return {
      ...fresh,
      size: typeof saved.size === 'number' ? saved.size : 1,
      a: { ...FORCE_DEFAULTS, ...saved.a },
      b: { ...FORCE_DEFAULTS, ...saved.b, byKind: { ...FORCE_DEFAULTS.byKind, ...saved.b?.byKind } },
    };
  } catch {
    return fresh;
  }
}
const saveLab = (s: LabState) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ a: s.a, b: s.b, size: s.size }));
  } catch {
    /* navigation privée : les réglages ne survivent pas au rechargement, c'est tout */
  }
};

type Tuning = Dict['map']['tuning'];
const KINDS: LinkKind[] = ['rhyme', 'part', 'uses'];
const same = (x: ForceSettings, y: ForceSettings) => JSON.stringify(x) === JSON.stringify(y);
const fmt = (v: number) => String(Math.round(v * 1000) / 1000);

/** Un groupe nommé ; `onReset` seulement quand il a bougé. */
function TuneGroup({ title, t, onReset, children }: { title: string; t: Tuning; onReset?: () => void; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="flex flex-col">
      <div className="flex min-h-8 items-center justify-between gap-3" style={{ paddingBottom: 6 }}>
        {/* Casse de phrase, en gras, à l'encre : un cran SOUS les catégories du menu (capitales) — en
            capitales grises, « Affichage » et « Disposition » se lisaient comme « Vue » ou « Séries »
            (2026-11-03, Alexandre). Le niveau des sous-titres de groupe des inspecteurs (Figma). */}
        <p className="font-[family-name:var(--font-index)] text-[13px] font-semibold leading-[16px] text-[var(--color-fg)]">{title}</p>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            title={t.resetOf(title)}
            aria-label={t.resetOf(title)}
            className={cn(MICRO_LABEL, 'flex min-h-8 items-center gap-[4px] text-[var(--color-link)] underline-offset-4 hover:underline focus-visible:underline')}
          >
            <RotateCcw aria-hidden size={11} strokeWidth={2.25} />
            {/* « Rétablir » : « Réinitialiser » débordait du menu à 240 px (2026-11-03) ; le nom complet reste dans l'aria-label. */}
            {t.reset}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/** Même dessin que les crans des noms (`ReachRow`). */
function TuneRow({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1" style={{ paddingBottom: 10 }}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 font-[family-name:var(--font-index)] text-[12px] leading-[16px]">
        <span className="text-[var(--color-fg)]">{label}</span>
        <span className="text-[var(--color-fg-faint)]">{fmt(value)}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="map-range w-full" />
    </div>
  );
}

/**
 * Le corps de « Réglages » : `names` = les crans des noms, fournis par
 * l'explorateur ; `namesDirty` / `onNamesReset` pour la remise à zéro d'« Affichage ».
 */
export function MapTuning({
  t,
  namesNote,
  lab,
  onChange,
  names,
  namesDirty,
  onNamesReset,
}: {
  t: Tuning;
  namesNote: string;
  lab: LabState;
  onChange: (s: LabState) => void;
  names: ReactNode;
  namesDirty: boolean;
  onNamesReset: () => void;
}) {
  const f = lab[lab.mode];
  const commit = (next: LabState) => {
    saveLab(next);
    onChange(next);
  };
  // Toucher une force met la carte en mouvement.
  const tune = (patch: Partial<ForceSettings>) => commit({ ...lab, [lab.mode]: { ...f, ...patch }, live: true });
  // Changer de mode repart de la carte d'origine : on compare à départ égal.
  const pick = (mode: ForceMode) => mode !== lab.mode && onChange({ ...lab, mode, replay: lab.replay + 1 });
  const forcesDirty = lab.live || !same(f, FORCE_DEFAULTS);

  return (
    <div className="flex flex-col gap-5">
      <TuneGroup
        title={t.display}
        t={t}
        onReset={
          namesDirty || lab.size !== 1
            ? () => {
                onNamesReset();
                commit({ ...lab, size: 1 });
              }
            : undefined
        }
      >
        <TuneRow label={t.size} value={lab.size} min={0.3} max={2} step={0.05} onChange={(size) => commit({ ...lab, size })} />
        <p className="text-[12px] leading-[17px] text-[var(--color-fg-muted)]" style={{ padding: '6px 0 8px' }}>
          {namesNote}
        </p>
        {names}
      </TuneGroup>

      <TuneGroup title={t.layout} t={t} onReset={forcesDirty ? () => commit({ ...lab, [lab.mode]: FORCE_DEFAULTS, live: false, replay: lab.replay + 1 }) : undefined}>
        <div role="radiogroup" aria-label={t.modes.label} className="grid grid-cols-2 border border-[var(--color-line)]" style={{ marginBottom: 12 }}>
          {(['a', 'b'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={lab.mode === m}
              onClick={() => pick(m)}
              className={cn(
                MICRO_LABEL,
                'min-h-9 transition-colors duration-150 motion-reduce:transition-none',
                lab.mode === m ? 'bg-[var(--color-fg)] text-[var(--color-bg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
              )}
            >
              {t.modes[m]}
            </button>
          ))}
        </div>
        <TuneRow label={t.center} value={f.center} min={0} max={1} step={0.01} onChange={(center) => tune({ center })} />
        <TuneRow label={t.repel} value={f.repel} min={0} max={20} step={0.05} onChange={(repel) => tune({ repel })} />
        {lab.mode === 'a' ? (
          <TuneRow label={t.link} value={f.link} min={0} max={1} step={0.01} onChange={(link) => tune({ link })} />
        ) : (
          <div className="flex flex-col border-l border-[var(--color-line)]" style={{ paddingLeft: 10, marginBottom: 4 }}>
            <p className="font-[family-name:var(--font-index)] text-[12px] leading-[16px] text-[var(--color-fg-muted)]" style={{ paddingBottom: 6 }}>
              {t.linkByKind}
            </p>
            {KINDS.map((kind) => (
              <TuneRow key={kind} label={t.kinds[kind]} value={f.byKind[kind]} min={0} max={1} step={0.01} onChange={(v) => tune({ byKind: { ...f.byKind, [kind]: v } })} />
            ))}
          </div>
        )}
        <TuneRow label={t.distance} value={f.distance} min={30} max={500} step={1} onChange={(distance) => tune({ distance })} />
      </TuneGroup>
    </div>
  );
}
