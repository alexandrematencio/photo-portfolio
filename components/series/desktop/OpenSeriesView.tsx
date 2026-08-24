import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { Undo2 } from 'lucide-react';
import { urlFor } from '@/lib/sanity/image';
import type { PreparedSeries } from '@/lib/site/series';
import { cn } from '@/lib/utils/cn';
import { SeriesMeta, META_LINE_PX } from '../shared/SeriesMeta';
import { centerSrcFor } from '../shared/photoSrc';
import { useMdUp } from '../shared/useMdUp';
import { colLeadReserve } from '../shared/colLead';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';
import { StateDot, STATE_DOT_SIZE } from '@/components/site/StateDot';

/**
 * État ouvert desktop (spec §5) : trois zones —
 *   gauche  : noms des séries (navigation directe, sans repasser par la rangée)
 *   centre  : image affichée + « Back to All Series » au coin haut-gauche + métadonnées
 *             collées en bas à droite de l'image
 *   droite  : colonne de vignettes, défilement natif à la molette
 *
 * Chrome ancré à l'IMAGE, pas au conteneur (règle §3.4 du CLAUDE.md) : le
 * wrapper `w-fit` épouse l'image, le bouton retour et Meta se positionnent contre lui.
 *
 * Les attributs data-* sont les points de mesure des vols (animations.ts).
 */

/**
 * Le chrome ancré à l'image — le retour au-dessus, métadonnées en dessous —
 * est en `absolute`, donc HORS FLUX : la place qu'on ne lui réserve pas, il la
 * prend sous le footer, sans un mot (bug réel : les métadonnées se sont
 * retrouvées coupées le jour où la scène a perdu 30 px pour laisser voir le
 * footer). On la lui réserve donc explicitement, en padding sur la cellule.
 */
const CHROME_TOP = 32; // ligne « Back to All Series » + son marginBottom de 12
/** Bloc SeriesMeta : jusqu'à 4 lignes + son marginTop de 12. Le produit est
 *  CALCULÉ, jamais transcrit — l'interligne du bloc a déjà changé une fois
 *  (18 → 15 px le 2026-08-24) et cette réserve doit suivre du même geste. */
const CHROME_BOTTOM = 4 * META_LINE_PX + 12;

/**
 * Hauteur max de l'image centrale = hauteur de scène − paddingTop de la vue
 * ouverte − le chrome ci-dessus. Les quatre valeurs doivent bouger ensemble
 * (§3.7 invariant 11) : les deux premières vivent dans DesktopSeries, on les
 * nomme ici pour que la soustraction reste lisible plutôt que d'écrire son
 * résultat.
 */
const SCENE_RESERVE = 160; // DesktopSeries : hauteur de scène = 100dvh − 160
const OPEN_PADDING_TOP = 24; // DesktopSeries : paddingTop de la vue ouverte
const CENTER_MAX_H = `calc(100dvh - ${
  SCENE_RESERVE + OPEN_PADDING_TOP + CHROME_TOP + CHROME_BOTTOM
}px)`;

/**
 * Gouttière de la LED de la colonne de vignettes : le voyant qui dit « photo
 * en cours de visualisation » se pose À GAUCHE de la vignette active, hors de
 * l'image. Elle est réservée en `paddingLeft` sur la colonne — le conteneur
 * défilant clippe à son padding box, un point posé en négatif SANS cette
 * réserve serait rogné — et REND sa largeur à la grille pour que les
 * vignettes gardent la leur. Largeur dérivée du voyant (STATE_DOT_SIZE),
 * jamais transcrite : même doctrine que StateDotBalance.
 */
/**
 * Écart entre le voyant et le bord de la vignette. PROPRE à cette colonne, et
 * volontairement plus large que les 6 px de la colonne des noms de séries
 * (posés en `gap` sur le bouton, dans ce même fichier — ne pas les aligner) :
 * là-bas le point ouvre une ligne de texte et l'écart de mot suffit ; ici il
 * borde une photo pleine, et deux images qui se touchent presque se lisent
 * comme un seul bloc. Les deux éléments doivent respirer (demande Alexandre,
 * 2026-08-24).
 */
const COL_DOT_GAP = 14;
const COL_DOT_GUTTER = STATE_DOT_SIZE + COL_DOT_GAP;
/** Largeur utile des vignettes (la valeur historique de la colonne). */
const COL_THUMB_W = 132;

/**
 * Allumage / extinction de la LED — les deux temps d'une diode, pas un
 * cross-fade : l'extinction part la première, le rallumage la SUIT (ou attend
 * la pose des vols, voir l'effet). Ease `power2.out`, le standard du site
 * (§3.2) : rapide, mais doux.
 */
const LED_OFF = 0.12;
const LED_ON = 0.18;

export function OpenSeriesView({
  allSeries,
  displayed,
  activeIndex,
  onClose,
  onSwitch,
  onSelect,
}: {
  allSeries: PreparedSeries[];
  displayed: PreparedSeries;
  activeIndex: number;
  onClose: () => void;
  onSwitch: (slug: string) => void;
  onSelect: (index: number) => void;
}) {
  const mdUp = useMdUp();
  const reduced = useReducedMotion();
  const colRef = useRef<HTMLDivElement>(null);
  /** Index dont la LED détient (ou attend) la lumière — voir l'effet LED. */
  const litIndexRef = useRef<number | null>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const active = displayed.photos[activeIndex] ?? displayed.photos[0];
  // Source unique de l'URL 1600 px (partagée avec le préchargement et
  // l'affinage des clones — voir photoSrc.ts).
  const centerSrc = centerSrcFor(active);
  const activeRatio = active.image?.dimensions?.aspectRatio ?? 4 / 3;

  // Hauteur des deux vides = réserve gardée derrière la ligne de pose.
  // Remesurée à chaque série (les ratios changent) et à chaque
  // redimensionnement de la colonne. En effet de LAYOUT : la course de
  // défilement doit être bonne avant que `settleColScroll` ne pose la colonne
  // pour les vols.
  useLayoutEffect(() => {
    const col = colRef.current;
    const head = headRef.current;
    const tail = tailRef.current;
    if (!col || !head || !tail) return;
    const apply = () => {
      const px = `${Math.round(colLeadReserve(col))}px`;
      if (head.style.height === px && tail.style.height === px) return;
      // La colonne est posée SOUS le vide de tête (settleColScroll) : la
      // faire suivre, sinon changer de hauteur découvrirait ce vide au repos.
      const before = head.offsetHeight;
      head.style.height = px;
      tail.style.height = px;
      col.scrollTop += head.offsetHeight - before;
    };
    apply();
    // Les vides ne changent que la hauteur DÉFILANTE, jamais la boîte de la
    // colonne (hauteur imposée par la grille) : pas de boucle d'observation.
    const ro = new ResizeObserver(apply);
    ro.observe(col);
    return () => ro.disconnect();
  }, [displayed.slug, displayed.photos.length]);

  /**
   * LED « photo en cours de visualisation » — UNE seule allumée, jamais deux,
   * et jamais visible ailleurs qu'à la pose. Trois règles, chacune tenue par
   * construction :
   *
   * 1. **Séquence de diode, pas de cross-fade.** Au changement de photo,
   *    l'ancienne LED s'ÉTEINT d'abord (LED_OFF) ; la nouvelle ne s'allume
   *    qu'ensuite. Deux LED en fondu simultané à des hauteurs différentes se
   *    lisent comme un déplacement — c'est exactement ce qu'on ne veut pas.
   *
   * 2. **Le rallumage attend la POSE, pas le commit React.** Pendant un vol
   *    (échange, ouverture, changement de série), la vignette active est
   *    masquée sous les clones — une LED allumée à côté d'un emplacement vide
   *    dirait n'importe quoi. La visibilité CALCULÉE de l'<img> active est la
   *    vérité unique : elle hérite du masquage quel qu'en soit le porteur
   *    (colonne entière, bouton, ou la seule image comme dans les chaînes
   *    d'échange), et son retour à `visible` — le clearProps du raccord
   *    clone → réel — est LE signal de pose. Un MutationObserver sur les
   *    attributs style le capte sans polling ni écouteur scroll : rien du
   *    mécanisme de la colonne n'est touché. Pendant une chaîne rapide, seul
   *    le dernier index demandé garde son observer (cleanup) : la LED reste
   *    éteinte tout du long et se rallume une fois, sur la photo posée.
   *
   * 3. **gsap est le SEUL maître de l'opacité des LED.** Le wrapper n'a pas
   *    de transition CSS (une transition sous un tween = double lissage,
   *    traîne visible) et React n'écrit son opacité qu'au montage (0) : les
   *    valeurs posées par gsap survivent aux re-renders.
   *
   * Mode de panne assumé : si la vignette n'est jamais révélée, la LED reste
   * ÉTEINTE — une LED sombre est juste, une LED au mauvais endroit ne l'est
   * jamais.
   */
  useLayoutEffect(() => {
    const col = colRef.current;
    if (!col) return;
    const dotOf = (i: number) =>
      col.querySelector<HTMLElement>(`[data-col-dot="${i}"]`);

    // Extinction de la détentrice précédente — y compris une LED encore en
    // train de monter (killTweensOf) : la lumière change de main tout de suite.
    const prev = litIndexRef.current;
    let handoff = false;
    if (prev !== null && prev !== activeIndex) {
      const d = dotOf(prev);
      if (d) {
        gsap.killTweensOf(d);
        gsap.to(d, {
          opacity: 0,
          duration: reduced ? 0 : LED_OFF,
          ease: 'power2.out',
        });
        handoff = true;
      }
    }
    litIndexRef.current = activeIndex;

    const target = dotOf(activeIndex);
    const img = col.querySelector<HTMLElement>(
      `[data-col-img="${activeIndex}"]`
    );
    const item = col.querySelector<HTMLElement>(
      `[data-col-item="${activeIndex}"]`
    );
    if (!target || !img) return;

    const posed = () => getComputedStyle(img).visibility !== 'hidden';
    const lightUp = (delay: number) => {
      gsap.killTweensOf(target);
      gsap.to(target, {
        opacity: 1,
        duration: reduced ? 0 : LED_ON,
        delay: reduced ? 0 : delay,
        ease: 'power2.out',
      });
    };

    if (posed()) {
      // Vignette déjà posée (chemin instant, ou reprise sans vol) : la LED
      // s'allume après l'extinction si l'on vient d'en éteindre une — les
      // deux temps de la diode, même sans vol entre eux.
      lightUp(handoff ? LED_OFF : 0);
      return;
    }
    const obs = new MutationObserver(() => {
      if (!posed()) return;
      obs.disconnect();
      lightUp(0);
    });
    for (const el of [img, item, col]) {
      if (el) obs.observe(el, { attributes: true, attributeFilter: ['style'] });
    }
    return () => obs.disconnect();
  }, [activeIndex, displayed.slug, reduced]);

  return (
    <div
      className="grid h-full gap-8"
      style={{
        gridTemplateColumns: `176px 1fr ${COL_THUMB_W + COL_DOT_GUTTER}px`,
      }}
    >
      {/* ── Noms des séries ─────────────────────────────────────────────── */}
      {/* Espacements fins en inline — le reset global hors @layer neutralise
          les utilitaires Tailwind de padding/margin (cf. MobileSeries). */}
      <nav
        aria-label="Series"
        data-open-left
        className="flex flex-col justify-end gap-3"
        style={{ paddingBottom: 8 }}
      >
        {allSeries.map((s) => {
          const isActive = s.slug === displayed.slug;
          return (
            <button
              key={s.slug}
              type="button"
              onClick={() => (isActive ? undefined : onSwitch(s.slug))}
              aria-current={isActive || undefined}
              // L'état actif se lit sur DEUX canaux, pas un.
              //
              // Le contraste d'abord (pas de soulignement) : encre pleine
              // 18,8:1 contre gris 5,06:1 — l'écart de valeur suffit à lire
              // l'actif, et l'inactif passe WCAG AA. (Avant : gris à 60 %
              // d'opacité = 2,37:1, sous le minimum.)
              //
              // Le voyant ensuite (2026-08-23, demande Alexandre) : dans une
              // colonne de noms tous en 12 px capitales grasses, un simple
              // écart de gris se remarque mal — il faut comparer deux libellés
              // pour savoir lequel est allumé. Le point, lui, se voit sans
              // comparaison. Il vaut aussi pour l'a11y : la série active se
              // repère alors à une FORME, pas seulement à une valeur de gris
              // (WCAG 2.2 §1.4.1).
              //
              // `gap` en inline plutôt qu'en `gap-*` : ce composant pose déjà
              // tous ses espacements fins ainsi (le reset global hors @layer
              // avale les utilities de padding/margin) — on ne mélange pas les
              // deux conventions dans un même bloc.
              style={{ gap: 6 }}
              className={cn(
                'inline-flex w-fit items-start text-left text-[12px] uppercase font-bold leading-[1.45] transition-colors motion-reduce:transition-none',
                isActive
                  ? 'text-[var(--color-fg)] cursor-default'
                  : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] cursor-pointer'
              )}
            >
              {/* Le point est centré sur la PREMIÈRE LIGNE, pas sur le bloc.
                  La colonne fait 176 px et le plus long titre en base (« Beach
                  girls triptych », 20 caractères) la remplit déjà presque
                  entièrement : les 13 px pris par le point et son écart
                  suffisent à le faire passer sur deux lignes. Avec un
                  `items-center` sur le bouton, le point atterrirait alors
                  ENTRE les deux lignes. La boîte d'une hauteur de ligne
                  (`1.45em`, la même valeur que le `leading` du bouton) le
                  cale sur la première quoi qu'il arrive. */}
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '1.45em',
                  flex: 'none',
                }}
              >
                <StateDot on={isActive} />
              </span>
              {s.title}
            </button>
          );
        })}
      </nav>

      {/* ── Image centrale ──────────────────────────────────────────────── */}
      <div
        className="relative flex min-w-0 flex-col"
        style={{ paddingTop: CHROME_TOP, paddingBottom: CHROME_BOTTOM }}
      >
        {/* `data-open-center` sur la boîte de CONTENU (padding exclu) : c'est le
            rect que runSwap utilise pour prédire la position de l'image
            entrante. Le poser sur la cellule paddée décalerait la prédiction de
            la moitié de l'asymétrie du chrome — soit un saut visible au
            raccord clone → réel. */}
        <div
          data-open-center
          className="flex min-h-0 flex-1 items-center justify-center"
        >
        <div data-center-wrap className="relative w-fit max-w-full">
          <button
            type="button"
            onClick={onClose}
            data-open-close
            className="absolute left-0 bottom-full flex items-center cursor-pointer text-[11px] uppercase font-bold text-[var(--color-fg)] hover:opacity-60 transition-opacity motion-reduce:transition-none"
            style={{ marginBottom: 12, gap: 8 }}
          >
            {/* Demi-tour et non la flèche simple « ← » (demande Alexandre,
                2026-08-23) : une flèche gauche dit « à gauche », le u-turn dit
                « on revient d'où l'on vient » — c'est le second sens qui est
                juste ici. `aria-hidden` : le libellé porte déjà tout le message
                pour un lecteur d'écran. */}
            <Undo2 size={14} strokeWidth={2} aria-hidden />
            Back to All Series
          </button>

          {/* aspect-ratio + width calculée : le layout est complet AVANT le
              chargement du fichier — les vols mesurent des rects justes même
              sur image froide (bug réel : rects nuls → aucun fantôme). */}
          {/* `lazy` quand la branche est cachée (viewport mobile) : cette vue
              est quand même rendue à l'ouverture, et une <img> eager en
              display:none télécharge son fichier — 1600 px pour rien, sur
              cellulaire (cf. useMdUp). Lazy sans boîte = jamais chargée. */}
          <img
            src={centerSrc}
            alt={active.image?.alt ?? active.title}
            loading={mdUp ? 'eager' : 'lazy'}
            decoding="async"
            data-center-img
            className="block max-w-full object-contain"
            style={{
              aspectRatio: String(activeRatio),
              width: `min(100%, calc(${CENTER_MAX_H} * ${activeRatio}))`,
              maxHeight: CENTER_MAX_H,
            }}
          />

          {/* Spec §5 : collé en bas à droite de l'image, même écart que la
              légende de la démo — PAS de légende centrée. */}
          <SeriesMeta
            photo={active}
            className="absolute right-0 top-full"
            style={{ marginTop: 12 }}
          />
        </div>
        </div>
      </div>

      {/* ── Colonne de vignettes ────────────────────────────────────────── */}
      <div
        ref={colRef}
        data-open-col
        className="flex h-full flex-col gap-2 overflow-y-auto overscroll-contain"
        style={{ paddingRight: 4, paddingLeft: COL_DOT_GUTTER }}
      >
        {/* Vide de tête : la course de défilement qui manque pour que la
            PREMIÈRE vignette puisse se poser sur la ligne de pose haute au
            lieu de rester collée au bord. Il n'est jamais visible au repos —
            la colonne s'ouvre posée dessous. */}
        <div ref={headRef} data-col-head aria-hidden className="shrink-0" />
        {displayed.photos.map((photo, i) => {
          const src = photo.image
            ? (urlFor(photo.image)?.width(280).quality(75).auto('format').url() ?? '')
            : '';
          const isActive = i === activeIndex;
          return (
            <button
              key={photo._id}
              type="button"
              onClick={() => onSelect(i)}
              data-col-item={i}
              aria-current={isActive || undefined}
              aria-label={`Show “${photo.title}”`}
              className={cn(
                'relative w-full shrink-0 transition-opacity motion-reduce:transition-none',
                isActive ? 'cursor-default' : 'cursor-pointer hover:opacity-80'
              )}
            >
              {/* LED de la photo visualisée (chorégraphie : effet LED
                  ci-dessus). Posée dans la gouttière à gauche de SA vignette,
                  centrée sur sa hauteur — ancrée au bouton, elle en suit le
                  défilement et les masquages de vols sans une ligne de code,
                  et ne peut par construction jamais quitter sa verticale.
                  Toujours rendue sur chaque vignette (contrat StateDot) :
                  c'est le WRAPPER que gsap allume, le point reste `on` en
                  continu — sa transition CSS interne ne joue donc jamais et
                  ne double-lisse pas le tween. `opacity: 0` React n'est écrit
                  qu'au montage : les valeurs gsap survivent aux re-renders. */}
              <span
                data-col-dot={i}
                aria-hidden
                style={{
                  position: 'absolute',
                  left: -COL_DOT_GUTTER,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  opacity: 0,
                }}
              >
                <StateDot on />
              </span>
              <img
                src={src}
                alt=""
                loading="lazy"
                data-col-img={i}
                className="block w-full"
                style={{
                  aspectRatio: String(
                    photo.image?.dimensions?.aspectRatio ?? 4 / 3
                  ),
                }}
              />
            </button>
          );
        })}
        {/* Queue vide : la course de défilement qui manque pour que la
            DERNIÈRE vignette puisse elle aussi se poser sur la ligne de pose,
            au lieu de rester collée au bord bas. C'est ce vide qui remonte en
            fin de série et annonce la sortie. Hauteur mesurée (colLead.ts) —
            un vrai élément et non un `padding-bottom` : la fin de padding
            d'un conteneur flex défilant n'est pas comptée dans la course de
            défilement par tous les moteurs, un enfant l'est toujours. */}
        <div ref={tailRef} data-col-tail aria-hidden className="shrink-0" />
      </div>
    </div>
  );
}
