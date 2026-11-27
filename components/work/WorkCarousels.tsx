'use client';

import { useLayoutEffect, useRef } from 'react';
import type { PreparedSeries } from '@/lib/site/series';
import { CarouselScene } from './CarouselScene';
import { bindWorkCarousels } from './carousel-motion';

export function WorkCarousels({ collections }: { collections: PreparedSeries[] }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const motion = bindWorkCarousels(root);
    return () => motion?.destroy();
  }, []);

  return (
    <div ref={rootRef} data-work-root>
      <div data-scenes>
        {collections.map((c, i) => (
          <CarouselScene key={c._id} collection={c} index={i} />
        ))}
      </div>
    </div>
  );
}
