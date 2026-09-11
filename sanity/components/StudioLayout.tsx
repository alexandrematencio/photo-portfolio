import { useEffect } from 'react';
import type { LayoutProps } from 'sanity';

/**
 * Habillage des en-têtes de colonnes de Structure (skill sanity-studio §11.22).
 *
 * Sanity rend chaque colonne (« Contenu », « Photos », une liste, un panneau
 * composant, un document replié) avec le même `PaneHeader` : le titre est un
 * `Card` focalisable dont le clic REPLIE la colonne, et l'en-tête entier,
 * une fois replié, la DÉPLOIE au clic. Rien ne le montre : ni curseur, ni
 * icône, ni survol — et les listes n'ont même pas de filet sous l'en-tête
 * (`border` n'est passé qu'aux documents repliés).
 *
 * Ce composant ne remplace rien : il pose une feuille de style sur les crochets
 * stables du DOM natif (`data-pane-index`, `data-testid="pane-header"`,
 * `data-collapsed`, la position du titre dans la rangée) et rend l'affordance
 * visible — le tout constaté sur le DOM réel via `/studio-probe` (§11.23) :
 *
 * - l'en-tête est une bande teintée (`--card-muted-bg-color`) fermée par un
 *   filet — la séparation avec le contenu, sans un pixel de plus ;
 * - le titre porte un chevron à droite, qui pointe là où le bord de la colonne
 *   va aller : vers la gauche quand elle est ouverte (elle se replie vers la
 *   gauche), vers la droite quand elle est repliée (elle se rouvre vers la
 *   droite — l'en-tête replié est tourné de 90°, d'où la rotation locale) ;
 * - curseur `pointer`, survol et focus visibles ; Entrée / Espace sur le titre
 *   font ce que fait le clic (le `Card` natif n'a pas de gestionnaire clavier) ;
 * - RIEN sur la dernière colonne (celle de droite, un document ouvert le plus
 *   souvent) : Sanity ne la replie jamais, et signale ce cas par
 *   `tabindex="-1"` sur son titre. Un chevron y mentirait.
 *
 * Aucun état ici : tout est lu sur les attributs que Sanity pose déjà, si bien
 * qu'un repli venu d'ailleurs (`PhotoGridPane` replie les panneaux de gauche
 * à l'ouverture d'une photo) est représenté sans rien à synchroniser.
 */

/**
 * ⚠️ Pas `[data-ui="Pane"]` : au rendu, `data-ui` nomme le GENRE de panneau
 * (`ListPane`, `DocumentListPane`, `Pane` pour les composants et les documents),
 * si bien que ce sélecteur ignore toutes les listes (vérifié sur le DOM réel
 * via `/studio-probe`). `data-pane-index` est ce que tous portent.
 */
const HEADER = '[data-pane-index] [data-testid="pane-header"]';
/**
 * Le titre : le `Card` de la rangée de l'en-tête (en-tête > Card > Flex colonne
 * > Flex rangée > [bouton retour] Card-titre [actions]). Pas `[tabindex]` : les
 * panneaux composants (`PhotoGridPane`) n'en passent pas à leur en-tête.
 */
const TITLE_CARD = '> [data-ui="Card"] > [data-ui="Flex"] > [data-ui="Flex"] > [data-ui="Card"]';
const TITLE = `${HEADER} ${TITLE_CARD}`;
const COLLAPSED_TITLE = `${HEADER}[data-collapsed] ${TITLE_CARD}`;
/**
 * Le titre du DERNIER panneau, que Sanity ne replie jamais. Deux signatures,
 * mesurées sur le DOM réel : les listes et les documents posent `tabindex="-1"`
 * sur leur titre exactement dans ce cas ; les panneaux composants ne posent pas
 * de `tabindex` du tout, et on se rabat sur leur position (les panneaux d'une
 * même famille sont frères, un document ouvert vit dans son propre groupe).
 */
const LAST_TITLES = [
  `${TITLE}[tabindex="-1"]`,
  `[data-pane-index]:last-child [data-testid="pane-header"] ${TITLE_CARD}:not([tabindex])`,
];
/** Les deux signatures, chacune avec le même suffixe (un `:hover` ne se distribue pas sur une liste). */
const last = (suffix: string) => LAST_TITLES.map((s) => s + suffix).join(',\n');

/** Chevron-gauche de `@sanity/icons`, en masque (la couleur vient de `background-color`). */
const CHEVRON = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 25 25' fill='none'><path d='M15 17L10.5 12.5L15 8' stroke='#000' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/></svg>`
)}")`;

/**
 * La barre de recherche native d'une liste de documents (« Search list ») : un
 * `Box paddingX={3} paddingBottom={3}` posé directement sous l'en-tête, avec un
 * `TextInput border={false}`. Sans marge haute ni bordure, le champ colle au
 * filet de la bande. Elle prend ici la géométrie de la barre de filtre de la
 * planche-contact (`PhotoGridPane`) : 8 px tout autour, bordure 1 px, rayon 3 px.
 * Le sélecteur ne vise que la rangée de recherche (un `Box` enfant direct de la
 * colonne du panneau qui contient un `TextInput`), pas la liste.
 */
const SEARCH_BOX = '[data-pane-index] > [data-ui="Flex"] > [data-ui="Box"]:has(> [data-ui="TextInput"])';

const ICON = 17;
const HOVER_TINT = 'color-mix(in srgb, var(--card-fg-color) 7%, transparent)';

export const STUDIO_CSS = `
/* — En-tête de colonne : bande teintée fermée par un filet — */
${HEADER} > [data-ui="Card"] {
  background-color: var(--card-muted-bg-color);
  transition: background-color 120ms;
}
${HEADER}:not([data-collapsed])::after {
  border-bottom-color: var(--card-border-color);
}

/* — Le titre est l'interrupteur : pointeur, survol, chevron — */
${TITLE} {
  display: flex;
  align-items: center;
  background-color: transparent;
  border-radius: 3px;
  cursor: pointer;
  transition: background-color 120ms;
}
${TITLE} > * {
  flex: 1 1 auto;
  min-width: 0;
}
${TITLE} [data-ui="Text"] {
  cursor: inherit;
}
${TITLE}::after {
  content: '';
  flex: 0 0 auto;
  width: ${ICON}px;
  height: ${ICON}px;
  margin-left: 8px;
  background-color: var(--card-muted-fg-color);
  -webkit-mask: ${CHEVRON} center / ${ICON}px ${ICON}px no-repeat;
  mask: ${CHEVRON} center / ${ICON}px ${ICON}px no-repeat;
  opacity: 0.6;
  transition: opacity 120ms, transform 200ms;
}
${TITLE}:hover,
${TITLE}:focus-visible {
  background-color: ${HOVER_TINT};
}
${TITLE}:hover::after,
${TITLE}:focus-visible::after {
  opacity: 1;
}

/* — Dernière colonne : elle ne se replie JAMAIS (Sanity force collapsed = false sur
   la dernière). Donc ni chevron, ni pointeur, ni survol : pas d'affordance pour un
   geste impossible. — */
${last('')} {
  cursor: default;
}
${last(':hover')} {
  background-color: transparent;
}
${last('::after')} {
  display: none;
}

/* — Colonne repliée : tout l'en-tête est la cible, le chevron pointe vers la droite — */
/* À 51 px de large, une bande d'en-tête sur un corps vide n'a plus de sens : c'est toute
   la barre qui prend la couleur de la bande (le contenu du panneau est masqué par Sanity,
   seule la racine peint encore le fond). */
[data-pane-index][data-pane-collapsed] {
  background-color: var(--card-muted-bg-color);
}
${HEADER}[data-collapsed] {
  cursor: pointer;
}
${HEADER}[data-collapsed]:hover > [data-ui="Card"] {
  background-color: color-mix(in srgb, var(--card-fg-color) 7%, var(--card-muted-bg-color));
}
${COLLAPSED_TITLE} {
  /* Le titre ne s'étire plus sur toute la hauteur de la barre : le chevron reste collé au mot. */
  flex: 0 1 auto;
}
${COLLAPSED_TITLE}:hover {
  background-color: transparent;
}
${COLLAPSED_TITLE}::after {
  transform: rotate(90deg);
}
${HEADER}[data-collapsed]:hover ${TITLE_CARD}::after {
  opacity: 1;
}

/* — Barre de recherche native des listes : même géométrie que le filtre de la
   planche-contact (8 px d'air sous la bande, champ bordé) — */
${SEARCH_BOX} {
  padding: 8px;
}
${SEARCH_BOX} > [data-ui="TextInput"] {
  /* La bordure d'un TextInput de Sanity UI vient du thème (input.default.enabled.border),
     pas d'une variable : valeurs relevées sur le filtre de la planche-contact, clair puis sombre. */
  box-shadow: inset 0 0 0 1px #e3e4e8;
  border-radius: 3px;
}
[data-scheme="dark"] ${SEARCH_BOX} > [data-ui="TextInput"],
[data-scheme="dark"]${SEARCH_BOX} > [data-ui="TextInput"] {
  box-shadow: inset 0 0 0 1px #3d4258;
}

@media (prefers-reduced-motion: reduce) {
  ${HEADER} > [data-ui="Card"],
  ${TITLE},
  ${TITLE}::after {
    transition: none;
  }
}
`;

/** Entrée / Espace sur le titre focalisé = le clic (repli, ou déploiement si replié). */
function useTitleKeyboard() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(TITLE)) return;
      event.preventDefault();
      target.click();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}

export function StudioLayout(props: LayoutProps) {
  useTitleKeyboard();
  return (
    <>
      <style>{STUDIO_CSS}</style>
      {props.renderDefault(props)}
    </>
  );
}
