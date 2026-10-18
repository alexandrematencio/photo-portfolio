import type { CSSProperties } from 'react';
import { DICT, type Lang } from '@/lib/journal/i18n';
import { ArrowMarker, FigureFrame, svgProps } from './FigureFrame';

/**
 * La cascade intérieure du samedi matin (« Ni maître ni esclave », section
 * « Un cerveau fait de biais en cascade »). Le seuil de la conscience coupe
 * la plaque en deux : sous lui, les étapes en gris, nourries par deux
 * influences latérales en pointillés (« un souvenir ? », « un état du
 * corps ? » — des hypothèses, d'où le point d'interrogation) ; au-dessus, la
 * seule chose éprouvée, la décision, à l'encre.
 *
 * Le dernier segment du trajet passe du gris à l'encre un peu SOUS le seuil :
 * c'est « l'impression d'avoir aperçu quelque chose de son déclenchement ».
 * Les deux moitiés sont la même courbe de Bézier coupée en t = 0,5 (de
 * Casteljau), pour que la jonction ne casse pas.
 */
export function CascadeFigure({ number, lang, style }: { number: number; lang: Lang; style?: CSSProperties }) {
  const t = DICT[lang].figures.cascade;
  const id = `fig${number}`;
  const muted = 'var(--color-fg-muted)';
  return (
    <FigureFrame number={number} label={DICT[lang].figureLabel(number)} legend={t.legend} style={style}>
      <svg {...svgProps(id, '0 0 680 380')}>
        <title id={`${id}-title`}>{t.title}</title>
        <desc id={`${id}-desc`}>{t.desc}</desc>
        <defs>
          <ArrowMarker id={`${id}-arrow`} />
          <ArrowMarker id={`${id}-arrow-muted`} color={muted} />
        </defs>

        {/* — Le seuil — */}
        <line x1="40" y1="150" x2="640" y2="150" stroke={muted} strokeWidth="1" strokeDasharray="6 5" />
        <text x="40" y="138" fontSize="13" fontWeight="700" fill="currentColor">{t.conscious}</text>
        <text x="40" y="174" fontSize="13" fontWeight="700" fill={muted}>{t.unconscious}</text>

        {/* — Ce qui est éprouvé — */}
        <text x="640" y="40" fontSize="13" fontWeight="700" textAnchor="end" fill={muted}>{t.lived}</text>
        <text x="640" y="66" fontSize="17" fontWeight="700" textAnchor="end" fill="currentColor">{t.decision}</text>

        {/* — Influences latérales, supposées — */}
        <path d="M150 214 C190 222 220 250 244 274" fill="none" stroke={muted} strokeWidth="1" strokeDasharray="3 4" markerEnd={`url(#${id}-arrow-muted)`} />
        <text x="150" y="206" fontSize="13" textAnchor="middle" fill={muted}>{t.memory}</text>
        <path d="M360 330 C380 300 400 260 414 234" fill="none" stroke={muted} strokeWidth="1" strokeDasharray="3 4" markerEnd={`url(#${id}-arrow-muted)`} />
        <text x="360" y="350" fontSize="13" textAnchor="middle" fill={muted}>{t.bodyState}</text>

        {/* — La cascade — */}
        <path
          d="M80 320 C160 300 190 290 250 280 C320 268 360 250 420 225 C450 212.5 475 191.25 497.5 167.1"
          fill="none"
          stroke={muted}
          strokeWidth="2"
        />
        <path d="M497.5 167.1 C520 143 540 116 560 84" fill="none" stroke="currentColor" strokeWidth="2.5" markerEnd={`url(#${id}-arrow)`} />
        <circle cx="80" cy="320" r="5" fill={muted} />
        <circle cx="250" cy="280" r="5" fill={muted} />
        <circle cx="420" cy="225" r="5" fill={muted} />
        <text x="70" y="346" fontSize="15" fill={muted}>{t.light}</text>
        <text x="250" y="306" fontSize="15" textAnchor="middle" fill={muted}>{t.mood}</text>
        <text x="440" y="252" fontSize="15" fill={muted}>{t.urge}</text>

        <text x="640" y="370" fontSize="13" textAnchor="end" fill={muted}>{t.unseen}</text>
      </svg>
    </FigureFrame>
  );
}
