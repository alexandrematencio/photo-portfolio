'use client';

import { useEffect, useState } from 'react';
import { ArticleView } from '@/components/journal/ArticleView';
import { summarize, toArticle } from '@/lib/journal/convert';
import { DEFAULT_LANG, isLang } from '@/lib/journal/i18n';
import { PREVIEW_READY, PREVIEW_UPDATE, type PreviewPayload } from '@/lib/journal/preview';
import { PHOTO_URL } from '@/lib/site/sites';
import type { Article, ArticleSummary } from '@/lib/journal/types';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';

/**
 * Le brouillon d'un article, rendu par `ArticleView` — le composant même de
 * la page publiée, dans le layout du blog (en-tête, pied de page, polices).
 * Ce qu'on voit ici est ce qui paraîtra.
 *
 * Le Studio (amatencio.com/studio) l'affiche en iframe et lui envoie le
 * brouillon par `postMessage` à chaque modification. On n'écoute que le
 * Studio : `PHOTO_URL` est son origine, un autre site qui encadrerait cette
 * page ne peut rien y écrire. Aucune donnée ne part d'ici, et la page ne lit
 * rien dans Sanity — le Studio, lui, est connecté.
 */
export function ArticlePreview() {
  const [view, setView] = useState<{ article: Article; series: ArticleSummary[]; signature: string } | null>(null);

  useEffect(() => {
    const studio = new URL(PHOTO_URL).origin;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== studio || e.data?.type !== PREVIEW_UPDATE) return;
      const { raw, series, siblings, signature } = e.data.payload as PreviewPayload;
      const lang = isLang(raw.lang) ? raw.lang : DEFAULT_LANG;
      const article = toArticle(
        {
          ...raw,
          lang,
          slug: raw.slug || 'apercu',
          title: raw.title || 'Sans titre',
          dek: raw.dek || '',
          // Brouillon sans date : celle du jour, comme au premier Publish.
          date: raw.date ?? new Date().toISOString().slice(0, 10),
        },
        series ?? undefined,
      );
      const self = summarize(article);
      const parts = article.seriesSlug
        ? [
            ...siblings
              .filter((s) => s.slug !== self.slug)
              .map((s) => ({ ...self, slug: s.slug, title: s.title, part: s.part ?? 0 })),
            self,
          ].sort((a, b) => a.part - b.part)
        : [];
      setView({ article, series: parts, signature });
    };
    window.addEventListener('message', onMessage);
    // Le Studio attend ce signal pour envoyer le premier état.
    window.parent?.postMessage({ type: PREVIEW_READY }, studio);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <>
      {view ? (
        <ArticleView article={view.article} series={view.series} signature={view.signature} />
      ) : (
        <p className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')} style={{ padding: 'var(--page-gutter)' }}>
          Aperçu — s’ouvre depuis le Studio, onglet « Aperçu » d’un article.
        </p>
      )}
      <span
        aria-hidden
        className={cn(MICRO_LABEL, 'fixed z-[60] bg-[var(--color-fg)] text-[var(--color-bg)] pointer-events-none')}
        style={{ right: 20, bottom: 12, padding: '6px 10px' }}
      >
        Aperçu · non publié
      </span>
    </>
  );
}
