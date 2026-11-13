import type { CSSProperties } from 'react';
import { ExternalLink } from 'lucide-react';
import { EDITORIAL_SIDENOTE } from '@/lib/site/typography';
import { frenchSpaces } from '@/lib/journal/french';
import type { JournalImage } from '@/lib/journal/types';
import type { Lang } from '@/lib/journal/i18n';

/**
 * Une vidéo YouTube dans le texte (bloc « Vidéo YouTube » du Studio,
 * 2026-11-14). Ce n'est PAS un lecteur : c'est une affiche habillée comme un
 * lecteur intégré (titre en haut, bouton Play, « Regarder sur YouTube ») et un
 * simple lien vers la vidéo sur youtube.com, dans un nouvel onglet.
 *
 * Décision d'Alexandre (2026-11-14) : ne rien ouvrir. Aucune iframe, aucune
 * requête vers YouTube depuis la page, la CSP du blog garde `frame-src 'none'`.
 * L'affiche est servie par le CDN Sanity ; `noreferrer` : YouTube ne sait pas
 * d'où vient le lecteur. La légende dit pourquoi le clic quitte le journal.
 *
 * `hl` = langue de l'interface au moment du clic (celle de la page, choisie
 * par le système ou par le lecteur via `LanguageSwitch`). `id` est validé en
 * amont (convert.ts, 11 caractères sûrs).
 */
export function ArticleVideo({
  id,
  title,
  poster,
  caption,
  lang,
  watchLabel,
  notice,
  newTab,
  style,
}: {
  id: string;
  title: string;
  poster: JournalImage | null;
  caption?: string;
  lang: Lang;
  watchLabel: string;
  notice: string;
  newTab: string;
  style?: CSSProperties;
}) {
  const href = `https://www.youtube.com/watch?v=${id}&hl=${lang}`;

  return (
    <figure className="flex flex-col gap-3" style={{ maxWidth: 'var(--editorial-measure)', ...style }}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${watchLabel} : ${title} (${newTab})`}
        className="yt-facade group relative block w-full overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-fg)]"
        style={{ aspectRatio: '16 / 9', backgroundColor: '#0f0f0f' }}
      >
        {poster && (
          <img
            src={poster.src}
            srcSet={poster.srcSet}
            sizes="(min-width: 760px) 680px, 100vw"
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* Bandeau du titre, comme en tête d'un lecteur intégré. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 block truncate text-[15px] leading-tight text-white"
          style={{ padding: '14px 16px 32px', background: 'linear-gradient(rgba(0,0,0,.65), rgba(0,0,0,0))' }}
        >
          {title}
        </span>
        {/* Bouton Play : sombre au repos, rouge au survol ou au focus. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 68 48"
          width="68"
          height="48"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <rect className="yt-facade-play" x="0" y="0" width="68" height="48" rx="14" />
          <path d="M27 15 L46 24 L27 33 Z" fill="#fff" />
        </svg>
        <span
          aria-hidden="true"
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 text-[13px] leading-none text-white"
          style={{ padding: '8px 10px', backgroundColor: 'rgba(0,0,0,.75)', borderRadius: 4 }}
        >
          {watchLabel}
          <ExternalLink size={13} strokeWidth={2} />
        </span>
      </a>
      <figcaption className={EDITORIAL_SIDENOTE}>
        {caption ? `${frenchSpaces(caption)} ` : ''}
        <span style={{ opacity: 0.7 }}>{notice}</span>
      </figcaption>
    </figure>
  );
}
