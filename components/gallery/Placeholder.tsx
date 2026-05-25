type Props = { label?: string; title?: string };

/**
 * Bloc photo vide. Apparaît tant qu'aucune image n'a été uploadée via /studio.
 * Sobre, sans bruit visuel — conforme au principe « image d'abord ».
 */
export function Placeholder({ label, title }: Props) {
  return (
    <div className="relative h-full w-full bg-[var(--color-bg-elev)] flex items-center justify-center text-center px-6">
      <div className="text-[var(--color-fg-muted)] text-[11px] tracking-[0.25em] uppercase">
        {title && <div className="text-[var(--color-fg)] text-sm mb-3 tracking-normal normal-case font-medium">
          {title}
        </div>}
        {label ?? 'Photo placeholder — éditer via /studio'}
      </div>
    </div>
  );
}
