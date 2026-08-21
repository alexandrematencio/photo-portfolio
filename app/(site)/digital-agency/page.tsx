import type { Metadata } from 'next';
import { LegacyRedirect } from './LegacyRedirect';

/**
 * Ancienne adresse de la page Digital Agency, déplacée sous /about
 * (chantier C, 2026-08-20). L'export statique GH Pages n'a pas de
 * redirections serveur : ce stub redirige côté client et garde un lien
 * en dur pour le cas sans JavaScript. `noindex` : la nouvelle adresse
 * est la seule canonique.
 */
export const metadata: Metadata = {
  title: 'Digital Agency',
  robots: { index: false, follow: true },
};

export default function LegacyDigitalAgencyPage() {
  return <LegacyRedirect to="/about/digital-agency" />;
}
