'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Fragment, forwardRef } from 'react';
import { urlFor } from '@/lib/sanity/image';
import type { Photo } from '@/lib/sanity/queries';
import { Placeholder } from './Placeholder';

type Props = {
  photo: Photo | null;
  index: number;
  /** Called when the user clicks the photo to open the lightbox carousel.
      The parent owns the carousel state (see PhotoLightbox's contract). */
  onOpen?: (index: number) => void;
};

/**
 * Le titre des objectifs est saisi en Sanity avec la marque entre crochets
 * (« [Olympus] Mr. Zuiko AF 45mm f1.8 »). Alexandre veut la marque AFFICHÉE
 * (2026-08-22) : on ne retire donc que les crochets, jamais le mot.
 */
function lensLabel(title: string): string {
  return title.replace(/^\s*\[([^\]]*)\]\s*/, '$1 ').trim();
}

/**
 * Ligne d'origine : « année, PAYS » — le pays seul, pas la ville (demande
 * Alexandre, 2026-08-22). `location` est saisi « Ville, Pays » en Sanity ;
 * le pays est donc ce qui suit la dernière virgule. Sans virgule, on garde
 * la chaîne telle quelle plutôt que de deviner.
 */
function country(location: string): string {
  const parts = location.split(',');
  return parts[parts.length - 1].trim();
}

/**
 * Flèche bas-gauche → haut-droit, en SUFFIXE du nom de série, dimensionnée
 * en `em` : elle suit le corps du libellé quoi qu'il arrive. Mêmes tracé et
 * conventions que la flèche « Open ↗ » de `/series` (FolderStack) — en CSS
 * et pas en attribut SVG, un `width="0.55em"` d'attribut n'étant pas fiable.
 */
function ArrowUpRight() {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      style={{
        width: '0.55em',
        height: '0.55em',
        display: 'inline-block',
        verticalAlign: 'baseline',
        marginLeft: '0.22em',
      }}
    >
      <path
        d="M1.6 8.4 8.4 1.6M3.4 1.6h5v5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Bloc de la curation home : photo à gauche, texte à droite, d'après le
 * mockup `resources/homepage-image-component.pen` (frame `xhHMr`).
 *
 * La colonne de texte est TENDUE à la hauteur de la photo et ses deux
 * moitiés sont poussées aux extrémités : numéro + titre + lien de série en
 * haut, fiche technique en BAS, alignée sur le bas de l'image. C'est la
 * nouveauté du mockup — et la raison pour laquelle `.photo-figure` porte un
 * `align-self: flex-start` explicite : sans lui, l'étirement de la rangée
 * lui imposerait une hauteur et écraserait son ratio.
 *
 * Deux familles dans le même bloc, comme au mockup : Helvetica pour le
 * numéro, le titre et la série ; Inter (`font-sans`) pour la fiche
 * technique, qui est du corps de texte.
 */
export const PhotoBlock = forwardRef<HTMLDivElement, Props>(
  function PhotoBlock({ photo, index, onOpen }, ref) {
    const builder = photo?.image ? urlFor(photo.image) : null;
    const src = builder?.width(1600).quality(80).auto('format').url() ?? null;
    const alt = photo?.image?.alt ?? photo?.title ?? 'Photographie A. Matencio';
    const ratio = photo?.image?.dimensions?.aspectRatio ?? 4 / 5;
    const clickable = Boolean(photo && src);
    const number = String(index + 1).padStart(2, '0');

    const series = (photo?.seriesLinks ?? []).filter((s) => s?.slug);
    const origin = [photo?.year, photo?.location ? country(photo.location) : null]
      .filter(Boolean)
      .join(', ');

    return (
      <figure
        ref={ref}
        className="photo-item"
        style={{ ['--ratio' as string]: ratio }}
        /* Pas d'aria-label quand la photo existe : il masquerait le
           <figcaption>, qui porte déjà le titre et les métadonnées. */
        aria-label={photo ? undefined : `Photo placeholder ${index + 1}`}
      >
        {clickable ? (
          <button
            type="button"
            onClick={() => onOpen?.(index)}
            className="photo-figure cursor-pointer border-0 bg-transparent"
            aria-label={`Open “${photo?.title}” fullscreen`}
          >
            {src && (
              <Image
                src={src}
                alt={alt}
                fill
                sizes="(max-width: 1023px) 92vw, 62vw"
                priority={index < 2}
                className="object-cover"
              />
            )}
          </button>
        ) : (
          <div className="photo-figure">
            <Placeholder title={photo?.title} />
          </div>
        )}

        {photo && (
          <figcaption className="photo-meta">
            <div className="photo-meta-head">
              <div className="photo-meta-title">
                {/* 16 px : le mockup pose le numéro à 24 pour un corps de
                    texte à 32 ; le corps étant redescendu à 20, le label
                    suit la même proportion — sinon il passerait devant lui. */}
                <span className="text-[16px] font-normal tracking-[0.15em] leading-none text-[var(--color-fg)]">
                  {number}
                </span>
                <h3 className="text-[30px] md:text-[48px] 2xl:text-[64px] font-bold tracking-[-0.02em] 2xl:tracking-[-0.04em] leading-none text-[var(--color-fg)]">
                  {photo.title}
                </h3>
              </div>

              {series.length > 0 && (
                /* « Series » en gris, sans deux-points, puis le nom en noir
                   (demande Alexandre, 2026-08-22). L'espace insécable vit
                   DANS le libellé, et non entre les deux <span> : sous `md`
                   les noms passent en colonne (un par ligne) et le libellé
                   devient une colonne à part entière — son retrait vaut donc
                   exactement « Series » + son espace, ce qui aligne les noms
                   au pixel sur le premier, sans retrait à deviner. Insécable
                   dans les deux cas : le mot et le nom qu'il introduit ne
                   doivent jamais se retrouver sur deux lignes. */
                <p className="photo-meta-series text-[20px] leading-[1.5] font-normal text-[var(--color-fg)]">
                  <span className="text-[var(--color-fg-muted)]">
                    Series{'\u00A0'}
                  </span>
                  <span className="photo-meta-series-names">
                    {series.map((s, i) => (
                      <Fragment key={s.slug}>
                        {i > 0 && (
                          /* Séparateur du seul rendu en ligne (≥ md) —
                             masqué en colonne, où le retour à la ligne fait
                             le travail. */
                          <span className="photo-meta-series-sep">, </span>
                        )}
                        <Link
                          href={`/series#${s.slug}`}
                          className="no-underline hover:opacity-60 transition-opacity motion-reduce:transition-none"
                        >
                          {s.title}
                          <ArrowUpRight />
                        </Link>
                      </Fragment>
                    ))}
                  </span>
                </p>
              )}
            </div>

            {/* Fiche technique — en Inter, calée sur le BAS de la photo.
                L'origine en gris, le matériel en noir ; l'objectif porte le
                « + » du mockup, qui le rattache au boîtier de la ligne
                au-dessus. */}
            <ul className="photo-meta-facts font-sans text-[20px] leading-[1.5] font-normal">
              {origin && (
                <li className="text-[var(--color-fg-muted)]">{origin}</li>
              )}
              {photo.camera?.title && <li>{photo.camera.title}</li>}
              {photo.lens?.title && <li>+ {lensLabel(photo.lens.title)}</li>}
              {photo.caption && <li>{photo.caption}</li>}
            </ul>
          </figcaption>
        )}
      </figure>
    );
  }
);
