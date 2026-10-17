import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import { buildMetadata } from '@/lib/seo/metadata';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { FramedScroll } from '@/components/site/FramedScroll';
import { MainPadding } from '@/components/site/MainPadding';
import { MobileMenu } from '@/components/site/MobileMenu';
import { PageArrival } from '@/components/site/PageArrival';
import { ScrollThumb } from '@/components/site/ScrollThumb';
import { TopBarAutoHide } from '@/components/site/TopBarAutoHide';
import { CursorInvert } from '@/components/site/CursorInvert';
import { EmailHoneypot } from '@/components/site/EmailHoneypot';

/**
 * Layout RACINE du journal (blog.amatencio.com) — compilé dans le seul build
 * `SITE_TARGET=blog` (next.config.ts, lib/site/sites.ts). Il reprend le
 * châssis du portfolio (`app/(site)/layout.tsx`) sans ce qui n'y sert qu'aux
 * photos : ni hero, ni splash, ni garde des images.
 *
 * `lang="fr"` sur <html> : le journal est en français de bout en bout, et
 * c'est la langue déclarée ici que les moteurs retiennent pour la page.
 */
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  ...buildMetadata({}),
  alternates: {
    types: { 'application/rss+xml': [{ url: '/feed.xml', title: 'Journal d’Alexandre Matencio' }] },
  },
};

export const viewport: Viewport = {
  themeColor: '#fafaf8',
  width: 'device-width',
  initialScale: 1,
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body suppressHydrationWarning>
        <SiteHeader />
        <MobileMenu />
        <TopBarAutoHide />
        <CursorInvert />
        <EmailHoneypot />
        <FramedScroll footer={<SiteFooter />}>
          <MainPadding>{children}</MainPadding>
        </FramedScroll>
        <PageArrival />
        <ScrollThumb />
      </body>
    </html>
  );
}
