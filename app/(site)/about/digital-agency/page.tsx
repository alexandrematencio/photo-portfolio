import type { Metadata } from 'next';
import { LegacyRedirect } from '@/components/site/LegacyRedirect';
import { hubHref } from '@/lib/site/sites';

/**
 * La page Digital Agency a été fondue dans LA page About, sur le hub
 * (2026-10-22) : son texte s'y affiche à la suite, sous `#digital-agency`.
 * En ligne, Caddy répond par une 301 ; ce stub ne sert qu'en local.
 */
export const metadata: Metadata = {
  title: 'Digital Agency',
  robots: { index: false, follow: true },
};

export default function LegacyAgencyPage() {
  return <LegacyRedirect to={hubHref('/about/#digital-agency')} />;
}
