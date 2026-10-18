'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * « ALXMTNC » d'un bord à l'autre du pied de page — l'idée du pied de page
 * d'AAXLO (`AppFooterV2.vue`, logo pleine largeur), transposée au glyph du
 * splash (2026-10-18, demande Alexandre).
 *
 * **Recette de `SeriesWordmark`** : le `viewBox` donne le ratio, `textLength`
 * force la chasse à la largeur du viewBox, `lengthAdjust="spacing"` fait
 * absorber l'écart par l'interlettrage, jamais par les glyphes. Le remplissage
 * est garanti par CONSTRUCTION — `--font-display` est une pile SYSTÈME
 * (Helvetica Neue, Arial, Roboto), une taille en `vw` calibrée sur l'une
 * déborderait sur l'autre.
 *
 * Cotes calibrées sur Helvetica Bold : « ALXMTNC » pèse 4,888 em à chasse
 * naturelle (A 722, L 611, X 667, M 833, T 611, N 722, C 722), d'où
 * `FONT_SIZE = 1000 / 4,888`. La boîte épouse la hauteur de capitale
 * (0,714 em), plus `OVERSHOOT` de chaque côté pour le dépassement du C.
 *
 * **Entrée** : chaque lettre monte de sous la ligne de base, rognée par le
 * SVG (`overflow: hidden`) — comme les lettres d'AAXLO. Les lettres sont des
 * `<tspan>` à `y` ABSOLU : un `y` par lettre ne touche pas à l'avance
 * horizontale, donc `textLength` tient pendant tout le trajet (un `dy`, lui,
 * serait cumulatif et décalerait toutes les lettres suivantes). Le statique est
 * le défaut : le HTML servi porte le mot posé, l'état caché n'est écrit qu'au
 * montage, quand le pied de page est de toute façon sous l'horizon (§7.6).
 * Mouvement réduit lu sur `matchMedia` → rien ne bouge.
 */

const VIEWBOX_W = 1000;
const FONT_SIZE = 204.58;
const CAP = 146;
const OVERSHOOT = 4;
const LETTERS = 'ALXMTNC'.split('');

export function FooterWordmark() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const letters = svg.querySelectorAll('tspan');
    gsap.set(letters, { attr: { y: CAP + CAP + OVERSHOOT * 2 } });

    const tl = gsap.timeline({ paused: true });
    tl.to(letters, {
      attr: { y: CAP },
      duration: 0.6,
      stagger: 0.05,
      ease: 'expo.out',
    });

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        tl.play();
        observer.disconnect();
      },
      { threshold: 0.2 }
    );
    observer.observe(svg);

    return () => {
      observer.disconnect();
      tl.kill();
      gsap.set(letters, { attr: { y: CAP } });
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 ${-OVERSHOOT} ${VIEWBOX_W} ${CAP + OVERSHOOT * 2}`}
      aria-hidden="true"
      focusable="false"
      className="block h-auto w-full overflow-hidden"
    >
      <text
        x="0"
        y={CAP}
        fontSize={FONT_SIZE}
        textLength={VIEWBOX_W}
        lengthAdjust="spacing"
        fill="currentColor"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
      >
        {LETTERS.map((l, i) => (
          <tspan key={i} y={CAP}>
            {l}
          </tspan>
        ))}
      </text>
    </svg>
  );
}
