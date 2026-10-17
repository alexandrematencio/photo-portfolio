import type { Metadata } from 'next';
import { LegacyRedirect } from '@/components/site/LegacyRedirect';

/**
 * Ancienne page Socials, fondue dans /contact le 2026-10-17 (demande
 * Alexandre) : les réseaux sont une façon de prendre contact. Le serveur
 * (Caddy) répond déjà 301 sur cette adresse ; ce stub ne sert qu'au
 * développement local et à un hébergement sans redirections serveur.
 * `noindex` : /contact est la seule canonique.
 */
export const metadata: Metadata = {
  title: 'Socials',
  robots: { index: false, follow: true },
};

export default function LegacySocialsPage() {
  return <LegacyRedirect to="/contact" />;
}
