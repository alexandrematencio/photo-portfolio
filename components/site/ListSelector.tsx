'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { CONTROL_RADIUS } from '@/lib/site/controls';
import { MICRO_LABEL_XS } from '@/lib/site/typography';
import { StateDot, STATE_DOT_SIZE } from './StateDot';

/**
 * SÉLECTEUR EN LISTE — un module de console pleine largeur qui ouvre son
 * tiroir d'options. Mobile uniquement (ses deux consommateurs le masquent
 * au-dessus de `md`).
 *
 * **Le problème qu'il règle** (demande Alexandre, 2026-08-23). Les deux rangées
 * de la console d'`/archives` sont des rangées de BOUTONS : cinq onglets
 * d'axe, puis une pastille par valeur — jusqu'à une vingtaine en mode
 * Location. Sur un écran de téléphone, les cinq onglets passent à deux lignes
 * et les pastilles à quatre ou cinq : la console mangeait 240 px avant la
 * première photo (mesuré à 390 px de large, mode Location), et la rangée de
 * pastilles, qui est `sticky`, emportait tout ça avec elle au défilement.
 * Sous `md`, chaque rangée devient donc UN module d'une seule ligne — même
 * contenu, même grammaire d'état, 96 px pour les deux.
 *
 * **Anatomie du module** (revue avec Alexandre le 2026-08-23 — « toute la
 * hauteur, pas de gap entre les cells », puis cadré sur la gouttière de la
 * page) :
 *
 *   ┌──────────────┬───────────────────────────┬──────┐
 *   │  GROUP BY    │  YEAR                     │  ⌄   │  ← 48 px, fond perdu
 *   ├──────────────┼───────────────────────────┼──────┤
 *   │  SHOW      ● │  2026 (84)                │  ⌄   │  ← 48 px, fond perdu
 *   └──────────────┴───────────────────────────┴──────┘
 *
 * - **La cellule-étiquette** (`CAP_WIDTH`) est un aplat SOMBRE
 *   (`--color-bg-plate-dark`) : le module encastré de la console desktop
 *   (boutons de densité) qui revient en mobile — la signature Teenage
 *   Engineering, plusieurs gris voisins et UN seul creux profond. Les deux
 *   rangées étant empilées SANS gap, les deux étiquettes forment une colonne
 *   sombre continue ; la largeur est COMMUNE aux deux instances, un pixel
 *   d'écart briserait la colonne.
 * - **La cellule-valeur** prend le plan de sa rangée (plaque / pont bas) et
 *   toute la place restante.
 * - **La cellule-chevron** est un carré de la hauteur de la rangée, orange en
 *   PERMANENCE — la touche du boîtier. Voir ci-dessous.
 * - **Le module est CADRÉ sur la gouttière de 32 px de la page** (demande
 *   Alexandre, 2026-08-23), comme le titre et la grille au-dessus et en
 *   dessous — plus à fond perdu. Ses quatre coins existent donc à l'écran :
 *   il prend `CONTROL_RADIUS`, le rayon des commandes POSÉES sur une surface,
 *   et un `overflow: hidden` pour que les cellules internes s'y rognent.
 *
 *   ⚠️ Le rayon est découpé par BLOC, pas par module (`corners`) : les deux
 *   rangées sont collées, arrondir les quatre coins de chacune creuse une
 *   encoche de 1 px à la jonction — et cette encoche tombe pile sur la
 *   colonne sombre, qui doit être continue (vu au zoom ×4). Le module du haut
 *   n'arrondit donc que le haut, celui du bas que le bas, et le bas s'efface
 *   tant que le tiroir est ouvert — le tiroir prend le relais et porte les
 *   coins bas du bloc. `flush` annule tout : un module qui court d'un bord à
 *   l'autre n'a plus de coins (cf. l'état collé). La bascule du rayon n'est
 *   pas animée — 1 px, personne ne la voit ; c'est la GOUTTIÈRE, portée par
 *   le parent, qui porte la transition.
 * - **La géométrie est calibrée pour la largeur CADRÉE**, pas pour le
 *   viewport : 326 px sur un écran de 390. `CAP_WIDTH` tient « GROUP BY »
 *   (54 px mesurés) plus ses deux gouttières, et pas un pixel de plus — le
 *   reste va à l'afficheur, qui dispose de 174 px. Élargir l'étiquette ou la
 *   cellule-chevron, c'est le prendre là.
 *
 *   Sur les 12 lieux d'aujourd'hui, un seul dépasse : « MESHCHERSKY PARK,
 *   RUSSIA (1) » demande 199 px et se coupe à l'ellipse dans le CHAMP.
 *   Assumé, et pas rattrapable sans casser la grille (récupérer 25 px
 *   voudrait dire rogner l'étiquette sous son plancher ou réduire la cellule
 *   du chevron sous le carré). Le nom complet reste lisible à deux endroits :
 *   dans le TIROIR, où l'afficheur a 222 px, et sur le titre du groupe juste
 *   sous le module.
 *
 * **Pourquoi le chevron est TOUJOURS orange** (arbitrage du 2026-08-23). Le
 * module au repos ne montrait que trois gris et un voyant éteint. La demande
 * — avoir de la couleur dès l'arrivée sur la page — avait d'abord pris la
 * forme d'un défaut de filtre calé sur le plus gros groupe, pour que le
 * voyant soit allumé en permanence. Écarté, et pour trois raisons qui ne se
 * rattrapent pas : `/archives` s'ouvrirait sur une fraction du catalogue
 * alors que montrer TOUT est sa seule raison d'être face à `/` et `/series` ;
 * le deep-link `#photo-<slug>` du pane de preview du Studio se fait au
 * montage sur `getElementById`, donc toute photo hors du groupe par défaut
 * atterrirait en haut de page sans un mot ; et le desktop, lui, resterait sur
 * « All » — même page, deux contenus selon la largeur d'écran, périmètre du
 * carousel compris. Allumer le voyant sans condition ne valait pas mieux : il
 * bascule sur l'opacité, allumé en permanence il ne dit plus rien.
 *
 * La couleur est donc allée dans le CHÂSSIS, pas dans la LED. Sur un boîtier
 * Teenage Engineering, l'orange est moulé dans une touche ; les diodes, elles,
 * restent honnêtes — c'est ce qui les rend crédibles. La cellule-chevron est
 * cette touche : un aplat plein de 48×48 présent au repos sur les deux
 * rangées, et le voyant garde son unique métier, « la grille est filtrée ».
 *
 * Conséquences à ne pas défaire :
 * - **L'état ouvert est porté par la seule ROTATION du chevron.** Il l'était
 *   déjà (le fond ne faisait qu'accompagner) ; il l'est maintenant tout seul.
 *   C'est un changement de FORME et pas de couleur, donc lisible sans
 *   distinguer l'orange — WCAG 2.2 §1.4.1. Ne pas y substituer un second
 *   changement de fond : il n'y a plus de gris disponible sous cette cellule.
 * - **La transition est `transition-[rotate]`, PAS `transition-transform`.**
 *   En Tailwind v4, `rotate-180` écrit la propriété CSS `rotate`, pas
 *   `transform` — mesuré : `rotate: 180deg` / `transform: none`. Une
 *   transition posée sur `transform` n'a donc rien à animer et le chevron
 *   bascule d'un coup. Ça passait tant que le fond portait l'état ; depuis
 *   qu'il ne le porte plus, ce quart de tour EST le signal, et un signal qui
 *   claque se lit comme un raté d'affichage.
 * - **Le filet de séparation a sauté.** Entre un gris et un aplat orange, une
 *   hairline ne sépare plus rien — elle traîne. C'est la couleur qui coupe.
 * - **Chevron à 2,5 d'épaisseur** (contre 2) : posé sur un aplat saturé et
 *   plus seulement sur du gris, il lui faut du corps pour tenir. Rapport
 *   trait/taille 0,156 — le plus épais du site, et c'est voulu : c'est le seul
 *   pictogramme qui vive sur de la couleur pleine.
 *
 * **Le tiroir** : cellules de 48 px pleine largeur, SANS gap, séparées par un
 * filet-couture (`--color-line`). L'option courante prend `--color-active-bg`
 * sur TOUTE sa cellule (demande Alexandre — la version précédente ne
 * surlignait que le libellé). Le texte des options est ALIGNÉ sur la
 * colonne-valeur du champ (`CAP_WIDTH + INSET`) : la grille du module
 * continue dans le tiroir, et c'est elle qui l'empêche de se lire comme un
 * menu système.
 *
 * **Pourquoi pas un `<select>` natif.** Sur mobile il ouvre la roue du système
 * (iOS) ou la liste de l'OS (Android) : une surface qui n'appartient pas au
 * site, qu'aucun token ne touche, et qui affiche le libellé brut sans compteur
 * ni voyant. Le champ est donc recodé de bout en bout — au prix du clavier et
 * des rôles ARIA, faits à la main ci-dessous.
 *
 * **Où il se pose dans l'échelle de valeurs.** Le champ prend le plan de sa
 * rangée ; le TIROIR prend `--color-bg-raised` — le barreau 1, celui qui veut
 * dire « calque posé sur le papier », déjà porté par le tiroir du menu mobile
 * et par le fond de la lightbox desktop. Aucune surface inventée.
 *
 * **La marque d'état** (`mark`) : dans le TIROIR, les deux variantes prennent
 * la cellule orange — le rôle y est le même, l'option courante d'une liste.
 * La rangée de valeurs garde en plus SON voyant : dans le champ fermé (`lit`,
 * allumé quand un filtre est engagé, éteint sur « All » — le module dit d'un
 * coup d'œil si la grille est filtrée) et dans ses options. Sur la cellule
 * orange, l'encre du voyant suit celle du libellé — l'orange sur l'orange
 * (~1,5:1) serait invisible ; c'est un remap LOCAL du token `--color-link`,
 * jamais un hex (CLAUDE.md §7.7).
 *
 * ⚠️ **Le voyant vit dans SA colonne, jamais dans le flux du libellé**
 * (`DOT_X`, corrigé sur capture d'Alexandre du 2026-08-23). Posé en tête de
 * la cellule-valeur, il poussait « All (202) » 15 px à droite de « YEAR » —
 * les 7 px du point plus les 8 px de son écart — alors qu'il est INVISIBLE
 * tant qu'aucun filtre n'est engagé : l'œil ne voyait que deux libellés
 * désalignés, sans la cause (exactement le défaut du §7.7, ici en version
 * verticale). Il est donc ancré à droite de la cellule-étiquette, et les
 * voyants des options tombent au MÊME `left` : une colonne de LED continue du
 * champ jusqu'au bas du tiroir, et les libellés tous à `CAP_WIDTH + INSET`.
 * Bénéfice de contraste au passage — sur la plaque sombre l'orange tient
 * 4,70:1 là où il tombait à 2,49:1 sur le pont bas, sous le seuil graphique
 * de WCAG 2.2 §1.4.11 (compromis assumé dans `globals.css`, ici plus à faire).
 *
 * ⚠️ **Une seule voix typographique pour les deux cellules-valeurs** : 12 px
 * bold CAPITALES, sans interlettrage négatif, `tabular-nums`. Le libellé de
 * filtre était en casse mixte resserrée (la voix des pastilles desktop, où
 * c'est juste) : à corps égal, les capitales de « YEAR » lisaient plus grand
 * que « All (202) », et les deux rangées empilées n'avaient pas la même
 * échelle. Un module de console a UN afficheur, pas deux.
 *
 * ⚠️ Paddings en style INLINE : le reset `* { padding: 0 }` de `globals.css`
 * vit hors `@layer` et avale les utilities Tailwind de padding (CLAUDE.md
 * §7.6). Hauteurs et largeurs voyagent dans les mêmes objets de style pour
 * que la géométrie se lise d'un bloc.
 */

export type ListSelectorItem = {
  key: string;
  label: string;
  /** Compteur affiché en `(N)` — même rendu que sur les pastilles desktop. */
  count?: number;
};

type Tone = 'plate' | 'plate-low';

/** Plan de la rangée — le champ EST la surface, à fond perdu. */
const SURFACE: Record<Tone, string> = {
  plate: 'var(--color-bg-plate)',
  'plate-low': 'var(--color-bg-plate-low)',
};

/** Largeur de la cellule-étiquette. COMMUNE aux deux instances : empilées
    sans gap, leurs aplats sombres forment une colonne continue — un pixel
    d'écart la briserait.

    80 = « GROUP BY » (54 px mesurés en 10 px bold) + les deux gouttières.
    C'est un PLANCHER, pas un choix esthétique : chaque pixel pris ici est
    pris à l'afficheur, qui doit loger jusqu'à « MESHCHERSKY PARK, RUSSIA (1) »
    (199 px). Ajouter un libellé d'étiquette plus long = remesurer les deux. */
const CAP_WIDTH = 80;

/** Hauteur d'une rangée ET d'une cellule d'option — 48 px, au-dessus du
    minimum tactile (44 px), et le nombre qui donne ses proportions au
    module. */
const ROW_H = 48;

/** Gouttière interne des cellules. 12 et non 32 : la gouttière de 32 px du
    site est celle de la PAGE, elle est déjà posée autour du module (cf.
    FlatGallery) ; la redoubler à l'intérieur d'un bloc de 326 px l'étoufferait.
    12 est le retrait interne d'un boîtier, pas une marge de page. */
const INSET = 12;

/** Abscisse du voyant — ancré à `INSET` du bord DROIT de la cellule-étiquette.
    La même valeur sert au champ et aux options du tiroir : c'est elle qui fait
    tenir la colonne de LED d'un bloc. */
const DOT_X = CAP_WIDTH - INSET - STATE_DOT_SIZE;

function optionLabel(item: ListSelectorItem) {
  return item.count === undefined ? item.label : `${item.label} (${item.count})`;
}

export function ListSelector({
  hint,
  ariaLabel,
  items,
  value,
  onChange,
  mark,
  tone,
  lit,
  corners = 'all',
  flush = false,
}: {
  /** Micro-libellé de la cellule sombre (« GROUP BY », « SHOW »). */
  hint: string;
  ariaLabel: string;
  items: ListSelectorItem[];
  value: string;
  onChange: (key: string) => void;
  mark: 'fill' | 'dot';
  tone: Tone;
  /** Voyant du champ fermé (variante `dot` seulement) : allumé quand la
      sélection est « engagée » — pour la rangée de valeurs, quand un filtre
      autre que « All » est actif. */
  lit?: boolean;
  /** Place du module dans un BLOC de modules collés : seuls les coins
      extérieurs du bloc s'arrondissent. `all` pour un module isolé. */
  corners?: 'top' | 'bottom' | 'all';
  /** Le module court d'un bord à l'autre de l'écran : plus de coins, donc
      plus de rayon. Piloté par le parent, qui seul sait s'il a retiré sa
      gouttière (cf. l'état collé de la console d'`/archives`). */
  flush?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const listId = useId();
  const current = items.find((i) => i.key === value) ?? items[0];
  const rTop = flush || corners === 'bottom' ? 0 : CONTROL_RADIUS;
  // Tiroir ouvert : c'est LUI qui ferme le bloc par le bas.
  const rBottom = flush || corners === 'top' || open ? 0 : CONTROL_RADIUS;

  // Fermeture au clic extérieur. Écouteur posé SEULEMENT quand le tiroir est
  // ouvert — et le tiroir ne peut pas s'ouvrir quand la branche est masquée en
  // `display:none` (aucun geste ne l'atteint), donc rien à garder par
  // visibilité ici, contrairement aux écouteurs globaux de /series.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // À l'ouverture, le focus part sur l'option courante : le lecteur d'écran
  // annonce où l'on est, et les flèches partent de là.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]'
    );
    (
      el ?? listRef.current?.querySelector<HTMLElement>('[role="option"]')
    )?.focus();
  }, [open]);

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function pick(key: string) {
    onChange(key);
    close();
  }

  function moveFocus(to: number | 'first' | 'last') {
    const options = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []
    );
    if (options.length === 0) return;
    const index = to === 'first' ? 0 : to === 'last' ? options.length - 1 : to;
    // Pas de boucle : arriver au bout de la liste et repartir en haut fait
    // perdre le fil sur une liste de vingt valeurs.
    options[Math.max(0, Math.min(options.length - 1, index))]?.focus();
  }

  function onListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    const options = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []
    );
    const at = options.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(at + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(at - 1);
        break;
      case 'Home':
        e.preventDefault();
        moveFocus('first');
        break;
      case 'End':
        e.preventDefault();
        moveFocus('last');
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        // Tab sort du tiroir : on le referme pour ne pas laisser un calque
        // ouvert derrière le focus.
        close(false);
        break;
      default:
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        style={{
          height: ROW_H,
          backgroundColor: SURFACE[tone],
          borderRadius: `${rTop}px ${rTop}px ${rBottom}px ${rBottom}px`,
        }}
        className="flex w-full items-stretch overflow-hidden cursor-pointer text-left"
      >
        {/* Cellule-étiquette — l'aplat sombre, colonne commune aux rangées.
            Le voyant s'ancre à SON bord droit : hors du flux du libellé, et
            aligné avec ceux du tiroir. */}
        <span
          className={cn(
            MICRO_LABEL_XS,
            'flex flex-none items-center justify-between text-[var(--color-fg-muted-dark)] bg-[var(--color-bg-plate-dark)]'
          )}
          style={{ width: CAP_WIDTH, paddingLeft: INSET, paddingRight: INSET }}
        >
          {hint}
          {mark === 'dot' && <StateDot on={!!lit} />}
        </span>

        {/* Cellule-valeur — l'afficheur. Même voix dans les deux rangées. */}
        <span
          className="flex min-w-0 flex-1 items-center"
          style={{ paddingLeft: INSET, paddingRight: INSET }}
        >
          <span className="min-w-0 truncate text-[12px] font-bold uppercase tabular-nums text-[var(--color-fg)]">
            {current ? optionLabel(current) : ''}
          </span>
        </span>

        {/* Cellule-chevron — la TOUCHE du boîtier : carrée, orange en
            PERMANENCE. Voir l'en-tête, « Pourquoi le chevron est toujours
            orange ». L'état ouvert est porté par la seule rotation. */}
        <span
          aria-hidden
          className="flex flex-none items-center justify-center"
          style={{
            width: ROW_H,
            backgroundColor: 'var(--color-active-bg)',
            color: 'var(--color-fg)',
          }}
        >
          <ChevronDown
            size={16}
            strokeWidth={2.5}
            className={cn(
              'transition-[rotate] duration-150 motion-reduce:transition-none',
              open && 'rotate-180'
            )}
          />
        </span>
      </button>

      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          style={{
            backgroundColor: 'var(--color-bg-raised)',
            // Le tiroir passe par-dessus la rangée de pastilles (`sticky`,
            // z-30) : il lui faut un cran de plus. Il reste sous le bouton
            // MENU du header (z-55).
            zIndex: 40,
            borderRadius: flush ? 0 : `0 0 ${CONTROL_RADIUS}px ${CONTROL_RADIUS}px`,
            maxHeight: '60vh',
            overscrollBehavior: 'contain',
            boxShadow: '0 12px 32px rgb(0 0 0 / 0.16)',
          }}
          className="console-panel absolute left-0 right-0 top-full overflow-y-auto"
        >
          {items.map((item) => {
            const selected = item.key === value;
            return (
              <li
                key={item.key}
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                onClick={() => pick(item.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pick(item.key);
                  }
                }}
                style={
                  {
                    height: ROW_H,
                    // La grille du module continue dans le tiroir : le texte
                    // des options tombe sur la colonne-valeur du champ.
                    paddingLeft: CAP_WIDTH + INSET,
                    paddingRight: INSET,
                    borderTopColor: 'var(--color-line)',
                    // Cellule ENTIÈRE orange pour l'option courante (demande
                    // Alexandre, 2026-08-23) — plus un surlignage du seul
                    // libellé.
                    backgroundColor: selected
                      ? 'var(--color-active-bg)'
                      : undefined,
                    // Sur la cellule orange, le voyant orange serait invisible
                    // (~1,5:1) : son encre suit celle du libellé. Remap LOCAL
                    // du token — jamais un hex dans un composant.
                    ...(selected && mark === 'dot'
                      ? { '--color-link': 'var(--color-fg)' }
                      : {}),
                  } as React.CSSProperties
                }
                className={cn(
                  'relative flex items-center cursor-pointer outline-none',
                  // Couture entre cellules — pas sur la première, le bord du
                  // champ au-dessus fait déjà la séparation.
                  'border-t first:border-t-0',
                  'text-[12px] font-bold uppercase tabular-nums',
                  selected
                    ? 'text-[var(--color-fg)]'
                    : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-visible:text-[var(--color-fg)]'
                )}
              >
                {mark === 'dot' && (
                  <span
                    className="absolute flex"
                    style={{ left: DOT_X, top: '50%', marginTop: -STATE_DOT_SIZE / 2 }}
                  >
                    <StateDot on={selected} />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">
                  {optionLabel(item)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
