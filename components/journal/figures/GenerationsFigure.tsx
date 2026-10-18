import type { CSSProperties } from 'react';
import { DICT, type Lang } from '@/lib/journal/i18n';
import { FigureFrame, svgProps } from './FigureFrame';

/**
 * Les quatre générations d'Ibn Khaldoun (« Protéger tout le monde », section
 * « La transmission »). Quatre colonnes, deux rangées lues à l'horizontale :
 * la bulle, un anneau de plus à chaque génération (le premier construit, il
 * n'en a pas) ; et la cohésion, l''asabiyya, qui descend. Une pente dessinée
 * d'après le texte, pas une courbe mesurée — d'où l'absence d'axe chiffré.
 */

const COL = 680 / 4;
const cx = (i: number) => COL * i + COL / 2;
const BUBBLE_Y = 150;
const RINGS = [16, 26, 36];
const COHESION = [218, 234, 258, 288];

export function GenerationsFigure({ number, lang, style }: { number: number; lang: Lang; style?: CSSProperties }) {
  const t = DICT[lang].figures.generations;
  const id = `fig${number}`;
  const muted = 'var(--color-fg-muted)';
  return (
    <FigureFrame number={number} label={DICT[lang].figureLabel(number)} legend={t.legend} style={style}>
      <svg {...svgProps(id, '0 0 680 324')}>
        <title id={`${id}-title`}>{t.title}</title>
        <desc id={`${id}-desc`}>{t.desc}</desc>

        {t.steps.map((lines, i) => (
          <g key={i}>
            <text x={cx(i)} y="28" fontSize="13" fontWeight="700" textAnchor="middle" fill="currentColor">{t.generation(i + 1)}</text>
            {lines.map((line, j) => (
              <text key={j} x={cx(i)} y={54 + j * 17} fontSize="13" textAnchor="middle" fill={muted}>{line}</text>
            ))}
            <circle cx={cx(i)} cy={BUBBLE_Y} r="5" fill="currentColor" />
            {RINGS.slice(0, i).map((r) => (
              <circle key={r} cx={cx(i)} cy={BUBBLE_Y} r={r} fill="none" stroke={muted} strokeWidth="1.5" />
            ))}
          </g>
        ))}

        <text x="40" y="118" fontSize="13" fill={muted}>{t.bubble}</text>

        <text x="40" y="204" fontSize="13" fill="currentColor">{t.cohesion}</text>
        <polyline
          points={COHESION.map((y, i) => `${cx(i)},${y}`).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        {COHESION.map((y, i) => (
          <circle key={i} cx={cx(i)} cy={y} r="4" fill="currentColor" />
        ))}
        <text x={cx(3)} y="314" fontSize="13" fontWeight="700" textAnchor="middle" fill="currentColor">{t.lost}</text>
      </svg>
    </FigureFrame>
  );
}
