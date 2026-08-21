'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { urlFor } from '@/lib/sanity/image';
import type { PreparedSeries } from '@/lib/site/series';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';
import { pushModalHistory } from '@/lib/utils/modalHistory';
import { cn } from '@/lib/utils/cn';
import { SeriesMeta } from '../shared/SeriesMeta';

gsap.registerPlugin(Flip);

/**
 * Branche mobile de /series (spec §6) — liste verticale, PAS le dossier
 * qui se déplie du desktop : sur un écran de téléphone, l'effet coûterait
 * à l'image la place qui lui revient.
 *
 * - Repos : cover carrée à gauche (recadrée via hotspot), titre + année à
 *   droite. Largeur en FRACTION de l'écran (jamais de px figés) → 3-4
 *   rangées entières visibles sur tout appareil.
 * - Dépliage : la rangée s'étire à ~75dvh, la cover vient se centrer en
 *   grandissant (GSAP Flip, ~300 ms), la page se recale sur la rangée.
 * - Parcours : bande horizontale native (snap), voisines qui débordent.
 * - Sorties (spec §6, une seule porte) : bouton retour du téléphone
 *   (modalHistory), tap hors de la bande, scroll vertical franc (~90 px).
 *   Les trois passent par onClose() ; modalHistory réconcilie l'historique.
 */

const EXPAND_DUR = 0.3;
const SCROLL_CLOSE_PX = 90;

/**
 * Les deux branches (desktop / mobile) sont TOUJOURS montées — c'est le CSS
 * qui en affiche une seule (spec §4). Leurs écouteurs GLOBAUX (document,
 * historique, scroll) doivent donc vérifier que leur branche est visible :
 * sans ce garde, le tap-extérieur de la branche mobile CACHÉE fermait le
 * dossier quand on cliquait une vignette desktop (bug réel, vu en capture).
 * `offsetParent === null` ⇔ display:none quelque part dans les ancêtres.
 */
function isVisible(el: HTMLElement | null): boolean {
  return Boolean(el && el.offsetParent !== null);
}

function scrollParentOf(el: HTMLElement): HTMLElement {
  let p = el.parentElement;
  while (p) {
    const s = getComputedStyle(p);
    if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight) {
      return p;
    }
    p = p.parentElement;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

export function MobileSeries({
  series,
  openSeries,
  activeIndex,
  onOpen,
  onClose,
  onSelectPhoto,
}: {
  series: PreparedSeries[];
  openSeries: PreparedSeries | null;
  activeIndex: number;
  onOpen: (slug: string) => void;
  onClose: () => void;
  onSelectPhoto: (index: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<Flip.FlipState | null>(null);
  const reduced = useReducedMotion();
  const openSlug = openSeries?.slug ?? null;

  // ── Flip à l'ouverture (état capturé DANS le handler, avant re-rendu) ────

  const handleOpen = useCallback(
    (s: PreparedSeries) => {
      if (!reduced) {
        const coverEl = listRef.current?.querySelector(
          `[data-flip-id="cover-${s.slug}"]`
        );
        if (coverEl) flipStateRef.current = Flip.getState(coverEl);
      }
      onOpen(s.slug);
    },
    [onOpen, reduced]
  );

  useLayoutEffect(() => {
    const state = flipStateRef.current;
    flipStateRef.current = null;
    if (!openSlug) return;
    if (state && !reduced) {
      Flip.from(state, {
        targets: `[data-flip-id="cover-${openSlug}"]`,
        duration: EXPAND_DUR,
        ease: 'power2.out',
        absolute: true,
        scale: true,
      });
    }
    // Recalage : la rangée dépliée occupe le champ de vision. `scroll-mt`
    // sur la rangée compense la nav fixe.
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-series-row="${openSlug}"]`
    );
    row?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [openSlug, reduced]);

  // ── Historique : le bouton retour replie (modalHistory, porte unique) ────

  useEffect(() => {
    if (!openSlug || !isVisible(listRef.current)) return;
    const cleanup = pushModalHistory(onClose);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSlug]);

  // ── Scroll vertical franc → repli (spec §6) ──────────────────────────────
  // Pas d'interception : la page défile nativement, on observe le débord.
  // En dessous du seuil (swipe diagonal, ajustement), rien ne se passe.

  useEffect(() => {
    if (!openSlug || !isVisible(listRef.current) || !listRef.current) return;
    const scroller = scrollParentOf(listRef.current);
    let anchor: number | null = null;
    // L'ancre se pose une fois le recalage (smooth scroll) terminé.
    const settle = window.setTimeout(() => {
      anchor = scroller.scrollTop;
    }, 450);
    const onScroll = () => {
      if (anchor === null) return;
      if (Math.abs(scroller.scrollTop - anchor) > SCROLL_CLOSE_PX) onClose();
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(settle);
      scroller.removeEventListener('scroll', onScroll);
    };
  }, [openSlug, onClose]);

  // ── Tap hors de la bande → repli (capture : n'ouvre pas une autre série) ─

  useEffect(() => {
    if (!openSlug || !isVisible(listRef.current) || !listRef.current) return;
    const list = listRef.current;
    const onTap = (e: Event) => {
      const row = list.querySelector(`[data-series-row="${openSlug}"]`);
      if (row && !row.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('click', onTap, true);
    return () => document.removeEventListener('click', onTap, true);
  }, [openSlug, onClose]);

  // ── Index actif dérivé du snap de la bande ───────────────────────────────

  const onStripScroll = useCallback(() => {
    const strip = stripRef.current;
    if (!strip || !openSeries) return;
    requestAnimationFrame(() => {
      const mid = strip.scrollLeft + strip.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      strip.querySelectorAll<HTMLElement>('[data-strip-item]').forEach((el, i) => {
        const center = el.offsetLeft + el.offsetWidth / 2;
        const d = Math.abs(center - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      if (best !== activeIndex) onSelectPhoto(best);
    });
  }, [openSeries, activeIndex, onSelectPhoto]);

  return (
    // Espacements en style inline — convention du projet : le reset global
    // `* { padding: 0 }` (hors @layer, globals.css) écrase les utilitaires
    // Tailwind de padding/margin, qui sont eux dans un @layer.
    <div
      ref={listRef}
      className="flex flex-col gap-8"
      style={{ paddingLeft: 20, paddingRight: 20 }}
    >
      <h1 className="sr-only">Series</h1>
      {series.map((s) => {
        const isOpen = s.slug === openSlug;
        // SANS crop (demande du 2026-08-20) : ratio natif préservé, largeur
        // fixe 42 %. Les rangées n'ont donc plus une hauteur uniforme — choix
        // assumé au détriment de la garantie « 3-4 dossiers visibles ».
        const coverRatio = s.cover.image?.dimensions?.aspectRatio ?? 4 / 3;
        const coverSrc = s.cover.image
          ? (urlFor(s.cover.image)
              ?.width(560)
              .quality(75)
              .auto('format')
              .url() ?? '')
          : '';
        return (
          <article
            key={s.slug}
            data-series-row={s.slug}
            className="scroll-mt-20"
          >
            {!isOpen ? (
              <button
                type="button"
                onClick={() => handleOpen(s)}
                className="flex w-full items-center gap-5 text-left"
                aria-label={`Open the series “${s.title}”`}
              >
                <img
                  src={coverSrc}
                  alt={s.cover.image?.alt ?? s.title}
                  loading="lazy"
                  decoding="async"
                  data-flip-id={`cover-${s.slug}`}
                  className="block w-[42%] shrink-0 h-auto"
                  style={{ aspectRatio: String(coverRatio) }}
                />
                <span className="min-w-0">
                  {/* Un titre long casse sur plusieurs lignes — interligne
                      aéré (1.7) pour que la casse reste élégante. */}
                  <span className="block text-[14px] uppercase leading-[1.7] font-bold text-[var(--color-fg)]">
                    {s.title}
                  </span>
                  {/* marginTop inline : `mt-1` est avalé par le reset global
                      hors @layer (les lignes se collaient au titre). */}
                  {s.year && (
                    <span
                      className="block text-[11px] uppercase font-bold text-[var(--color-fg-muted)]"
                      style={{ marginTop: 6 }}
                    >
                      {s.year}
                    </span>
                  )}
                  <span
                    className="block text-[11px] uppercase font-bold text-[var(--color-fg-muted)] opacity-60"
                    style={{ marginTop: 4 }}
                  >
                    {s.photos.length} photo{s.photos.length === 1 ? '' : 's'}
                  </span>
                </span>
              </button>
            ) : (
              <div style={{ height: '76dvh' }} className="flex flex-col">
                <p
                  className="text-[12px] uppercase font-bold text-[var(--color-fg)]"
                  style={{ paddingBottom: 8 }}
                >
                  {s.title}
                  {s.year && (
                    <span
                      className="text-[var(--color-fg-muted)]"
                      style={{ marginLeft: 10 }}
                    >
                      {s.year}
                    </span>
                  )}
                </p>
                {/* Bande horizontale native : snap, voisines qui débordent,
                    léger retrait des bords (gestes système, spec §6). */}
                <div
                  ref={stripRef}
                  onScroll={onStripScroll}
                  className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain"
                  style={{
                    paddingLeft: 'max(env(safe-area-inset-left), 8px)',
                    paddingRight: 'max(env(safe-area-inset-right), 8px)',
                  }}
                >
                  {s.photos.map((photo, i) => {
                    const src = photo.image
                      ? (urlFor(photo.image)
                          ?.width(1100)
                          .quality(80)
                          .auto('format')
                          .url() ?? '')
                      : '';
                    const isCover = photo._id === s.cover._id;
                    const ratio =
                      photo.image?.dimensions?.aspectRatio ?? 4 / 3;
                    // Hauteur COMMUNE maximale pour toutes les photos : une
                    // horizontale prend la pleine hauteur de bande et sa
                    // largeur déborde de l'écran vers la droite (sens du
                    // scroll) — d'où snap-start (alignée au bord gauche)
                    // plutôt que centrée. Les verticales restent centrées.
                    const wide = ratio >= 1;
                    return (
                      <div
                        key={photo._id}
                        data-strip-item
                        className={cn(
                          'flex h-full w-auto shrink-0 items-center',
                          wide ? 'snap-start' : 'snap-center'
                        )}
                      >
                        <img
                          src={src}
                          alt={photo.image?.alt ?? photo.title}
                          loading={i < 3 ? 'eager' : 'lazy'}
                          data-flip-id={isCover ? `cover-${s.slug}` : undefined}
                          className="block h-full w-auto max-w-none object-contain"
                          style={{ aspectRatio: String(ratio) }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div
                  className="flex h-16 items-start justify-end"
                  style={{ paddingTop: 12 }}
                >
                  <SeriesMeta photo={s.photos[activeIndex] ?? s.photos[0]} />
                </div>
              </div>
            )}
          </article>
        );
      })}
      {/* Respiration en fin de liste : le dernier dossier peut se recaler
          en haut de l'écran une fois déplié. */}
      <div aria-hidden style={{ height: '30dvh' }} />
    </div>
  );
}
