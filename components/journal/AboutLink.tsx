import Link from 'next/link';

/**
 * « → À propos de ce journal », sous le titre de l'accueil du journal
 * (demande Alexandre, 2026-10-19). Calé à gauche, encadré comme le bouton
 * « Back » des articles (`BackLink`) et au même corps. Survol : le texte, la
 * flèche et le cadre s'éclaircissent ensemble (le cadre suit `currentColor`).
 *
 * La flèche est la `arrow-right` de Lucide, tracée à la main pour que ses deux
 * chemins se déforment au survol : la hampe s'allonge ET la pointe se
 * resserre (squash & stretch, `RESOURCES/animation-principles.md` §1).
 * Mécanique : bloc « LIEN À PROPOS DU JOURNAL » de `globals.css`. Safari
 * n'interpole pas `d` — la flèche y saute à sa forme étirée, sans casse.
 */
export function AboutLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="journal-about-link flex w-full justify-center sm:w-fit sm:self-center md:self-start items-center text-[20px] leading-none uppercase font-bold text-[var(--color-fg)] transition-colors duration-200 hover:text-[var(--color-fg-muted)] focus-visible:text-[var(--color-fg-muted)] motion-reduce:transition-none"
      // 12 sous le `gap` du bloc de titre : le lien appartient au titre, pas à
      // l'index. Padding inline : le reset `* { padding: 0 }` avale les utilities.
      // Téléphone : toute la largeur ; tablette sous `md` : centré (2026-10-24).
      style={{ gap: 10, marginTop: 4, padding: '12px 16px', border: '1px solid currentColor' }}
    >
      <svg
        aria-hidden
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-none"
      >
        <path className="journal-about-shaft" d="M5 12h14" />
        <path className="journal-about-head" d="M12 5l7 7-7 7" />
      </svg>
      {label}
    </Link>
  );
}
