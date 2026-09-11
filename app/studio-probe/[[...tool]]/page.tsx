/**
 * Sonde de développement du Studio (cf. `StudioProbe.tsx`) : le Studio sans
 * session Sanity, pour que Playwright puisse en constater le rendu. Vide en prod.
 */
import { StudioProbe } from './StudioProbe';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ tool: [] }];
}

export const metadata = {
  title: 'Sonde Studio',
  robots: { index: false, follow: false },
};

export default function StudioProbePage() {
  if (process.env.NODE_ENV === 'production') return null;
  return <StudioProbe />;
}
