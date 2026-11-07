import { type ReactNode } from 'react';
import { StateDot } from '@/components/site/StateDot';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import { TagSwatch } from '@/components/journal/TagSwatch';
import { ITEM_PAD, type Filter } from '@/components/journal/FolderTree';

/** Une ligne de choix de la colonne de filtres : voyant, pastille de couleur, libellé, compteur. */
function FilterButton({ filter: f, on, onChange }: { filter: Filter; on: boolean; onChange: (key: string) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(f.key)}
      className={cn(
        'flex w-full items-center gap-[10px] text-left text-[15px] font-bold tracking-[-0.02em] leading-[1.3] transition-colors motion-reduce:transition-none',
        on ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
      )}
      style={{ paddingBlock: ITEM_PAD }}
    >
      <StateDot on={on} />
      <span className="flex items-center gap-[8px]">
        <TagSwatch color={f.color ?? null} />
        <span>
          {f.label} <span className="font-normal tabular-nums">({f.count})</span>
        </span>
      </span>
    </button>
  );
}

/** Un groupe de la colonne de filtres (desktop), tant qu'aucune thématique n'existe : titre filé, une ligne par choix. */
export function FilterGroup({
  heading,
  items,
  isOn,
  onChange,
  children,
}: {
  heading: ReactNode;
  items: Filter[];
  isOn: (key: string) => boolean;
  onChange: (key: string) => void;
  /** Sous la liste (le lien vers la page de la série choisie). */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div
        className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')}
        style={{ paddingBottom: 12, borderBottom: '1px solid var(--color-line)' }}
      >
        {heading}
      </div>
      <ul className="flex flex-col" style={{ paddingTop: 12 }}>
        {items.map((f) => (
          <li key={f.key}>
            <FilterButton filter={f} on={isOn(f.key)} onChange={onChange} />
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

