'use client';

import { useEffect, useRef, useState } from 'react';
import { PhotoBlock } from './PhotoBlock';
import { PhotoLightbox } from './PhotoLightbox';
import type { Photo } from '@/lib/sanity/queries';
import type { MotionSettings } from '@/lib/sanity/queries';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

type Props = {
  photos: Photo[];
  motion: MotionSettings;
};

/**
 * Fondu d'entrée/sortie : portion de la HAUTEUR de l'image parcourue près du
 * bord du viewport pendant laquelle l'opacité monte (entrée) ou descend
 * (sortie). 0,25 = fondu discret, cantonné aux bords : une photo est à 100 %
 * d'opacité dès que 25 % d'elle est entrée — donc TOUTE photo entièrement
 * visible est pleine et entière, sans avoir à l'aligner au centre
 * (demande Alexandre 2026-08-22).
 */
const EDGE_FADE_PORTION = 0.25;

/**
 * Dérive verticale du bloc pendant son fondu, en px (fourchette du brand
 * book : 16-24 px). Le SIGNE suit le bord traversé : un bloc qui entre par
 * le bas part 20 px plus bas et MONTE se poser ; un bloc qui sort par le
 * haut monte en s'effaçant. Comme tout est piloté par la position (jamais
 * par le temps), remonter la page rejoue exactement le chemin inverse — le
 * bloc qui revient par le haut DESCEND en apparaissant.
 *
 * ⚠️ La dérive est posée sur les ENFANTS (`.photo-figure`, `.photo-meta`),
 * jamais sur `.photo-item` : c'est son rect qui pilote tout le calcul, le
 * translater ferait boucler la mesure sur elle-même.
 */
const DRIFT_PX = 20;

/**
 * Opacité maximale du grain de transition, et la courbe qui l'amène.
 *
 * `o²·(1−o)` culmine à o = 2/3 et non à mi-fondu — décalage VOULU. Le fondu
 * étant cantonné au bord de la fenêtre, un bloc à faible opacité n'a qu'une
 * mince bande à l'écran (85 px sur un bloc de 684 à o = 0,5) : y mettre le
 * maximum de grain, c'est le mettre là où presque personne ne le voit. La
 * courbe le décale vers le haut, là où la bande visible est large. Zéro à
 * o = 1 : un bloc posé n'a jamais de grain.
 */
const GRAIN_MAX = 0.5;
const GRAIN_PEAK = 4 / 27; // max de o²·(1−o), pour normaliser la courbe à 1

/**
 * Galerie de la curation (home). Depuis le 2026-08-22 (décision Alexandre) :
 * AUCUNE animation au scroll autre que le scroll lui-même —
 * - Lenis pour le smooth scroll (le hero §3.6 s'appuie dessus), et
 * - un fondu d'entrée/sortie scrubbé aux bords du viewport (voir
 *   EDGE_FADE_PORTION) : les blocs arrivent un par un en fade-in par le bas,
 *   sortent en fade-out par le haut (et inversement en remontant).
 * La parallaxe per-item et la distorsion pilotée par la vélocité
 * (scale/skewY/rotateX) sont SUPPRIMÉES — version archivée dans
 * FREELANCE/RESOURCES/existing-components/scroll-velocity-distortion/.
 * Respect strict de prefers-reduced-motion (CLAUDE.md §3.2), cleanup complet.
 */
export function ScrollPhysicsGallery({ photos }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const items = photos.length > 0 ? photos : Array.from({ length: 6 }, () => null);
  // Single carousel instance per page — owned by the parent that has the
  // full photos array. PhotoBlock notifies us with the clicked index.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const stage = stageRef.current;
    if (!stage) return;

    let cleanup: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      const [{ default: Lenis }, gsapModule, scrollTriggerModule] = await Promise.all([
        import('lenis'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);

      if (cancelled) return;

      const gsap = gsapModule.default ?? gsapModule;
      const ScrollTrigger =
        (scrollTriggerModule as { ScrollTrigger?: typeof import('gsap/ScrollTrigger').ScrollTrigger })
          .ScrollTrigger ?? scrollTriggerModule.default;

      gsap.registerPlugin(ScrollTrigger);

      // 1. SMOOTH SCROLL — Lenis
      const lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time: number) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);

      // 2. FONDU D'ENTRÉE / SORTIE aux bords du viewport — calculé à chaque
      // frame depuis les RECTS mesurés, jamais depuis des positions de
      // triggers figées : la home a un hero pinné qui déplace le layout après
      // coup (§3.6), et des tweens scrubbés sur positions pré-calculées
      // fondaient ~100 px trop tôt (mesuré — l'item fondait encore sous le
      // bord). Le rect, lui, EST ce que l'œil voit ; piloté par la position
      // (pas le temps), remonter refait le chemin inverse à l'identique.
      //
      // Entrée : l'opacité monte de 0 → 1 pendant que les premiers 25 % de la
      // photo franchissent le bord bas. Sortie : 1 → 0 pendant que les
      // derniers 25 % franchissent le bord haut. Entre les deux, opacité 1 :
      // toute photo entièrement visible est pleine et entière, où qu'elle
      // soit dans l'écran (pas besoin de l'aligner au centre). Coût : ~30
      // lectures de rect par frame de scroll, aucune écriture invalidant le
      // layout (opacity seule).
      const photoItems = Array.from(
        stage.querySelectorAll<HTMLElement>('.photo-item')
      ).map((el) => ({
        el,
        // Les deux moitiés du bloc portent la dérive ; la photo porte en plus
        // le grain (son ::after).
        parts: Array.from(
          el.querySelectorAll<HTMLElement>('.photo-figure, .photo-meta')
        ),
        figure: el.querySelector<HTMLElement>('.photo-figure'),
      }));
      const triggers: ReturnType<typeof ScrollTrigger.create>[] = [];

      const applyEdgeFades = () => {
        const vh = window.innerHeight;
        for (const { el, parts, figure } of photoItems) {
          const r = el.getBoundingClientRect();
          const fadePx = Math.max(1, r.height * EDGE_FADE_PORTION);
          const enter = (vh - r.top) / fadePx; // profondeur d'entrée (bord bas)
          const exit = r.bottom / fadePx; // marge restante avant le bord haut
          const o = gsap.utils.clamp(0, 1, Math.min(enter, exit));
          el.style.opacity = String(o);
          // visibility coupée à 0 : une photo hors écran ne doit être ni
          // cliquable ni annoncée (les blocs sont des <button>).
          el.style.visibility = o === 0 ? 'hidden' : '';

          // Dérive : le bord traversé donne le sens (cf. DRIFT_PX).
          const ty = (1 - o) * DRIFT_PX * (enter < exit ? 1 : -1);
          const transform = o === 1 ? '' : `translate3d(0, ${ty.toFixed(2)}px, 0)`;
          for (const part of parts) part.style.transform = transform;

          // Grain : culmine aux deux tiers du fondu, nul au repos.
          figure?.style.setProperty(
            '--grain',
            ((GRAIN_MAX * (o * o * (1 - o))) / GRAIN_PEAK).toFixed(3)
          );
        }
      };

      triggers.push(
        ScrollTrigger.create({
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: applyEdgeFades,
          onRefresh: applyEdgeFades,
        })
      );
      applyEdgeFades();

      cleanup = () => {
        // On ne tue QUE nos propres triggers (sinon on bute ceux du HomeHero).
        triggers.forEach((t) => t?.kill());
        lenis.destroy();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reducedMotion]);

  return (
    <>
      <section id="gallery-start" aria-labelledby="selected-works">
        {/* Titre de section, CENTRÉ SUR L'ÉCRAN — d'où sa position hors du
            stage, qui est plafonné en largeur et calé à gauche. Il tombe
            « bien sous la ligne d'horizon » sans calcul : le hero est pinné
            sur 100svh + la course du morph, la galerie ne commence qu'après.
            H2 et non H1 — le H1 de la home est son titre sr-only (§5.4). */}
        <header className="gallery-heading">
          <h2 id="selected-works" className="gallery-title">
            {/* Le texte LISIBLE (SEO, lecteurs d'écran) reste du texte : les
                deux SVG ci-dessous n'en sont que le rendu, d'où leur
                `aria-hidden`. */}
            <span className="sr-only">Selected Works</span>

            {/* PLEINE LARGEUR À TOUTES LES LARGEURS, sans JS et sans mesure.
                Le SVG est en `width: 100%`, son `viewBox` lui donne son ratio
                (donc sa hauteur), et `textLength` FORCE la chasse du texte à
                la largeur du viewBox : le remplissage est garanti par
                construction, pas calculé.

                Pourquoi pas un `calc()` sur une constante mesurée : le titre
                hérite de `--font-display`, qui est une pile SYSTÈME
                (Helvetica Neue sur macOS, Arial sur Windows, Roboto sur
                Android). Leurs chasses diffèrent — une constante calibrée sur
                l'une déborderait sur l'autre, et un débord ici, c'est du
                scroll horizontal. `textLength` ne dépend d'aucune métrique.

                `lengthAdjust="spacing"` et jamais `spacingAndGlyphs` : c'est
                l'interlettrage qui absorbe l'écart, les glyphes ne sont
                jamais déformés.

                Les `viewBox` sont calibrés sur Helvetica Bold pour que la
                correction soit nulle sur macOS : « SELECTED », le mot le plus
                long, y pèse 5,334 em à chasse naturelle, d'où
                `fontSize = 1000 / 5,334 = 187,48`. La hauteur de boîte est la
                hauteur de capitale (0,714 em = 134), l'interligne vaut 0,9 em
                (169) : la seconde ligne pose donc sa base à 303, qui est aussi
                la hauteur du `viewBox`. `overflow: visible` en garde-fou : si
                la fonte servie a une capitale plus haute, elle déborde dans
                les 16vh de padding au lieu d'être rognée.

                ⚠️ Recalibré le 2026-08-24, en même temps que « SERIES » : la
                recette retranchait 0,02 em d'interlettrage par caractère
                (5,174 em, `fontSize = 193,28`, boîte 312). Le site n'a plus
                aucun interlettrage de titre. Les quatre nombres du `viewBox`
                vont ensemble. */}

            {/* DEUX LIGNES À TOUTES LES LARGEURS (arbitrage Alexandre,
                2026-08-22) — pas de variante une-ligne, donc pas de bascule
                au point de rupture. Les deux lignes partagent la MÊME taille,
                si bien que c'est « SELECTED », le mot le plus long, qui
                commande le remplissage ; « WORKS » s'arrête à ~72 % de la
                largeur. C'est la contrepartie assumée du corps commun.

                ⚠️ Ne PAS réintroduire une seconde variante masquée en
                `hidden` / `md:hidden` : la règle `.gallery-title svg` de
                `globals.css` pose `display: block` HORS `@layer`, donc elle
                écrase les utilities `display` de Tailwind (même piège que le
                reset `* { padding: 0 }`, CLAUDE.md §7.6). Les deux SVG
                s'affichaient à la suite — bug réel payé le jour même. */}
            <svg viewBox="0 0 1000 303" aria-hidden="true" focusable="false">
              <text x="0" y="134" fontSize="187.48" textLength="1000" lengthAdjust="spacing">
                SELECTED
              </text>
              <text x="0" y="303" fontSize="187.48">
                WORKS
              </text>
            </svg>
          </h2>
        </header>
        <div ref={stageRef} className="gallery-stage">
        {items.map((photo, index) => (
          <PhotoBlock
            key={photo?._id ?? `placeholder-${index}`}
            photo={photo}
            index={index}
            onOpen={(i) => setOpenIndex(i)}
          />
        ))}
        </div>
      </section>
      {openIndex !== null && photos.length > 0 && (
        <PhotoLightbox
          photos={photos}
          initialIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
