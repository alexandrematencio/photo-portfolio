'use client';

import { useId, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
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
 * LABO : local seulement (`?forces` ou `next dev`), en français seul.
 */

export type LabState = { mode: ForceMode; a: ForceSettings; b: ForceSettings; size: number; live: boolean; replay: number };

const KEY = 'concept-map-forces-lab';
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

const KINDS: { kind: LinkKind; label: string }[] = [
  { kind: 'rhyme', label: 'rimes' },
  { kind: 'part', label: 'thèse ↔ article' },
  { kind: 'uses', label: 'thèse → mécanisme' },
];
const same = (x: ForceSettings, y: ForceSettings) => JSON.stringify(x) === JSON.stringify(y);
const fmt = (v: number) => String(Math.round(v * 1000) / 1000);

/** Un groupe nommé ; `onReset` seulement quand il a bougé. */
function TuneGroup({ title, onReset, children }: { title: string; onReset?: () => void; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="flex flex-col">
      <div className="flex min-h-8 items-center justify-between gap-3" style={{ paddingBottom: 6 }}>
        <p className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')}>{title}</p>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            title={`Réinitialiser : ${title}`}
            aria-label={`Réinitialiser : ${title}`}
            className={cn(MICRO_LABEL, 'flex min-h-8 items-center gap-[4px] text-[var(--color-link)] underline-offset-4 hover:underline focus-visible:underline')}
          >
            <RotateCcw aria-hidden size={11} strokeWidth={2.25} />
            {/* « Rétablir » : « Réinitialiser » débordait du menu à 240 px (2026-11-03) ; le nom complet reste dans l'aria-label. */}
            Rétablir
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

function TuneCheck({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-9 items-center gap-2 font-[family-name:var(--font-index)] text-[12px] leading-[16px] text-[var(--color-fg)]">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--color-fg)]" />
      {label}
    </label>
  );
}

/**
 * Le corps de « Réglages » : `names` = les crans des noms, fournis par
 * l'explorateur ; `namesDirty` / `onNamesReset` pour la remise à zéro d'« Affichage ».
 */
export function MapTuning({
  lab,
  onChange,
  names,
  namesDirty,
  onNamesReset,
}: {
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
        title="Affichage"
        onReset={
          namesDirty || lab.size !== 1
            ? () => {
                onNamesReset();
                commit({ ...lab, size: 1 });
              }
            : undefined
        }
      >
        <TuneRow label="taille des bulles" value={lab.size} min={0.3} max={2} step={0.05} onChange={(size) => commit({ ...lab, size })} />
        <p className="text-[12px] leading-[17px] text-[var(--color-fg-muted)]" style={{ padding: '6px 0 8px' }}>
          Distance d’affichage des noms
        </p>
        {names}
      </TuneGroup>

      <TuneGroup title="Disposition" onReset={forcesDirty ? () => commit({ ...lab, [lab.mode]: FORCE_DEFAULTS, live: false, replay: lab.replay + 1 }) : undefined}>
        <div role="radiogroup" aria-label="Réglage des forces" className="grid grid-cols-2 border border-[var(--color-line)]" style={{ marginBottom: 12 }}>
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
              {m === 'a' ? 'Uniforme' : 'Par lien'}
            </button>
          ))}
        </div>
        <TuneRow label="force du centre" value={f.center} min={0} max={0.3} step={0.005} onChange={(center) => tune({ center })} />
        <TuneRow label="force de répulsion" value={f.repel} min={0} max={400} step={5} onChange={(repel) => tune({ repel })} />
        {lab.mode === 'a' ? (
          <TuneRow label="force des liens" value={f.link} min={0} max={1} step={0.02} onChange={(link) => tune({ link })} />
        ) : (
          <div className="flex flex-col border-l border-[var(--color-line)]" style={{ paddingLeft: 10, marginBottom: 4 }}>
            <p className="font-[family-name:var(--font-index)] text-[12px] leading-[16px] text-[var(--color-fg-muted)]" style={{ paddingBottom: 6 }}>
              force des liens, par type
            </p>
            {KINDS.map(({ kind, label }) => (
              <TuneRow key={kind} label={label} value={f.byKind[kind]} min={0} max={1} step={0.02} onChange={(v) => tune({ byKind: { ...f.byKind, [kind]: v } })} />
            ))}
          </div>
        )}
        <TuneRow label="distance des liens" value={f.distance} min={5} max={200} step={1} onChange={(distance) => tune({ distance })} />
        <TuneCheck label="bulles sans chevauchement" on={f.collide} onChange={(collide) => tune({ collide })} />
        <TuneCheck label="cadre fixe (écarter agrandit la carte)" on={f.fixedFrame} onChange={(fixedFrame) => tune({ fixedFrame })} />
      </TuneGroup>
    </div>
  );
}
