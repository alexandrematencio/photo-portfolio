import { urlFor } from '@/lib/sanity/image';
import type { Photo } from '@/lib/sanity/queries';
import type { PreparedSeries } from '@/lib/site/series';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cellTransform, FIRST_SCENE_SERVED_HEIGHT, RING_PERSPECTIVE, ringLayout } from './carousel-geometry';

/**
 * 2× la taille de la carte, ratio intact : on ne fixe QUE la largeur. `urlFor` pose déjà `w=2048` ;
 * y ajouter une hauteur fait calculer à la librairie un `rect=` qui découpe une bande (ex. 3:1) au
 * centre de la photo, que la carte étire ensuite à son ratio réel (même avec `fit('max')`).
 * Seul `asset` est passé, pour ignorer un éventuel `crop` / `hotspot` du Studio : la carte a le ratio
 * des dimensions de l'asset (`aspectOf`), l'image doit donc être l'asset entier.
 */
function ringImageUrl(photo: Photo, width: number): string | undefined {
  if (!photo.image) return undefined;
  return urlFor({ _type: 'image', asset: photo.image.asset })?.width(width * 2).quality(70).auto('format').url();
}

/**
 * Une scène de /work : un titre et un anneau de photos en 3D. Composant SANS EFFET :
 * les transforms de départ (scène centrée) sont écrits en style inline, pour que le HTML
 * servi soit déjà juste avant l'hydratation (CLAUDE.md §3.7 inv. 18). Tout ce qui bouge
 * se pose ensuite dans `carousel-motion.ts`, par refs et attributs `data-*`.
 *
 * Trois boîtes imbriquées : `data-ring` (défilement, inclinaison) ⊃ `data-fit` (taille selon
 * l'écran, `scale: var(--ring-fit)`, jamais touchée par GSAP) ⊃ `data-flight` (ouverture,
 * fermeture). Aucune timeline n'anime deux de ces boîtes.
 */
export function CarouselScene({ collection: c, index }: { collection: PreparedSeries; index: number }) {
  const layout = ringLayout(c.photos);
  return (
    <section
      id={`work-${c.slug}`}
      data-scene={index}
      // Première scène : l'anneau attend, hors champ, la fin de la transition de page, puis monte du
      // bas (`carousel-motion.ts`, « entrée »). L'état de départ est dans le HTML pour qu'il n'y ait
      // pas d'image où l'anneau se montre à sa place avant de partir.
      data-enter={index === 0 ? 'pending' : undefined}
      aria-labelledby={`work-title-${c.slug}`}
      className="relative flex items-center justify-center overflow-clip"
      style={{
        height: index === 0 ? FIRST_SCENE_SERVED_HEIGHT : '100svh',
        perspective: `${RING_PERSPECTIVE}px`,
        contentVisibility: 'auto',
        containIntrinsicSize: index === 0 ? undefined : 'auto 100svh',
        cursor: 'grab',
      }}
    >
      {index === 0 && (
        <noscript>
          <style>{`[data-enter] [data-ring]{translate:none!important}[data-enter] [data-scene-title]{opacity:1!important}`}</style>
        </noscript>
      )}
      <h2
        id={`work-title-${c.slug}`}
        data-scene-title
        className={`${MICRO_LABEL} relative z-10 text-center text-white mix-blend-difference`}
      >
        <a href={`/series/${c.slug}/`} data-open={index}>
          <span data-split>{c.title}</span>
          <span className="sr-only">, {c.photos.length} photos</span>
        </a>
      </h2>
      <div
        data-ring
        aria-hidden
        className="absolute left-1/2 top-1/2"
        style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
      >
        <div data-fit style={{ transformStyle: 'preserve-3d', scale: 'var(--ring-fit)' }}>
          <div
            data-flight
            style={{ transformStyle: 'preserve-3d', transform: `translateZ(${layout.z}px)` }}
          >
            {layout.cards.map((k) => (
              <div
                key={k.photo._id}
                data-cell
                style={{
                  position: 'absolute',
                  width: k.width,
                  height: k.height,
                  left: -k.width / 2,
                  top: -k.height / 2,
                  transformStyle: 'preserve-3d',
                  transform: cellTransform(k.angle, layout.radius),
                }}
              >
                <div
                  data-card
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    transformStyle: 'preserve-3d',
                    rotate: 'y calc(var(--lean, 0deg) + var(--spin-lean, 0deg))',
                  }}
                >
                  <img
                    src={ringImageUrl(k.photo, k.width)}
                    alt=""
                    width={k.width}
                    height={k.height}
                    draggable={false}
                    loading={index < 2 ? 'eager' : 'lazy'}
                    decoding="async"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      // Jamais d'étirement : la carte a le ratio de l'image ; sans dimensions Sanity
                      // (repli), l'image est recadrée plutôt qu'écrasée.
                      objectFit: 'cover',
                      // Pas de `backfaceVisibility: hidden` : vue de derrière, la même photo se lit en
                      // miroir, comme le dos du ruban de la démo Codrops.
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
