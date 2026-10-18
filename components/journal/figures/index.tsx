import type { CSSProperties } from 'react';
import type { Lang } from '@/lib/journal/i18n';
import type { FigureName } from '@/lib/journal/types';
import { LoopFigure } from './LoopFigure';
import { CascadeFigure } from './CascadeFigure';
import { BridgeFigure } from './BridgeFigure';

/** La figure choisie dans le Studio (`journalFigure.figure`), numérotée dans l'ordre de l'article. */
export function JournalFigure({ name, ...props }: { name: FigureName; number: number; lang: Lang; style?: CSSProperties }) {
  if (name === 'cascade') return <CascadeFigure {...props} />;
  if (name === 'bridge') return <BridgeFigure {...props} />;
  return <LoopFigure {...props} />;
}
