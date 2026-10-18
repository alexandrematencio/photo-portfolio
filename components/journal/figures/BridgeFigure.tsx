import type { CSSProperties, ReactNode } from 'react';
import { DICT, type Lang } from '@/lib/journal/i18n';
import { ArrowMarker, FigureFrame, svgProps } from './FigureFrame';

/**
 * Maître, esclave ou pont (« Ni maître ni esclave », section « Alors, à quoi
 * sert la conscience ? »). Trois vignettes de même grammaire — un anneau, la
 * conscience ; trois ondes, les mécanismes inconscients — qui ne diffèrent
 * que par le sens des flèches. Les deux places écartées sont en gris, celle
 * que l'article retient à l'encre : la hiérarchie se lit sans couleur.
 */

const PANEL = 680 / 3;
const RING_Y = 104;
const RING_R = 28;
const WAVES = [214, 232, 250];

/** Une onde de 160 unités centrée sur `cx`. */
const wave = (cx: number, y: number) => `M${cx - 80} ${y} q20 -8 40 0 t40 0 t40 0 t40 0`;

export function BridgeFigure({ number, lang, style }: { number: number; lang: Lang; style?: CSSProperties }) {
  const t = DICT[lang].figures.bridge;
  const id = `fig${number}`;
  const muted = 'var(--color-fg-muted)';

  const panel = (i: number, title: string, caption: string, ink: string, arrows: ReactNode) => {
    const cx = PANEL * i + PANEL / 2;
    return (
      <g key={i}>
        <text x={cx} y="30" fontSize="15" fontWeight="700" textAnchor="middle" fill={ink}>{title}</text>
        <text x={cx} y="64" fontSize="13" textAnchor="middle" fill={muted}>{t.consciousness}</text>
        <circle cx={cx} cy={RING_Y} r={RING_R} fill="none" stroke={ink} strokeWidth="2" />
        {WAVES.map((y) => (
          <path key={y} d={wave(cx, y)} fill="none" stroke={muted} strokeWidth="1.5" />
        ))}
        <text x={cx} y="276" fontSize="13" textAnchor="middle" fill={muted}>{t.mechanisms}</text>
        <text x={cx} y="312" fontSize="15" textAnchor="middle" fill={ink}>{caption}</text>
        {arrows}
      </g>
    );
  };

  const c = (i: number) => PANEL * i + PANEL / 2;
  const mutedArrow = `url(#${id}-arrow-muted)`;
  const inkArrow = `url(#${id}-arrow)`;

  return (
    <FigureFrame number={number} label={DICT[lang].figureLabel(number)} legend={t.legend} style={style}>
      <svg {...svgProps(id, '0 0 680 330')}>
        <title id={`${id}-title`}>{t.title}</title>
        <desc id={`${id}-desc`}>{t.desc}</desc>
        <defs>
          <ArrowMarker id={`${id}-arrow`} />
          <ArrowMarker id={`${id}-arrow-muted`} color={muted} />
        </defs>

        {/* Séparateurs entre vignettes */}
        <line x1={PANEL} y1="14" x2={PANEL} y2="318" stroke="var(--color-line)" strokeWidth="1" />
        <line x1={PANEL * 2} y1="14" x2={PANEL * 2} y2="318" stroke="var(--color-line)" strokeWidth="1" />

        {/* MAÎTRE : des ordres descendent de l'anneau */}
        {panel(
          0,
          t.master,
          t.commands,
          muted,
          [-44, 0, 44].map((dx) => (
            <path
              key={dx}
              d={`M${c(0) + dx * 0.35} ${RING_Y + RING_R + 4} L${c(0) + dx} 200`}
              stroke={muted}
              strokeWidth="1.5"
              markerEnd={mutedArrow}
            />
          )),
        )}

        {/* ESCLAVE : tout monte vers l'anneau, rien ne redescend */}
        {panel(
          1,
          t.slave,
          t.watches,
          muted,
          [-44, 0, 44].map((dx) => (
            <path
              key={dx}
              d={`M${c(1) + dx} 200 L${c(1) + dx * 0.35} ${RING_Y + RING_R + 6}`}
              stroke={muted}
              strokeWidth="1.5"
              markerEnd={mutedArrow}
            />
          )),
        )}

        {/* PONT : le flux entre, est relié, et repart vers les mécanismes */}
        {panel(
          2,
          t.bridge,
          t.links,
          'currentColor',
          <>
            <path
              d={`M${c(2) - 92} 204 C${c(2) - 70} 150 ${c(2) - 58} ${RING_Y} ${c(2) - RING_R - 6} ${RING_Y}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              markerEnd={inkArrow}
            />
            {/* Le passage : le flux traverse l'anneau, et s'y relie (le point). */}
            <line x1={c(2) - RING_R + 8} y1={RING_Y} x2={c(2) + RING_R - 8} y2={RING_Y} stroke="currentColor" strokeWidth="2" />
            <circle cx={c(2)} cy={RING_Y} r="4" fill="currentColor" />
            <path
              d={`M${c(2) + RING_R + 2} ${RING_Y} C${c(2) + 58} ${RING_Y} ${c(2) + 70} 150 ${c(2) + 88} 200`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              markerEnd={inkArrow}
            />
          </>,
        )}
      </svg>
    </FigureFrame>
  );
}
