import type { Metadata } from 'next';
import { LegacyRedirect } from '@/components/site/LegacyRedirect';
import { hubHref } from '@/lib/site/sites';

/**
 * La page Digital Agency a été fondue dans LA page About, sur le hub
 * (2026-10-22), puis retirée le 2026-11-16 (elle doublait le texte) : la
 * cible est désormais la page entière.
 * En ligne, Caddy répond par une 301 ; ce stub ne sert qu'en local.
 */
export const metadata: Metadata = {
  title: 'Digital Agency',
  robots: { index: false, follow: true },
};

export default function LegacyAgencyPage() {
  return <LegacyRedirect to={hubHref('/about/')} />;
}
