import type { CSSProperties } from 'react';
import { DICT, type Lang } from '@/lib/journal/i18n';
import { ArrowMarker, FigureFrame, svgProps } from './FigureFrame';

/**
 * Deux façons de se perdre (« Protéger tout le monde », même section). À
 * gauche, S'ASSEOIR : la personne suit le monde un moment, puis sa ligne
 * s'aplatit ; le monde continue de monter, et l'écart se creuse sans que rien
 * ne le signale. À droite, FLOTTER : un piquet planté dans le réel, une attache
 * rompue, et des idées qui montent en grossissant, sans plus jamais toucher le
 * sol.
 */

/** La ligne du monde : de (50, 236) à (300, 70). */
const worldY = (x: number) => 236 - ((x - 50) * 166) / 250;
const SEAT_X = 100;
const SEAT_Y = worldY(SEAT_X);
const GAP_X = 240;

/** Les idées qui montent, de plus en plus grosses. */
const IDEAS: [number, number, number][] = [
  [424, 214, 6],
  [450, 188, 10],
  [488, 152, 15],
  [544, 100, 24],
];

export function DriftFigure({ number, lang, style }: { number: number; lang: Lang; style?: CSSProperties }) {
  const t = DICT[lang].figures.drift;
  const id = `fig${number}`;
  const muted = 'var(--color-fg-muted)';
  return (
    <FigureFrame number={number} label={DICT[lang].figureLabel(number)} legend={t.legend} style={style}>
      <svg {...svgProps(id, '0 0 680 310')}>
        <title id={`${id}-title`}>{t.title}</title>
        <desc id={`${id}-desc`}>{t.desc}</desc>
        <defs>
          <ArrowMarker id={`${id}-arrow-muted`} color={muted} />
        </defs>

        <line x1="340" y1="14" x2="340" y2="298" stroke="var(--color-line)" strokeWidth="1" />

        {/* — S'ASSEOIR — */}
        <text x="170" y="30" fontSize="15" fontWeight="700" textAnchor="middle" fill="currentColor">{t.sit}</text>
        <line x1="40" y1="250" x2="300" y2="250" stroke={muted} strokeWidth="1" markerEnd={`url(#${id}-arrow-muted)`} />
        <text x="300" y="270" fontSize="13" textAnchor="end" fill={muted}>{t.time}</text>
        <line x1="50" y1="236" x2="296" y2={worldY(296)} stroke={muted} strokeWidth="2" markerEnd={`url(#${id}-arrow-muted)`} />
        <text x="236" y="60" fontSize="13" textAnchor="end" fill={muted}>{t.world}</text>
        <path d={`M50 236 L${SEAT_X} ${SEAT_Y} H290`} fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="290" cy={SEAT_Y} r="5" fill="currentColor" />
        <text x="290" y={SEAT_Y + 24} fontSize="13" textAnchor="end" fill="currentColor">{t.person}</text>
        <line x1={GAP_X} y1={worldY(GAP_X) + 6} x2={GAP_X} y2={SEAT_Y - 6} stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
        <text x={GAP_X + 10} y="158" fontSize="13" fill="currentColor">{t.gap}</text>
        <text x={GAP_X + 10} y="176" fontSize="13" fill={muted}>{t.unnoticed}</text>
        <text x="170" y="298" fontSize="15" textAnchor="middle" fill="currentColor">{t.sitLine}</text>

        {/* — FLOTTER — */}
        <text x="510" y="30" fontSize="15" fontWeight="700" textAnchor="middle" fill="currentColor">{t.float}</text>
        <line x1="380" y1="250" x2="640" y2="250" stroke="currentColor" strokeWidth="2" />
        <text x="380" y="270" fontSize="13" fill={muted}>{t.reality}</text>
        <line x1="412" y1="250" x2="412" y2="236" stroke="currentColor" strokeWidth="2" />
        <path d="M412 236 L419 224" stroke={muted} strokeWidth="1" strokeDasharray="2 3" />
        {IDEAS.map(([cx, cy, r]) => (
          <circle key={cx} cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
        ))}
        <text x="440" y="230" fontSize="13" fill={muted}>{t.idea}</text>
        <text x="576" y="105" fontSize="13" fill={muted}>{t.grows}</text>
        <text x="510" y="298" fontSize="15" textAnchor="middle" fill="currentColor">{t.floatLine}</text>
      </svg>
    </FigureFrame>
  );
}
