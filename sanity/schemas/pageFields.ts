import { defineArrayMember, defineField } from 'sanity';
import {
  NormalBlock,
  AnnexBlock,
  H2Block,
  H3Block,
  H4Block,
} from '../components/EditorBlocks';
import { assetWithinCap } from '../validation/assetWithinCap';

// ─── Budget poids des images du hero ────────────────────────────────────────
// Cible : ≤ 300 Ko par image pour un chargement rapide sur une connexion
// moyenne en Europe / Ouest. Le site recompresse de toute façon chaque image
// (Sanity CDN → WebP/AVIF, ~768 px), donc le poids livré au visiteur est bien
// plus petit ; ce plafond protège surtout contre des originaux énormes et garde
// l'upload + le store Sanity légers. Appliqué en AVERTISSEMENT (non bloquant).
const MAX_HERO_IMAGE_BYTES = 300 * 1024; // 300 Ko

/**
 * Champ image du hero (image par défaut OU image au survol).
 *
 * - `alt` : texte alternatif. Requis sur l'image par défaut (portrait visible,
 *   compte pour l'accessibilité + le SEO), optionnel sur l'image au survol
 *   (purement décorative, rendue `aria-hidden` côté site).
 * - Validation poids : lit la taille réelle de l'asset uploadé et affiche un
 *   AVERTISSEMENT jaune (non bloquant) si > 300 Ko, avec le poids constaté.
 */
export function heroImageField(
  name: string,
  title: string,
  description: string,
  opts: { altRequired: boolean }
) {
  return defineField({
    name,
    title,
    type: 'image',
    description,
    options: { hotspot: true },
    fields: [
      defineField({
        name: 'alt',
        title: 'Texte alternatif',
        type: 'string',
        description:
          'Décrit l’image (accessibilité + SEO). Affiché au public si l’image ne charge pas.',
        validation: (Rule) => {
          const base = Rule.min(3).max(120);
          return opts.altRequired ? base.required() : base;
        },
      }),
    ],
    validation: (Rule) => [
      Rule.required().error('Cette image est obligatoire.'),
      Rule.custom(async (value, context) => {
        const ref = (value as { asset?: { _ref?: string } } | undefined)?.asset
          ?._ref;
        if (!ref) return true; // l'absence est gérée par Rule.required() ci-dessus
        const client = context.getClient({ apiVersion: '2026-01-01' });
        const size = await client.fetch<number | null>(
          '*[_id == $id][0].size',
          { id: ref }
        );
        if (typeof size === 'number' && size > MAX_HERO_IMAGE_BYTES) {
          const ko = Math.round(size / 1024);
          return `Image lourde : ${ko} Ko. Vise ≤ 300 Ko pour un chargement rapide sur une connexion moyenne en Europe/Ouest. Le site la recompresse automatiquement (WebP/AVIF), mais un original léger reste préférable.`;
        }
        return true;
      }).warning(),
      // AVERTISSEMENT (pas erreur) : le hero est un portrait de l'auteur, pas
      // une œuvre à protéger — un upload surdimensionné avertit au lieu de
      // bloquer. Cf. sanity/validation/assetWithinCap.ts.
      Rule.custom(assetWithinCap).warning(),
    ],
  });
}

/**
 * Shared block-type for editorial PT bodies (about, contact, digital-agency).
 * Custom `styles` use the EditorBlocks components so the Studio preview
 * matches the proportional typography rendered by `PortableBody` (editorial
 * variant). Default Sanity sizing made h2/h3/h4 look identical or absurdly
 * large relative to body — editors couldn't tell what the site would do.
 */
export const editorialBlockType = defineArrayMember({
  type: 'block',
  styles: [
    { title: 'Normal', value: 'normal', component: NormalBlock },
    // « Annexe » — ajouté le 2026-08-24 avec la refonte de l'échelle
    // éditoriale. C'est le seul des trois registres de corps que l'éditeur
    // choisit : le chapô est POSITIONNEL (1er paragraphe de la page, promu par
    // le site sans qu'aucun style existe pour lui), le courant est le défaut.
    // ⚠️ Valeur `annex` : elle doit rester alignée avec la clé du renderer
    // `block.annex` de `components/site/PortableBody.tsx`. Un style dont le
    // site ignore la valeur retombe en paragraphe courant SANS le moindre
    // avertissement — l'éditeur croirait avoir marqué son texte.
    { title: 'Annexe', value: 'annex', component: AnnexBlock },
    { title: 'Heading 2', value: 'h2', component: H2Block },
    { title: 'Heading 3', value: 'h3', component: H3Block },
    { title: 'Heading 4', value: 'h4', component: H4Block },
  ],
  // Lists kept as default (bullet + numbered). Le site les rend depuis le
  // 2026-08-23 (`makeListComponents` dans PortableBody.tsx) : les boutons du
  // Studio ne mènent donc plus à une liste sans puce ni retrait à l'écran.
});

/**
 * Aide affichée sous chaque champ de page éditoriale.
 *
 * Ces champs SONT les pages : le site n'a aucun texte en dur à leur
 * place (CLAUDE.md §8.5, le repli du code ne sert que si le champ est vide).
 * L'éditeur doit donc savoir, sans lire le code, ce que le Studio sait faire
 * et ce que le site en fera — d'où les jetons et le rappel de publication.
 */
export const editorialBodyDescription = (intro: string) =>
  `${intro} Mise en forme : « Normal » pour le corps, « Annexe » pour le pratique (délai de réponse, listes de matériel, mentions — plus petit, registre secondaire), « Heading 2/3/4 » pour les titres (l’aperçu du Studio est à l’échelle du site), listes à puces et numérotées. Entrée = nouveau paragraphe (grand écart) ; Maj+Entrée = simple retour à la ligne. ` +
  `ℹ️ Le PREMIER paragraphe de la page s’affiche automatiquement en chapô — plus gros, plus gras, sur toute la largeur. Rien à choisir, et l’éditeur ci-dessous ne le montre pas : il apparaît tel quel sur le site. Pour ouvrir sur autre chose, commence par un titre. ` +
  `Email : sélectionne quelques mots (« write to me ») et pose un lien « mailto:… » — l’adresse n’apparaît ni à l’écran ni dans le code de la page. (Le raccourci « @EMAIL » existe encore mais AFFICHE l’adresse en entier : à éviter.) Taper « AAXLO » (1ʳᵉ fois seulement) insère le logo AAXLO cliquable. Un lien dont l’URL est « @pseudo » pointe vers Telegram. ` +
  `ℹ️ Après « Publish », le site en ligne se met à jour tout seul en 3 à 4 minutes.`;
