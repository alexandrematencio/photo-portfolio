import type { CSSProperties, ReactNode } from 'react';
import type { Lang } from '@/lib/journal/i18n';
import type { FigureName } from '@/lib/journal/types';
import { LoopFigure } from './LoopFigure';
import { CascadeFigure } from './CascadeFigure';
import { BridgeFigure } from './BridgeFigure';
import { BubbleFigure } from './BubbleFigure';
import { DriftFigure } from './DriftFigure';
import { ExposureFigure } from './ExposureFigure';
import { GenerationsFigure } from './GenerationsFigure';
import { LayersFigure, ShockFigure } from './LayersFigure';

type FigureProps = { number: number; lang: Lang; style?: CSSProperties };

const FIGURES: Record<FigureName, (props: FigureProps) => ReactNode> = {
  loop: LoopFigure,
  cascade: CascadeFigure,
  bridge: BridgeFigure,
  bubble: BubbleFigure,
  drift: DriftFigure,
  exposure: ExposureFigure,
  generations: GenerationsFigure,
  layers: LayersFigure,
  shock: ShockFigure,
};

/** La figure choisie dans le Studio (`journalFigure.figure`), numérotée dans l'ordre de l'article. */
export function JournalFigure({ name, ...props }: { name: FigureName } & FigureProps) {
  const Figure = FIGURES[name];
  return <Figure {...props} />;
}
