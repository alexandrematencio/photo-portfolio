type Props = { label?: string; title?: string };

/**
 * Bloc photo vide. Apparaît tant qu'aucune image n'a été uploadée via /studio.
 * Sobre, sans bruit visuel — conforme au principe « image d'abord ».
 */
export function Placeholder({ label, title }: Props) {
  return (
    <div className="relative h-full w-full bg-[var(--color-bg-elev)] flex items-center justify-center text-center px-6">
      <div className="text-[var(--color-fg-muted)] text-[11px] uppercase">
        {title && (
          // marginBottom inline : `mb-3` avalé par le reset global hors @layer.
          <div
            className="text-[var(--color-fg)] text-sm tracking-normal normal-case font-medium"
            style={{ marginBottom: 12 }}
          >
            {title}
          </div>
        )}
        {label ?? 'Photo placeholder — éditer via /studio'}
      </div>
    </div>
  );
}
