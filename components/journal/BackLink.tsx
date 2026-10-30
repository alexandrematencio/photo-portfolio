'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type MouseEvent } from 'react';
import { Undo2 } from 'lucide-react';
import { DICT, type Lang } from '@/lib/journal/i18n';

/**
 * « Back », en tête d'un article et d'une page de série du journal.
 *
 * Revient d'où l'on vient quand on vient du journal lui-même : l'index garde
 * alors sa position. Arrivé de Google ou d'un lien partagé, un retour arrière
 * quitterait le site — le lien mène alors à la page parente (`href`) : la
 * série, ou l'index.
 *
 * « Vient du journal » : `document.referrer` ne le dit pas — il garde le
 * référent du PREMIER chargement, une navigation interne de Next ne le change
 * pas. D'où `NavMemory`, monté dans le layout du blog, qui retient s'il y a
 * déjà eu une page avant celle-ci dans l'onglet.
 */
let visited = 0;

export function NavMemory() {
  const pathname = usePathname();
  useEffect(() => {
    visited += 1;
  }, [pathname]);
  return null;
}

/** « Back » remontera l'historique au lieu de suivre son lien (`HomeReturn`). */
export const backGoesBack = () => visited > 1;

export function BackLink({ href, lang }: { href: string; lang: Lang }) {
  const label = DICT[lang].back;
  const router = useRouter();

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (visited > 1) {
      e.preventDefault();
      router.back();
    }
  };

  // Le bouton et, dans la même case, son double français invisible et sans
  // hauteur (2026-10-30, demande Alexandre) : la case prend la largeur de
  // « Retour », la plus longue des trois langues, et le rail de PageShell, qui
  // se règle sur elle, garde la même largeur en anglais et en russe. Le bouton
  // s'y cale à gauche, comme dans le rail d'un article.
  return (
    <div className="grid">
      <Link
        href={href}
        onClick={onClick}
        data-back-link
        // Bouton encadré (maquette d'Alexandre, 2026-10-18). Padding en style
        // inline : le reset `* { padding: 0 }` avalerait une utility Tailwind.
        // Au survol comme au focus clavier, texte et cadre s'éclaircissent
        // (2026-10-19 : le cadre qui se remplissait d'encre faisait disparaître
        // le texte) — le cadre suit `currentColor`.
        // Fond papier : dans le rail collant (PageShell), le bouton reste
        // lisible quoi qu'il survole.
        style={FRAME}
        className={`${FACE} col-start-1 row-start-1 transition-colors duration-200 hover:text-[var(--color-fg-muted)] focus-visible:text-[var(--color-fg-muted)] motion-reduce:transition-none`}
      >
        {/* Le demi-tour de « Back to All Series » (/series) : il dit « on
            revient d'où l'on vient », pas « à gauche ». */}
        <Undo2 size={18} strokeWidth={2.25} aria-hidden />
        {label}
      </Link>
      {lang !== 'fr' && (
        <span aria-hidden className={`${FACE} invisible col-start-1 row-start-1 h-0 overflow-hidden`} style={{ ...FRAME, paddingBlock: 0, borderBlockWidth: 0 }}>
          <Undo2 size={18} strokeWidth={2.25} />
          {DICT.fr.back}
        </span>
      )}
    </div>
  );
}

const FRAME = { padding: '6px 12px', border: '1px solid currentColor', gap: 10, backgroundColor: 'var(--color-bg)' };
const FACE = 'flex w-fit items-center text-[20px] leading-none uppercase font-bold text-[var(--color-fg)]';
