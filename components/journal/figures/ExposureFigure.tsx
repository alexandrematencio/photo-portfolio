import type { CSSProperties } from 'react';
import { DICT, type Lang } from '@/lib/journal/i18n';
import { FigureFrame, svgProps } from './FigureFrame';

/**
 * Protégés contre exposés, en une génération (« Protéger tout le monde »,
 * section « Le corps l'a déjà montré »). Les deux seules mesures de l'article,
 * en barres sur une même échelle : à l'encre les enfants protégés, en gris les
 * exposés. Chiffres de l'article, vérifiés contre les sources citées :
 * Du Toit et al. 2015 (LEAP, 13,7 % contre 1,9 %), Stein et al. 2016
 * (asthme, 21,3 % chez les Huttérites, 5,2 % chez les Amish).
 */

const X0 = 40;
/** 25 % = 500 unités : la plus longue barre (21,3 %) laisse la place de sa valeur. */
const SCALE = 500 / 25;
const BAR_H = 18;

export function ExposureFigure({ number, lang, style }: { number: number; lang: Lang; style?: CSSProperties }) {
  const t = DICT[lang].figures.exposure;
  const id = `fig${number}`;
  const muted = 'var(--color-fg-muted)';
  const pct = new Intl.NumberFormat(DICT[lang].dateLocale, { style: 'percent', minimumFractionDigits: 1 });

  const row = (y: number, label: string, value: number, ink: string) => (
    <g key={label}>
      <text x={X0} y={y} fontSize="13" fill={ink}>{label}</text>
      <rect x={X0} y={y + 8} width={value * SCALE} height={BAR_H} fill={ink} />
      <text x={X0 + value * SCALE + 8} y={y + 22} fontSize="13" fontWeight="700" fill={ink}>{pct.format(value / 100)}</text>
    </g>
  );

  return (
    <FigureFrame number={number} label={DICT[lang].figureLabel(number)} legend={t.legend} style={style}>
      <svg {...svgProps(id, '0 0 680 276')}>
        <title id={`${id}-title`}>{t.title}</title>
        <desc id={`${id}-desc`}>{t.desc}</desc>

        <text x={X0} y="26" fontSize="13" fontWeight="700" fill="currentColor">{t.peanut}</text>
        {row(54, t.avoided, 13.7, 'currentColor')}
        {row(102, t.eaten, 1.9, muted)}

        <line x1={X0} y1="140" x2="640" y2="140" stroke="var(--color-line)" strokeWidth="1" />

        <text x={X0} y="170" fontSize="13" fontWeight="700" fill="currentColor">{t.asthma}</text>
        {row(198, t.hutterites, 21.3, 'currentColor')}
        {row(246, t.amish, 5.2, muted)}
      </svg>
    </FigureFrame>
  );
}
