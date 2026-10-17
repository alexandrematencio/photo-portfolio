'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type MouseEvent } from 'react';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';

/**
 * « ← Back », en tête d'un article et d'une page de série du journal.
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

export function BackLink({ href, label = 'Back' }: { href: string; label?: string }) {
  const router = useRouter();

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (visited > 1) {
      e.preventDefault();
      router.back();
    }
  };

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(MICRO_LABEL, 'group flex w-fit items-center gap-2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors duration-200 motion-reduce:transition-none')}
    >
      <span
        aria-hidden
        className="transition-[translate] duration-200 ease-out group-hover:-translate-x-[3px] motion-reduce:transition-none"
      >
        ←
      </span>
      {label}
    </Link>
  );
}
