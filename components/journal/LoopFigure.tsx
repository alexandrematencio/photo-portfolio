import type { CSSProperties } from 'react';
import { MICRO_LABEL, EDITORIAL_SIDENOTE } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';

/**
 * FIG. 1 — la boucle corps-cerveau et le décalage qu'elle prédit, dessinés
 * d'après le texte. SVG en ligne plutôt qu'une image : le texte reste
 * lisible par les machines (§5 SEO — rien d'indexable dans une image seule),
 * les traits suivent les jetons de couleur, et il pèse 2 Ko.
 *
 * Encre seule : noir et gris de métadonnée. L'orange dit un état, il ne
 * dessine pas (§4.3).
 *
 * Une seule géométrie aux deux largeurs, bornée à la mesure de lecture : le
 * corps des libellés (15 unités sur 680) tombe à ~9 px sur un téléphone de
 * 390 px. C'est la limite basse ; un schéma plus chargé demanderait une
 * seconde géométrie en portrait sous `md`.
 */
export function LoopFigure({ style, bare = false }: { style?: CSSProperties; bare?: boolean }) {
  // `bare` : la plaque seule, sans légende — la vignette de la page d'accueil
  // du journal. Les identifiants du titre SVG changent pour ne jamais doubler
  // ceux de la figure de l'article.
  const ids = bare ? 'fig1b' : 'fig1';
  return (
    <figure
      className="flex flex-col gap-3"
      style={{ maxWidth: 'var(--editorial-measure)', ...style }}
    >
      <div style={{ backgroundColor: 'var(--color-bg-elev)', padding: '8px 4px' }}>
        <svg
          viewBox="0 0 680 410"
          role="img"
          aria-labelledby={`${ids}-title ${ids}-desc`}
          className="block w-full h-auto text-[var(--color-fg)]"
          fontFamily="inherit"
        >
          <title id={`${ids}-title`}>La boucle corps-cerveau et le décalage qu&apos;elle prédit</title>
          <desc id={`${ids}-desc`}>
            En haut, le cerveau traite et envoie vers le corps, le corps garde et
            renvoie vers le cerveau. En bas, deux courbes d&apos;activation après un
            soulagement : la tête redescend d&apos;abord, le ventre ensuite ; l&apos;écart
            entre les deux est le décalage mesurable.
          </desc>
          <defs>
            <marker id={`${ids}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
            </marker>
          </defs>

          {/* — La boucle — */}
          <text x="40" y="122" fontSize="30" fontWeight="700" fill="currentColor">CERVEAU</text>
          <text x="640" y="122" fontSize="30" fontWeight="700" fill="currentColor" textAnchor="end">CORPS</text>

          <path d="M205 92 C285 28 395 28 475 92" fill="none" stroke="currentColor" strokeWidth="2" markerEnd={`url(#${ids}-arrow)`} />
          <path d="M475 134 C395 198 285 198 205 134" fill="none" stroke="currentColor" strokeWidth="2" markerEnd={`url(#${ids}-arrow)`} />
          <text x="340" y="30" fontSize="15" textAnchor="middle" fill="var(--color-fg-muted)">traite et envoie</text>
          <text x="340" y="206" fontSize="15" textAnchor="middle" fill="var(--color-fg-muted)">garde et renvoie</text>

          {/* — Le décalage — */}
          <line x1="40" y1="232" x2="640" y2="232" stroke="var(--color-line)" strokeWidth="1" />

          <line x1="262" y1="250" x2="262" y2="352" stroke="var(--color-fg-muted)" strokeWidth="1" strokeDasharray="3 4" />
          <line x1="452" y1="250" x2="452" y2="352" stroke="var(--color-fg-muted)" strokeWidth="1" strokeDasharray="3 4" />
          <text x="262" y="246" fontSize="13" textAnchor="middle" fill="var(--color-fg-muted)">soulagement</text>

          <path d="M40 276 H240 C268 276 270 336 300 336 H640" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M40 300 H430 C458 300 460 340 490 340 H640" fill="none" stroke="currentColor" strokeWidth="4" />
          <text x="40" y="268" fontSize="13" fontWeight="700" fill="currentColor">TÊTE</text>
          <text x="40" y="292" fontSize="13" fontWeight="700" fill="currentColor">VENTRE</text>

          <path d="M262 370 V378 H452 V370" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <text x="357" y="400" fontSize="15" textAnchor="middle" fill="currentColor">décalage mesurable</text>
          <text x="640" y="400" fontSize="13" textAnchor="end" fill="var(--color-fg-muted)">temps →</text>
        </svg>
      </div>
      {!bare && (
      <figcaption className="flex flex-col gap-1">
        <span className={MICRO_LABEL}>Fig. 1</span>
        <span className={cn(EDITORIAL_SIDENOTE)}>
          La boucle, et ce qu&apos;elle prédit : après un vrai soulagement, la tête
          lâche d&apos;abord, le ventre ensuite. Schéma d&apos;après le texte, pas une mesure.
        </span>
      </figcaption>
      )}
    </figure>
  );
}
