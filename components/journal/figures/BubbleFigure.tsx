import type { CSSProperties } from 'react';
import { DICT, type Lang } from '@/lib/journal/i18n';
import { ArrowMarker, FigureFrame, svgProps } from './FigureFrame';

/**
 * La bulle et le retour du réel (« Protéger tout le monde », section « La
 * réalité : ce qui nous tient droits »). Deux vignettes de même grammaire :
 * une personne, le sol du réel, un geste qui descend, une sanction qui
 * remonte. Sans bulle, la sanction arrive à l'encre jusqu'à la personne. Avec
 * bulle, elle s'écrase sur la paroi (le trait d'arrêt) et ne continue qu'en
 * pointillés pâles : elle n'atteint plus personne.
 */
export function BubbleFigure({ number, lang, style }: { number: number; lang: Lang; style?: CSSProperties }) {
  const t = DICT[lang].figures.bubble;
  const id = `fig${number}`;
  const muted = 'var(--color-fg-muted)';
  return (
    <FigureFrame number={number} label={DICT[lang].figureLabel(number)} legend={t.legend} style={style}>
      <svg {...svgProps(id, '0 0 680 300')}>
        <title id={`${id}-title`}>{t.title}</title>
        <desc id={`${id}-desc`}>{t.desc}</desc>
        <defs>
          <ArrowMarker id={`${id}-arrow`} />
          <ArrowMarker id={`${id}-arrow-muted`} color={muted} />
        </defs>

        <line x1="340" y1="14" x2="340" y2="288" stroke="var(--color-line)" strokeWidth="1" />

        {/* — SANS BULLE : la boucle se ferme — */}
        <text x="170" y="30" fontSize="15" fontWeight="700" textAnchor="middle" fill="currentColor">{t.without}</text>
        <circle cx="170" cy="112" r="9" fill="currentColor" />
        <path d="M160 126 C144 160 136 190 134 216" fill="none" stroke={muted} strokeWidth="1.5" markerEnd={`url(#${id}-arrow-muted)`} />
        <text x="126" y="176" fontSize="13" textAnchor="end" fill={muted}>{t.act}</text>
        <path d="M206 218 C204 190 196 160 182 130" fill="none" stroke="currentColor" strokeWidth="2.5" markerEnd={`url(#${id}-arrow)`} />
        <text x="214" y="176" fontSize="13" fill="currentColor">{t.sanction}</text>
        <line x1="40" y1="226" x2="300" y2="226" stroke="currentColor" strokeWidth="2" />
        <text x="40" y="248" fontSize="13" fill={muted}>{t.reality}</text>
        <text x="170" y="284" fontSize="15" textAnchor="middle" fill="currentColor">{t.learns}</text>

        {/* — AVEC BULLE : la sanction s'arrête sur la paroi — */}
        <text x="510" y="30" fontSize="15" fontWeight="700" textAnchor="middle" fill="currentColor">{t.with}</text>
        <circle cx="510" cy="112" r="58" fill="none" stroke={muted} strokeWidth="1.5" />
        <text x="562" y="62" fontSize="13" fill={muted}>{t.bubble}</text>
        <circle cx="510" cy="112" r="9" fill="currentColor" />
        <path d="M500 126 C484 160 476 190 474 216" fill="none" stroke={muted} strokeWidth="1.5" markerEnd={`url(#${id}-arrow-muted)`} />
        <text x="466" y="176" fontSize="13" textAnchor="end" fill={muted}>{t.act}</text>
        <path d="M552 218 C551 198 547 182 542 168" fill="none" stroke="currentColor" strokeWidth="2.5" />
        {/* Le trait d'arrêt, tangent à la paroi, puis ce qui en passe encore. */}
        <line x1="532" y1="170" x2="550" y2="160" stroke="currentColor" strokeWidth="2.5" />
        <path d="M536 156 C531 146 526 137 520 127" fill="none" stroke={muted} strokeWidth="1" strokeDasharray="2 4" />
        <text x="560" y="200" fontSize="13" fill={muted}>{t.damped}</text>
        <line x1="380" y1="226" x2="640" y2="226" stroke="currentColor" strokeWidth="2" />
        <text x="380" y="248" fontSize="13" fill={muted}>{t.reality}</text>
        <text x="510" y="284" fontSize="15" textAnchor="middle" fill="currentColor">{t.noLearning}</text>
      </svg>
    </FigureFrame>
  );
}
