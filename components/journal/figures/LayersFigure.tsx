import type { CSSProperties } from 'react';
import { DICT, type Lang } from '@/lib/journal/i18n';
import { ArrowMarker, FigureFrame, svgProps } from './FigureFrame';

/**
 * Les couches de groupes, du soi au vote (« Protéger tout le monde », sections
 * « Les couches » et « L'épreuve »). Deux figures sur la MÊME pile, pour que la
 * seconde se lise comme la suite de la première :
 *
 * - `LayersFigure` : la demande de protection passe d'une couche à celle du
 *   dessus, par le flanc droit, d'un trait qui s'épaissit, jusqu'au vote ;
 * - `ShockFigure` : l'épreuve, elle, ne prend pas l'escalier — une seule
 *   flèche traverse toute la pile par la gauche, jusqu'à l'individu.
 *
 * Les libellés sont calés à DROITE de leur couche : la flèche de l'épreuve
 * passe à `SHOCK_X`, à gauche de tous, y compris du plus long (« quartier,
 * potes, école, travail »).
 */

const X0 = 40;
const BAND_H = 40;
const STEP = 52;
/** Largeurs du haut (le vote) vers le bas (l'individu). */
const WIDTHS = [470, 410, 350, 290, 230, 170];
/** L'abscisse de la flèche de l'épreuve, dans toutes les couches. */
const SHOCK_X = X0 + 22;

function Bands({ labels, top, muted }: { labels: string[]; top: number; muted: string }) {
  return (
    <>
      {WIDTHS.map((w, i) => {
        const y = top + i * STEP;
        const ink = i === 0 ? 'currentColor' : muted;
        return (
          <g key={i}>
            <rect x={X0} y={y} width={w} height={BAND_H} rx="2" fill="none" stroke={ink} strokeWidth={i === 0 ? 2 : 1} />
            <text
              x={X0 + w - 14}
              y={y + 25}
              fontSize="13"
              fontWeight={i === 0 ? 700 : 400}
              textAnchor="end"
              fill="currentColor"
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
    </>
  );
}

export function LayersFigure({ number, lang, style }: { number: number; lang: Lang; style?: CSSProperties }) {
  const t = DICT[lang].figures.layers;
  const id = `fig${number}`;
  const muted = 'var(--color-fg-muted)';
  const top = 24;
  return (
    <FigureFrame number={number} label={DICT[lang].figureLabel(number)} legend={t.legend} style={style}>
      <svg {...svgProps(id, '0 0 680 364')}>
        <title id={`${id}-title`}>{t.title}</title>
        <desc id={`${id}-desc`}>{t.desc}</desc>
        <defs>
          <ArrowMarker id={`${id}-arrow`} size={12} />
        </defs>

        <Bands labels={t.bands} top={top} muted={muted} />

        {/* La demande monte d'une couche à l'autre, par le flanc droit. */}
        {WIDTHS.slice(1).map((w, k) => {
          const i = k + 1;
          const sx = X0 + w + 6;
          const sy = top + i * STEP + BAND_H / 2;
          const ey = top + (i - 1) * STEP + BAND_H + 4;
          return (
            <path
              key={i}
              d={`M${sx} ${sy} H${sx + 26} Q${sx + 34} ${sy} ${sx + 34} ${sy - 8} V${ey}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.25 + (WIDTHS.length - 1 - i) * 0.25}
              markerEnd={`url(#${id}-arrow)`}
            />
          );
        })}
        <path
          d={`M${X0 + WIDTHS[0] + 6} ${top + BAND_H / 2} H${X0 + WIDTHS[0] + 40}`}
          stroke="currentColor"
          strokeWidth="2.5"
          markerEnd={`url(#${id}-arrow)`}
        />
        <text x={X0 + WIDTHS[0] + 52} y={top + 25} fontSize="13" fontWeight="700" fill="currentColor">{t.more}</text>

        <text x="640" y="356" fontSize="13" textAnchor="end" fill={muted}>{t.demand}</text>
      </svg>
    </FigureFrame>
  );
}

export function ShockFigure({ number, lang, style }: { number: number; lang: Lang; style?: CSSProperties }) {
  const t = DICT[lang].figures.shock;
  const bands = DICT[lang].figures.layers.bands;
  const id = `fig${number}`;
  const muted = 'var(--color-fg-muted)';
  const top = 64;
  const selfY = top + (WIDTHS.length - 1) * STEP;
  return (
    <FigureFrame number={number} label={DICT[lang].figureLabel(number)} legend={t.legend} style={style}>
      <svg {...svgProps(id, '0 0 680 384')}>
        <title id={`${id}-title`}>{t.title}</title>
        <desc id={`${id}-desc`}>{t.desc}</desc>
        <defs>
          <ArrowMarker id={`${id}-arrow`} size={12} />
        </defs>

        <Bands labels={bands} top={top} muted={muted} />

        <text x={SHOCK_X + 14} y="30" fontSize="13" fontWeight="700" fill="currentColor">{t.events}</text>
        <line x1={SHOCK_X} y1="12" x2={SHOCK_X} y2={selfY + BAND_H - 8} stroke="currentColor" strokeWidth="2.5" markerEnd={`url(#${id}-arrow)`} />
        <text x={X0 + WIDTHS[5] + 14} y={selfY + 25} fontSize="13" fontWeight="700" fill="currentColor">{t.question}</text>
      </svg>
    </FigureFrame>
  );
}
