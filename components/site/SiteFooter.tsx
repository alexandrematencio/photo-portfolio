import Link from 'next/link';

const YEAR = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-line)] mt-32 py-10 px-4 md:px-8">
      <div className="mx-auto max-w-screen-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-[11px] uppercase tracking-[0.2em] text-[var(--color-fg-muted)]">
        <div>© {YEAR} A. Matencio — Tous droits réservés.</div>
        <nav aria-label="Liens légaux" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/mentions-legales" className="hover:text-[var(--color-fg)]">
            Mentions légales
          </Link>
          <Link
            href="/politique-de-confidentialite"
            className="hover:text-[var(--color-fg)]"
          >
            Confidentialité
          </Link>
          <Link href="/contact" className="hover:text-[var(--color-fg)]">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
