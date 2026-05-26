import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { buildMetadata } from '@/lib/seo/metadata';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = buildMetadata({});

export const viewport: Viewport = {
  themeColor: '#fafaf8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      {/* `suppressHydrationWarning` on <body> only: silences mismatches caused by
          browser extensions (ColorZilla `cz-shortcut-listen`, Grammarly, Dark Reader…)
          that inject attributes into the body before React hydrates. Scoped to this
          single element — does NOT mask real mismatches in children. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
