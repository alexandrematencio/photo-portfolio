import Link from 'next/link';
import { photoHref } from '@/lib/site/sites';
import { SITES } from '@/lib/site/nav';
import { getSiteSettings, socialLinks } from '@/lib/sanity/queries';
import { FooterWordmark } from './FooterWordmark';
import { ProtectedEmail } from './ProtectedEmail';

/**
 * Pied de page — reprise de l'IDÉE du pied de page d'AAXLO (`AppFooterV2.vue` :
 * grille de liens à filets, logo sur toute la largeur, ligne de bas), pas de
 * sa copie (2026-10-18, demande Alexandre). Fond = le `--color-dark` d'AAXLO.
 *
 * Quatre colonnes : le travail, la personne, les sites d'amatencio.com (lus
 * dans `SITES`, la liste du menu « All sites » — un site pas encore en ligne
 * y reste grisé avec « Soon », jamais un lien mort), et le contact. Le contact
 * ne montre JAMAIS l'adresse (CLAUDE.md §8.5) : « Write to me » passe par
 * `ProtectedEmail`, les réseaux sont lus dans le texte de `socialsPage`.
 *
 * ⚠️ Toute la géométrie vit dans le bloc « PIED DE PAGE » de `globals.css`,
 * en règles unlayered : le reset `* { padding: 0 }` avale les utilities
 * Tailwind de padding, et le style inline ne connaît pas les media queries.
 *
 * ⚠️ Plus de hauteur verrouillée à 70 px (levée le 2026-10-18, accord
 * Alexandre) : /series mesure son débord (`scrollHeight − clientHeight`) et
 * le consomme en bout de rangée, quelle que soit la hauteur du pied de page.
 */
export async function SiteFooter() {
  const settings = await getSiteSettings();
  const socials = socialLinks(settings);

  return (
    <footer className="site-footer" data-site-footer>
      <nav className="footer-grid" aria-label="Footer">
        <div className="footer-col">
          <p className="footer-label">Work</p>
          <ul className="footer-links">
            <li><Link href={photoHref('/series/')}>Series</Link></li>
            <li><Link href={photoHref('/archives/')}>Archives</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <p className="footer-label">About</p>
          <ul className="footer-links">
            <li><Link href={photoHref('/about/')}>About</Link></li>
            <li><Link href={photoHref('/about/digital-agency/')}>Digital agency</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <p className="footer-label">Sites</p>
          <ul className="footer-links">
            {SITES.map((site) => (
              <li key={site.label}>
                {site.href ? (
                  <a
                    href={site.href}
                    {...(site.external ? { target: '_blank', rel: 'noopener' } : {})}
                  >
                    {site.label}
                    {site.external && <span aria-hidden="true"> ↗</span>}
                  </a>
                ) : (
                  <span className="footer-soon">
                    {site.label} <span className="footer-soon-tag">Soon</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="footer-col">
          <p className="footer-label">Contact</p>
          <ul className="footer-links">
            <li><ProtectedEmail>Write to me</ProtectedEmail></li>
            {socials.map((s) => (
              <li key={s.href}>
                <a href={s.href} target="_blank" rel="noopener">
                  {s.label}
                  <span aria-hidden="true"> ↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <Link href={photoHref('/')} className="footer-logo" aria-label="Alexandre Matencio — home">
        <FooterWordmark />
      </Link>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Alexandre Matencio. All rights reserved.</span>
        <span className="footer-legal">
          <Link href={photoHref('/legal/')}>Legal notice</Link>
          <Link href={photoHref('/privacy/')}>Privacy</Link>
        </span>
      </div>
    </footer>
  );
}
