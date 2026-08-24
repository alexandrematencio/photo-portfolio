'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { urlFor } from '@/lib/sanity/image';
import type { PreparedSeries } from '@/lib/site/series';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';
import { useMdUp } from '../shared/useMdUp';
import { pushModalHistory } from '@/lib/utils/modalHistory';
import { SeriesMeta, META_LINE_PX } from '../shared/SeriesMeta';
import {
  MICRO_LABEL,
  PAGE_GUTTER,
  PAGE_TITLE_GAP,
} from '@/lib/site/typography';
import { PageTitle } from '@/components/site/PageShell';

gsap.registerPlugin(Flip);

/**
 * Branche mobile de /series — refonte du 2026-08-23 (demande Alexandre).
 *
 * Le dépliage EN PLACE (la rangée qui s'étirait à 76dvh au milieu de la liste)
 * est abandonné. À la place, deux états francs :
 *
 * 1. LISTE — titre « SERIES » pleine largeur (même technique que « Selected
 *    Works » sur la home), puis une rangée par série : cover à gauche, titre et
 *    année à droite. Défilement vertical natif, rien d'autre.
 *
 * 2. PLEIN ÉCRAN — au tap, un calque plein écran recouvre tout : les autres
 *    séries disparaissent. Le chrome du site (logo, bouton MENU) RESTE cliquable
 *    — le calque est en z-40, sous le header (z-50) et sous le bouton menu
 *    (z-55). Aucune exception à coder : c'est l'empilement qui la fait.
 *
 *    ⚠️ Le calque était NOIR jusqu'au 2026-08-23, et repeignait tout le chrome
 *    du site en blanc via `data-immersive` sur `<html>` (glyph compris). La
 *    « salle obscure » est abandonnée (demande Alexandre) : le calque est sur
 *    le papier, les encres ne basculent plus, le glyph reste cobalt. Il ne
 *    reste donc AUCUN mécanisme d'inversion dans le site — ne pas le
 *    réintroduire ici sans rouvrir la question côté brand book.
 *
 * Dimensionnement des photos : CALÉ SUR LA LARGEUR, entier à l'écran. Un
 * portrait prend donc toute la hauteur qu'il peut, un panoramique reste petit —
 * c'est la contrepartie assumée (arbitrage Alexandre). La boîte, elle, ne bouge
 * jamais : c'est l'écran. Rien ne remue en swipant.
 *
 * Sorties : tap sur une photo, tap dans le noir, long geste vertical (60 % de
 * l'écran), bouton retour du téléphone. Les quatre passent par requestClose().
 */

/**
 * Marge latérale : gouttière de la liste ET retrait de la photo en plein
 * écran. C'est la gouttière de page du site, et c'est cette page qui la lui a
 * donnée — elle a servi de référence à l'homogénéisation du 2026-08-24. D'où
 * le token plutôt que le nombre : le jour où la mesure bouge, elle bouge ici
 * aussi, ce qui est le but.
 */
const SIDE = PAGE_GUTTER;

/**
 * Respiration de la liste d'accueil (demande Alexandre, 2026-08-24) : 72 px
 * entre deux séries, et l'écart titre → corps du site sous le lettrage.
 *
 * Les deux vont ensemble et se lisent ensemble : le titre n'est pas une ligne
 * de la liste, il l'ANNONCE, et l'écart qui l'en sépare doit être franchement
 * plus grand que celui qui sépare deux séries — sinon la page se lit comme une
 * liste de sept items dont le premier serait écrit en gros.
 *
 * Le complément est porté en padding sur le titre, pas dans le `rowGap` — un
 * écart de titre n'a pas à valoir entre deux séries.
 */
const ROW_GAP = 72;

/**
 * Hauteur soustraite à l'écran avant de plafonner la photo : nav-bar (64),
 * frise de points (56), titre + fiche technique collés à l'image avec leurs
 * écarts (68), et 32 de respiration. Une seule constante parce que ces cinq
 * nombres n'ont de sens qu'ensemble — en changer un sans les autres, c'est
 * une photo rognée ou une frise poussée hors de l'écran.
 *
 * La part fiche technique est CALCULÉE depuis `META_LINE_PX` (deux lignes en
 * mode `grouped` + 10 de padding), jamais transcrite — même geste que
 * `CHROME_BOTTOM` côté desktop, et pour la même raison : l'interligne a déjà
 * changé une fois (18 → 15 le 2026-08-24, où cette part est passée de 10 + 18
 * à 10 + 2 × 15) et cette réserve doit suivre toute seule. Les termes en
 * dur : nav-bar 64, frise de points 56, ligne de titre 18 + son padding 10,
 * et 32 de respiration.
 */
const PHOTO_V_RESERVE = 64 + 56 + (18 + 10) + (10 + 2 * META_LINE_PX) + 32;

/** Frise de points — fenêtre glissante façon carousel Instagram. */
const DOT = 6;
const DOT_GAP = 8;
const DOT_WINDOW = 5;

const OPEN_DUR = 0.5;
const CLOSE_DUR = 0.45;

/**
 * Sortie au geste vertical — fraction de la hauteur d'écran à parcourir.
 * Le seuil est volontairement de l'ordre d'un écran : sortir doit être VOULU.
 * Mesuré sur le mouvement du doigt (touchstart → touchmove), pas sur un
 * `scrollTop` : en plein écran il n'y a plus rien qui défile verticalement.
 */
const SCROLL_CLOSE_RATIO = 0.6;
const SCROLL_CLOSE_MIN_PX = 320;

/**
 * Frise de position — fenêtre glissante de 5 points.
 *
 * Pourquoi pas tous les points : la plus grosse série en compte 38 (Street
 * Photography, vérifié en base). À 6 px de diamètre et 8 px d'écart, 38 points
 * font 524 px de large — un iPhone en fait 390. Il faudrait descendre à 4 px
 * pour les caser, soit une poussière de 12 pixels réels en DPR 3, et une frise
 * dont la longueur changerait du tout au tout d'une série à l'autre.
 *
 * Les 38 points sont donc TOUS rendus, mais la rangée est translatée et ceux
 * qui sortent de la fenêtre sont mis à l'échelle 0. Leur emplacement, lui,
 * reste réservé : la géométrie ne bouge pas, la translation reste exacte, et
 * le glissement s'anime tout seul en CSS. Un point de bord passe à 0,6 quand
 * il reste des photos au-delà — et reprend sa taille pleine quand on touche le
 * début ou la fin, ce qui est le signal « il n'y a plus rien après ».
 *
 * Jauge et NON contrôle : `pointer-events: none`. Sur ce calque un tap ferme la
 * série ; un point cliquable créerait une zone où le doigt fait autre chose
 * sans que rien ne l'annonce.
 */
function CarouselDots({ total, index }: { total: number; index: number }) {
  const win = Math.min(DOT_WINDOW, total);
  const slot = DOT + DOT_GAP;
  const start = Math.max(
    0,
    Math.min(index - Math.floor(win / 2), total - win)
  );
  const end = start + win - 1;
  return (
    <div
      aria-hidden
      style={{
        width: win * slot - DOT_GAP,
        marginLeft: 'auto',
        marginRight: 'auto',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: DOT_GAP,
          transform: `translateX(${-start * slot}px)`,
          transition: 'transform 250ms ease',
        }}
      >
        {Array.from({ length: total }, (_, i) => {
          const inWindow = i >= start && i <= end;
          const edgeWithMore =
            (i === start && start > 0) || (i === end && end < total - 1);
          return (
            <span
              key={i}
              style={{
                flex: `0 0 ${DOT}px`,
                height: DOT,
                borderRadius: 999,
                background: 'var(--color-fg)',
                opacity: !inWindow ? 0 : i === index ? 1 : 0.4,
                transform: `scale(${!inWindow ? 0 : edgeWithMore ? 0.6 : 1})`,
                transition: 'transform 250ms ease, opacity 250ms ease',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Les deux branches (desktop / mobile) sont TOUJOURS montées — c'est le CSS
 * qui en affiche une seule. Leurs écouteurs GLOBAUX (document, historique)
 * doivent donc vérifier que leur branche est visible : sans ce garde, une
 * ouverture desktop empilerait une entrée d'historique que rien ne consomme, et
 * la branche cachée fermerait le dossier au clic sur une vignette desktop (bug
 * réel payé, cf. CLAUDE.md §3.7 invariant 3).
 * `offsetParent === null` ⇔ display:none quelque part dans les ancêtres.
 */
function isVisible(el: HTMLElement | null): boolean {
  return Boolean(el && el.offsetParent !== null);
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
  onOpen: (slug: string, photoIndex?: number) => void;
  onClose: () => void;
  onSelectPhoto: (index: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<Flip.FlipState | null>(null);
  const closingStateRef = useRef<{
    slug: string;
    state: Flip.FlipState;
  } | null>(null);
  const reduced = useReducedMotion();
  const mdUp = useMdUp();
  const openSlug = openSeries?.slug ?? null;

  const openSlugRef = useRef<string | null>(null);
  openSlugRef.current = openSlug;

  // ── Ouverture ────────────────────────────────────────────────────────────
  // L'index d'arrivée est celui de la COVER, pas 0 : une série dont la cover
  // est la 5ᵉ photo s'ouvre sur cette 5ᵉ photo, au milieu de la bande, une
  // voisine visible de chaque côté. C'est ce qui dit à l'œil qu'on peut aller
  // à gauche COMME à droite.

  const handleOpen = useCallback(
    (s: PreparedSeries) => {
      if (!reduced) {
        const coverEl = listRef.current?.querySelector(
          `[data-flip-id="cover-${s.slug}"]`
        );
        if (coverEl) flipStateRef.current = Flip.getState(coverEl);
      }
      const coverIndex = Math.max(
        0,
        s.photos.findIndex((p) => p._id === s.cover._id)
      );
      onOpen(s.slug, coverIndex);
    },
    [onOpen, reduced]
  );

  /**
   * Porte unique de sortie. On y capture l'état Flip de la photo de couverture
   * TANT QU'ELLE EST ENCORE DANS LA BANDE : après le re-rendu elle n'existe
   * plus, et le vol de retour n'aurait plus de point de départ. Si la cover a
   * été emmenée hors champ par le défilement horizontal, pas de vol — un vol
   * depuis le hors-écran serait pire que pas de vol du tout.
   */
  const requestClose = useCallback(() => {
    const slug = openSlugRef.current;
    const strip = stripRef.current;
    if (slug && strip && !reduced) {
      const cover = strip.querySelector<HTMLElement>(
        `[data-flip-id="cover-${slug}"]`
      );
      const r = cover?.getBoundingClientRect();
      if (cover && r && r.right > 0 && r.left < window.innerWidth) {
        closingStateRef.current = { slug, state: Flip.getState(cover) };
      }
    }
    onClose();
  }, [onClose, reduced]);

  // ── Bande calée sur la cover, PUIS vol ──────────────────────────────────
  // L'ordre n'est pas négociable : le vol vise le rect de la photo d'arrivée,
  // et ce rect n'est juste qu'une fois la bande défilée. Voler d'abord, c'est
  // atterrir à côté puis sauter.

  useLayoutEffect(() => {
    // ── Retour à la liste ──────────────────────────────────────────────────
    const closing = closingStateRef.current;
    closingStateRef.current = null;
    if (!openSlug) {
      if (closing && !reduced) {
        Flip.from(closing.state, {
          targets: `[data-flip-id="cover-${closing.slug}"]`,
          duration: CLOSE_DUR,
          ease: 'power2.inOut',
          scale: true,
        });
      }
      return;
    }

    // ── Vers l'immersion ───────────────────────────────────────────────────
    const state = flipStateRef.current;
    flipStateRef.current = null;
    const strip = stripRef.current;
    if (strip) {
      const slide = strip.querySelectorAll<HTMLElement>('[data-strip-item]')[
        activeIndex
      ];
      // `scrollLeft` posé À LA MAIN et sans animation : `scrollIntoView` aurait
      // fait défiler AUSSI le conteneur de page, et son `behavior: 'smooth'`
      // aurait couru en même temps que le vol.
      if (slide) strip.scrollLeft = slide.offsetLeft;
    }
    if (state && !reduced) {
      Flip.from(state, {
        targets: `[data-flip-id="cover-${openSlug}"]`,
        duration: OPEN_DUR,
        ease: 'power2.inOut',
        scale: true,
      });
    }
    // `activeIndex` volontairement hors deps : il change à chaque swipe, et
    // recaler la bande à ce moment-là annulerait le geste de l'utilisateur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSlug, reduced]);

  // ── Historique : le bouton retour ramène à la liste ──────────────────────

  useEffect(() => {
    if (!openSlug || !isVisible(listRef.current)) return;
    const cleanup = pushModalHistory(requestClose);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSlug]);

  // ── Geste vertical long → retour à la liste ──────────────────────────────
  // En immersion plus rien ne défile verticalement (`touch-action: none` sur le
  // calque, `pan-x` sur la bande), donc on lit le déplacement du DOIGT depuis
  // son point de contact. Un seul geste continu doit couvrir 60 % de l'écran :
  // ni un effleurement ni l'inertie ne peuvent y arriver par accident.

  useEffect(() => {
    const el = overlayRef.current;
    if (!openSlug || !el || !isVisible(listRef.current)) return;
    const limit = () =>
      Math.max(SCROLL_CLOSE_MIN_PX, window.innerHeight * SCROLL_CLOSE_RATIO);
    let startY: number | null = null;
    let fired = false;
    let wheelAcc = 0;

    const onStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? null;
      fired = false;
    };
    const onMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (startY === null || fired || y === undefined) return;
      if (Math.abs(y - startY) > limit()) {
        fired = true;
        requestClose();
      }
    };
    const onEnd = () => {
      startY = null;
    };
    // Molette : même seuil, accumulé. Sert au test au trackpad en fenêtre
    // étroite ; sur téléphone c'est le tactile qui parle.
    const onWheel = (e: WheelEvent) => {
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) > limit()) {
        wheelAcc = 0;
        requestClose();
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [openSlug, requestClose]);

  // ── Photo courante déduite du snap de la bande ───────────────────────────

  const onStripScroll = useCallback(() => {
    const strip = stripRef.current;
    if (!strip || !openSeries) return;
    requestAnimationFrame(() => {
      const mid = strip.scrollLeft + strip.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      strip
        .querySelectorAll<HTMLElement>('[data-strip-item]')
        .forEach((el, i) => {
          const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
      if (best !== activeIndex) onSelectPhoto(best);
    });
  }, [openSeries, activeIndex, onSelectPhoto]);

  return (
    <>
      {/* Espacements en style inline — convention du projet : le reset global
          `* { padding: 0 }` (hors @layer, globals.css) écrase les utilitaires
          Tailwind de padding/margin, qui sont eux dans un @layer. */}
      <div
        ref={listRef}
        className="flex flex-col"
        style={{ paddingLeft: SIDE, paddingRight: SIDE, rowGap: ROW_GAP }}
      >
        {/* TITRE DE PAGE ORDINAIRE depuis le 2026-08-24 (homogénéisation des
            pages mobiles, demande Alexandre). C'était jusque-là le lettrage
            plein cadre de la branche desktop, réduit — il rendait à ~99 px sur
            un écran de 390, quand les six autres pages ouvraient à 48. Le
            mobile prend donc le même corps et la même gouttière que partout
            ailleurs ; le grand lettrage, avec son repli au fil de l'ouverture,
            reste la signature de la branche DESKTOP, où il a la place de
            respirer.

            Ici il ne bouge JAMAIS : le dépliage mobile est un autre geste que
            l'ouverture desktop, et la liste défile sous un titre stable.

            Le complément d'écart au-dessus de la première photo est porté ici
            et pas par le `rowGap` de la colonne : c'est un écart de TITRE, il
            n'a pas de raison de valoir aussi entre deux séries. */}
        <div style={{ paddingBottom: PAGE_TITLE_GAP - ROW_GAP }}>
          <PageTitle>Series</PageTitle>
        </div>

        {series.map((s) => {
          const isOpen = s.slug === openSlug;
          const coverRatio = s.cover.image?.dimensions?.aspectRatio ?? 4 / 3;
          const coverSrc = s.cover.image
            ? (urlFor(s.cover.image)
                ?.width(560)
                .quality(75)
                .auto('format')
                .url() ?? '')
            : '';
          return (
            <article key={s.slug} data-series-row={s.slug}>
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
                  // L'identifiant de vol est RETIRÉ tant que la série est
                  // ouverte : sa jumelle vit alors dans la bande immersive, et
                  // deux éléments portant le même `data-flip-id` feraient
                  // voler les DEUX.
                  data-flip-id={isOpen ? undefined : `cover-${s.slug}`}
                  className="block w-[42%] shrink-0 h-auto"
                  style={{ aspectRatio: String(coverRatio) }}
                />
                <span className="min-w-0">
                  <span className="block text-[14px] uppercase leading-[1.7] font-bold text-[var(--color-fg)]">
                    {s.title}
                  </span>
                  {s.year && (
                    <span
                      className={`block ${MICRO_LABEL} text-[var(--color-fg-muted)]`}
                      style={{ marginTop: 6 }}
                    >
                      {s.year}
                    </span>
                  )}
                  <span
                    className={`block ${MICRO_LABEL} text-[var(--color-fg-muted)] opacity-60`}
                    style={{ marginTop: 4 }}
                  >
                    {s.photos.length} photo{s.photos.length === 1 ? '' : 's'}
                  </span>
                </span>
              </button>
            </article>
          );
        })}
      </div>

      {/* ── Calque immersif ─────────────────────────────────────────────────
          `md:hidden` : les deux branches sont montées en permanence, sans ce
          garde une ouverture desktop poserait un calque noir sur la page.
          z-40 : SOUS le header (z-50) et le bouton MENU (z-55), qui restent
          donc cliquables sans qu'on ait à les exempter du tap-pour-fermer. */}
      {openSeries && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-40 flex flex-col md:hidden"
          style={{
            // Le papier, comme le reste du site : le calque n'a plus à
            // inverser quoi que ce soit, il masque simplement la liste.
            background: 'var(--color-bg)',
            // Le calque n'a rien à faire défiler ; la bande, elle, ne défile
            // qu'horizontalement. Un geste vertical n'emporte donc jamais la
            // page cachée derrière — et nous reste lisible.
            touchAction: 'none',
          }}
          onClick={requestClose}
        >
          {/* Réserve de la nav-bar : le logo et MENU flottent au-dessus. */}
          <div aria-hidden style={{ height: 64 }} className="shrink-0" />

          {/* Une diapo = un écran plein, SANS entrevue des voisines (arbitrage
              Alexandre, 2026-08-23) : c'est la frise de points qui dit
              désormais où l'on se trouve dans la série. La photo garde ses 20 px
              de retrait, mais à l'INTÉRIEUR de sa diapo — la voisine reste donc
              intégralement hors champ. */}
          <div
            ref={stripRef}
            onScroll={onStripScroll}
            className="flex min-h-0 flex-1 snap-x snap-mandatory items-center overflow-x-auto overscroll-x-contain"
            style={{ touchAction: 'pan-x', scrollbarWidth: 'none' }}
          >
            {openSeries.photos.map((photo, i) => {
              const ratio = photo.image?.dimensions?.aspectRatio ?? 4 / 3;
              const src = photo.image
                ? (urlFor(photo.image)
                    ?.width(1100)
                    .quality(80)
                    .auto('format')
                    .url() ?? '')
                : '';
              const isCover = photo._id === openSeries.cover._id;
              const isActive = i === activeIndex;
              return (
                <div
                  key={photo._id}
                  data-strip-item
                  className="flex h-full w-screen shrink-0 snap-center flex-col items-center justify-center"
                  style={{ paddingLeft: SIDE, paddingRight: SIDE }}
                >
                  {/* Titre et fiche technique vivent DANS la diapo, pas dans le
                      calque : c'est la seule façon de les coller aux bords de
                      l'image sans mesurer quoi que ce soit — le bloc est une
                      colonne centrée, la photo lui donne sa hauteur, le texte
                      la suit. Ils ne sont opaques que sur la diapo active :
                      deux photos de hauteurs différentes portent leurs textes à
                      deux hauteurs différentes, et on les verrait se croiser
                      pendant le swipe. Le fondu bascule au passage de la
                      moitié, quand `activeIndex` change. */}
                  <p
                    className="w-full shrink-0 text-[12px] uppercase font-bold text-[var(--color-fg)]"
                    style={{
                      paddingBottom: 10,
                      opacity: isActive ? 1 : 0,
                      transition: 'opacity 200ms ease',
                    }}
                  >
                    {openSeries.title}
                    {openSeries.year && (
                      <span
                        className="text-[var(--color-fg-muted)]"
                        style={{ marginLeft: 10 }}
                      >
                        {openSeries.year}
                      </span>
                    )}
                  </p>

                  {/* Dimensions INTRINSÈQUES déclarées (attributs width/height
                      depuis Sanity) : la boîte est juste avant même que le
                      fichier arrive, donc le vol vise un rect réel et non un
                      rect nul. Les deux plafonds font le reste — largeur
                      d'abord, hauteur en garde-fou pour les portraits les plus
                      hauts — et le ratio est préservé, c'est le comportement
                      défini des éléments remplacés. */}
                  <img
                    src={src}
                    alt={photo.image?.alt ?? photo.title}
                    width={1100}
                    height={Math.round(1100 / ratio)}
                    loading={
                      !mdUp && Math.abs(i - activeIndex) <= 1 ? 'eager' : 'lazy'
                    }
                    decoding="async"
                    data-flip-id={
                      isCover ? `cover-${openSeries.slug}` : undefined
                    }
                    className="block shrink-0"
                    style={{
                      maxWidth: '100%',
                      maxHeight: `calc(100dvh - ${PHOTO_V_RESERVE}px)`,
                    }}
                  />

                  <SeriesMeta
                    photo={photo}
                    grouped
                    className="w-full shrink-0 text-right"
                    style={{
                      paddingTop: 10,
                      opacity: isActive ? 1 : 0,
                      transition: 'opacity 200ms ease',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Frise FIXE, seul élément qui ne suit pas la photo : elle décrit la
              SÉRIE, pas l'image courante. Une jauge qui saute de 200 px entre
              un portrait et un panoramique serait une jauge qu'on doit
              chercher. */}
          <div
            className="shrink-0"
            style={{
              paddingTop: 20,
              paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
            }}
          >
            <CarouselDots
              total={openSeries.photos.length}
              index={activeIndex}
            />
          </div>
        </div>
      )}
    </>
  );
}
