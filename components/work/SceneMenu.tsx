'use client';

import { StateDot } from '@/components/site/StateDot';
import { cn } from '@/lib/utils/cn';
import type { PreparedSeries } from '@/lib/site/series';

/**
 * Le menu de gauche de /work : la liste des collections, en bas à gauche, comme la colonne de noms de
 * /series (`OpenSeriesView`) — mêmes capitales grasses de 12 px, même voyant sur l'actif. Un clic mène à la
 * scène (pas-à-pas, `scene-step.ts`) ; ↑ / ↓ font la même chose au clavier.
 *
 * Posé dans un rail COLLANT de hauteur nulle, dernier enfant de la racine : il reste au bas de l'écran
 * pendant toute la traversée des scènes, puis remonte avec elles au lieu de glisser sur le footer.
 * Caché sous `md` (la liste n'y a pas la place) et pendant qu'un album est ouvert (`site.css`).
 *
 * Espacements en inline : le reset global hors @layer neutralise les utilitaires de padding et de marge.
 */
export function SceneMenu({
  collections,
  active,
  hidden,
  onGo,
}: {
  collections: PreparedSeries[];
  active: number;
  /** Un album est ouvert : le menu est effacé (`site.css`) et sort aussi de l'ordre de tabulation. */
  hidden: boolean;
  onGo: (index: number) => void;
}) {
  return (
    <div className="work-menu-rail max-xl:hidden" inert={hidden} style={{ position: 'sticky', bottom: 0, height: 0, zIndex: 30 }}>
      <nav
        aria-label="Collections"
        className="work-menu flex flex-col"
        style={{ position: 'absolute', left: 'var(--page-gutter)', bottom: 40, gap: 12 }}
      >
        {collections.map((c, i) => {
          const isActive = i === active;
          return (
            <button
              key={c._id}
              type="button"
              onClick={() => (isActive ? undefined : onGo(i))}
              aria-current={isActive || undefined}
              style={{ gap: 6 }}
              className={cn(
                'inline-flex w-fit items-start text-left text-[12px] uppercase font-bold leading-[1.45] transition-colors motion-reduce:transition-none',
                isActive
                  ? 'text-[var(--color-fg)] cursor-default'
                  : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] cursor-pointer',
              )}
            >
              {/* Voyant centré sur la première ligne, pas sur le bloc (même boîte que /series). */}
              <span style={{ display: 'flex', alignItems: 'center', height: '1.45em', flex: 'none' }}>
                <StateDot on={isActive} />
              </span>
              {c.title}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
