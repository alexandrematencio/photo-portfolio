import type { CSSProperties } from 'react';
import { DICT, type Lang } from '@/lib/journal/i18n';
import { ArrowMarker, FigureFrame, svgProps } from './FigureFrame';

/**
 * La boucle corps-cerveau et le décalage qu'elle prédit, dessinés d'après le
 * texte (« Ce que j'ai compris seul… », et « Ni maître ni esclave », section
 * « Le corps n'est pas un simple capteur »).
 */
export function LoopFigure({ number, lang, style }: { number: number; lang: Lang; style?: CSSProperties }) {
  const t = DICT[lang].figures.loop;
  const id = `fig${number}`;
  return (
    <FigureFrame number={number} label={DICT[lang].figureLabel(number)} legend={t.legend} style={style}>
      <svg {...svgProps(id, '0 0 680 410')}>
        <title id={`${id}-title`}>{t.title}</title>
        <desc id={`${id}-desc`}>{t.desc}</desc>
        <defs>
          <ArrowMarker id={`${id}-arrow`} />
        </defs>

        {/* — La boucle — */}
        <text x="40" y="122" fontSize="30" fontWeight="700" fill="currentColor">{t.brain}</text>
        <text x="640" y="122" fontSize="30" fontWeight="700" fill="currentColor" textAnchor="end">{t.body}</text>

        <path d="M205 92 C285 28 395 28 475 92" fill="none" stroke="currentColor" strokeWidth="2" markerEnd={`url(#${id}-arrow)`} />
        <path d="M475 134 C395 198 285 198 205 134" fill="none" stroke="currentColor" strokeWidth="2" markerEnd={`url(#${id}-arrow)`} />
        <text x="340" y="30" fontSize="15" textAnchor="middle" fill="var(--color-fg-muted)">{t.sends}</text>
        <text x="340" y="206" fontSize="15" textAnchor="middle" fill="var(--color-fg-muted)">{t.returns}</text>

        {/* — Le décalage — */}
        <line x1="40" y1="232" x2="640" y2="232" stroke="var(--color-line)" strokeWidth="1" />

        <line x1="262" y1="250" x2="262" y2="352" stroke="var(--color-fg-muted)" strokeWidth="1" strokeDasharray="3 4" />
        <line x1="452" y1="250" x2="452" y2="352" stroke="var(--color-fg-muted)" strokeWidth="1" strokeDasharray="3 4" />
        <text x="262" y="246" fontSize="13" textAnchor="middle" fill="var(--color-fg-muted)">{t.relief}</text>

        <path d="M40 276 H240 C268 276 270 336 300 336 H640" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M40 300 H430 C458 300 460 340 490 340 H640" fill="none" stroke="currentColor" strokeWidth="4" />
        <text x="40" y="268" fontSize="13" fontWeight="700" fill="currentColor">{t.head}</text>
        <text x="40" y="292" fontSize="13" fontWeight="700" fill="currentColor">{t.gut}</text>

        <path d="M262 370 V378 H452 V370" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="357" y="400" fontSize="15" textAnchor="middle" fill="currentColor">{t.lag}</text>
        <text x="640" y="400" fontSize="13" textAnchor="end" fill="var(--color-fg-muted)">{t.time}</text>
      </svg>
    </FigureFrame>
  );
}
