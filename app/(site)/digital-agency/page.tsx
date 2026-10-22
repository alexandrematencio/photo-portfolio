import type { Metadata } from 'next';
import { LegacyRedirect } from '@/components/site/LegacyRedirect';
import { hubHref } from '@/lib/site/sites';

/**
 * Ancienne adresse de la page Digital Agency, déplacée sous /about
 * (chantier C, 2026-08-20). L'export statique GH Pages n'a pas de
 * redirections serveur : ce stub redirige côté client et garde un lien
 * en dur pour le cas sans JavaScript. `noindex` : la nouvelle adresse
 * est la seule canonique. Depuis le 2026-10-22, la page est une partie
 * de LA page About, sur le hub ; en ligne, Caddy répond par une 301.
 */
export const metadata: Metadata = {
  title: 'Digital Agency',
  robots: { index: false, follow: true },
};

export default function LegacyDigitalAgencyPage() {
  return <LegacyRedirect to={hubHref('/about/#digital-agency')} />;
}
