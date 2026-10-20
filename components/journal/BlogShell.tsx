import type { Metadata, Viewport } from 'next';
import { interLatinCyrillic as inter } from '@/app/fonts/inter';
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
import { NavMemory } from '@/components/journal/BackLink';
import { getAllSeries, getArticles } from '@/lib/journal/articles';
import { DICT, LOCALE, homePath, languageScript, seriesPath, type Lang } from '@/lib/journal/i18n';
import type { MenuEntry } from '@/components/site/SitesMenu';

/**
 * Le châssis du journal (blog.amatencio.com), partagé par ses TROIS layouts
 * racine — `app/(blog)` en français, `app/(blog-en)/en`, `app/(blog-ru)/ru`.
 * Trois racines plutôt qu'une : `<html lang>` doit dire la langue de chaque
 * page, et c'est la seule balise qu'un layout unique ne peut pas faire varier
 * en export statique. Passer d'une langue à l'autre recharge la page.
 *
 * Il reprend le châssis du portfolio (`app/(site)/layout.tsx`) sans ce qui
 * n'y sert qu'aux photos : ni hero, ni splash, ni garde des images.
 */

// Cyrillique en plus du latin : le russe s'écrit en Inter comme le reste
// (`interLatinCyrillic`). Les titres sont en Helvetica Neue / Arial système,
// qui ont le cyrillique.

export function blogLayoutMetadata(lang: Lang): Metadata {
  return {
    ...buildMetadata({ lang }),
    alternates: {
      types: { 'application/rss+xml': [{ url: '/feed.xml', title: DICT.fr.feedTitle }] },
    },
  };
}

export const blogViewport: Viewport = {
  themeColor: '#fafaf8',
  width: 'device-width',
  initialScale: 1,
};

/** Le menu « Journal » : tous les articles, puis chaque série de cette langue. */
async function journalMenu(lang: Lang): Promise<MenuEntry[]> {
  const t = DICT[lang];
  const [articles, series] = await Promise.all([getArticles(lang), getAllSeries(lang)]);
  return [
    { label: t.allArticles, detail: t.articles(articles.length), href: homePath(lang) },
    ...series.map((s) => ({ label: s.title, detail: t.articles(s.articles.length), href: seriesPath(s.slug, lang) })),
  ];
}

export async function BlogShell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const menu = await journalMenu(lang);
  return (
    <html lang={LOCALE[lang].bcp47} className={inter.variable}>
      <body suppressHydrationWarning>
        {/* La langue du système, AVANT la première peinture (lib/journal/i18n.ts). */}
        <script dangerouslySetInnerHTML={{ __html: languageScript(lang) }} />
        <SiteHeader journalMenu={menu} />
        <MobileMenu journalMenu={menu} />
        <TopBarAutoHide />
        <CursorInvert />
        <EmailHoneypot />
        <FramedScroll footer={<SiteFooter />}>
          <MainPadding>{children}</MainPadding>
        </FramedScroll>
        <PageArrival />
        <NavMemory />
        <ScrollThumb />
      </body>
    </html>
  );
}
