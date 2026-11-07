'use client';

import Link from 'next/link';
import { DICT, THEME_PARAM, seriesPath, type Lang } from '@/lib/journal/i18n';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ListSelector } from '@/components/site/ListSelector';
import { EDITORIAL_SIDENOTE, MICRO_LABEL, PAGE_TITLE_GAP } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import type { ArticleSummary } from '@/lib/journal/types';
import { FIRST_VISIT, readFolders, writeFolders, type FolderMemory, type FolderName, type FolderState } from '@/lib/journal/folder-memory';
import { Folder, FolderFlow, FolderList, FolderPeek, TREE_INDENT, type Filter } from '@/components/journal/FolderTree';
import { ThemeBar } from '@/components/journal/journal-index/ThemeBar';
import { FilterGroup } from '@/components/journal/journal-index/FilterColumn';
import { DATE_COL, Row } from '@/components/journal/journal-index/ArticleRow';

/**
 * PAGE D'ACCUEIL DU JOURNAL — reprise de stripe.dev/blog (demande Alexandre,
 * 2026-10-17), traduite dans la grammaire du site (brand book §14.7) :
 *
 * - une colonne de filtres à gauche (« Séries »), collante ;
 * - un index en lignes : « Date », « Titre », un « + » qui déplie le
 *   sous-titre DANS la ligne (2026-10-22) — elle grandit et pousse les
 *   suivantes ;
 * - au survol, la ligne s'inverse — encre sur papier devient papier sur
 *   encre. Stripe la passe en vert ; ici l'orange n'a pas le droit d'être une
 *   surface (§4.3), il reste ce qu'il est partout : le voyant de la ligne
 *   active.
 *
 * Sous `md`, la colonne de filtres monte au-dessus de l'index : les mêmes
 * dossiers, leurs entrées à la suite (`FolderFlow`). Un `ListSelector` ne
 * reste que tant qu'aucune thématique n'existe.
 *
 * Une ligne qui appartient à une série le dit sous son titre (2026-10-19,
 * descendue de la colonne de droite le 2026-10-21) : une flèche, le nom de la
 * série et sa partie « 2/3 » encadrée. C'est un LIEN vers la page de la
 * série, au bleu du logo (les thématiques restent grises) : l'ensemble se
 * rejoint depuis l'index sans passer par les filtres. Sous le titre, un nom de
 * série long ne prend plus la largeur du titre. Filtrée sur une série, la
 * ligne ne garde que la partie : le nom est déjà dans le filtre.
 *
 * Les THÉMATIQUES (2026-10-19) : un second filtre, qui se combine au premier
 * (série ET thématique). Les deux partagent la même place : deux DOSSIERS
 * (`Folder`, 2026-10-24 ; des onglets avant), séries ouvertes par défaut ;
 * ouvrir l'un n'est qu'une vue,
 * il ne remet aucun filtre à zéro — un voyant sur le fermé dit qu'il
 * filtre encore. Les dossiers n'apparaissent qu'à la première thématique posée
 * sur un article. Les compteurs d'un filtre se lisent dans l'autre — « (3) »
 * promet trois lignes. La thématique choisie s'écrit dans l'adresse
 * (`?theme=`) : c'est le lien que posent les pages d'article, et elle ouvre
 * le dossier des thématiques. Chaque ligne de l'index nomme ses thématiques
 * sous son titre.
 *
 * Plusieurs thématiques peuvent filtrer à la fois (2026-10-22, demande
 * Alexandre) : un article passe s'il en porte UNE (ou, pas et — chaque thème
 * ajouté élargit). Dès qu'une thématique filtre, un bandeau « Filtrage » coiffe
 * l'index (`ThemeBar`) : ce qui filtre, un « Tout afficher » pour en sortir sans
 * chercher la colonne, et toutes les thématiques en bascules. Un clic sur la
 * thématique d'une ligne, lui, REMPLACE le filtre — on change de piste ; on
 * cumule depuis le bandeau. La colonne de gauche garde le choix unique.
 *
 * Une thématique peut porter une COULEUR (Studio, 2026-10-21) : un carré
 * devant son nom, dans la ligne, la colonne de filtres et l'article
 * (`TagSwatch`).
 *
 * Sous les filtres, la COUVERTURE de l'article survolé (champ « Image de
 * couverture » du Studio, 2026-10-18 — elle remplace la vignette de la
 * Fig. 1). Toutes les couvertures sont montées, empilées, et seule celle de
 * la ligne active s'ouvre : rien ne se charge au survol. Mécanique et
 * timings : bloc « COUVERTURES DU JOURNAL » de `globals.css`.
 */

const ALL = '__all';

/** Filtre des articles qui n'appartiennent à aucune série (clé interne ; le libellé vient du dictionnaire). */
const HORS_SERIE = '__none';

/** Largeur de la colonne de filtres au-dessus de `md`. */
const FILTER_COL = 220;
/** De part et d'autre d'un filet de la colonne de filtres — la valeur du rail d'un article (PageShell). */
const RAIL_SECTION_GAP = 16;
/** Ce qui dépasse sous les drapeaux : écart (4) + chevron (14) de `LanguageSwitch` — idem PageShell. */
const FLAG_CHEVRON_HANG = 18;

/** Téléphone : écart drapeaux (bloc de titre) → onglets des filtres. */
const MOBILE_FILTERS_GAP = 28;

export function JournalIndex({
  articles,
  lang,
  language,
}: {
  articles: ArticleSummary[];
  lang: Lang;
  /** Le sélecteur de langue, posé en tête de la colonne de filtres. */
  language: ReactNode;
}) {
  const t = DICT[lang];
  const [series, setSeries] = useState(ALL);
  // Les thématiques qui filtrent ; vide = toutes.
  const [picked, setPickedState] = useState<string[]>([]);
  // Chaque dossier : en aperçu (premier passage), ouvert ou fermé. Le HTML
  // servi part de l'aperçu ; la mémoire du lecteur est relue au montage,
  // SANS transition (`settled`), pour qu'un retour ne rejoue pas un dépliage.
  const [folders, setFoldersState] = useState<FolderMemory>(FIRST_VISIT);
  const [settled, setSettled] = useState(false);
  const setFolder = (name: FolderName, state: FolderState) =>
    setFoldersState((prev) => {
      const next = { ...prev, [name]: state };
      writeFolders(next);
      return next;
    });
  const toggleFolder = (name: FolderName) => setFolder(name, folders[name] === 'open' ? 'closed' : 'open');
  // Desktop : PAS d'aperçu ni de mémoire — la colonne a la place de tout
  // montrer. Un dossier ouvert à la fois, séries au chargement : c'est par
  // elles qu'on entre dans le journal (rétabli le 2026-10-25, l'aperçu du
  // téléphone avait gagné le desktop avec 61afae1).
  const [deskOpen, setDeskOpen] = useState<FolderName>('series');
  const openThemes = () => {
    setFolder('themes', 'open');
    setDeskOpen('themes');
  };
  const bar = useRef<HTMLDivElement | null>(null);
  // La ligne survolée (ou focalisée) : sa couverture s'ouvre dans la colonne de gauche.
  const [active, setActive] = useState<string | null>(null);
  const covers = articles.filter((a) => a.cover);

  const inSeries = (a: ArticleSummary) => series === ALL || (a.series ?? HORS_SERIE) === series;
  const inTheme = (a: ArticleSummary) => picked.length === 0 || a.tags.some((tag) => picked.includes(tag.slug));

  // La liste des séries ne bouge pas ; ses compteurs suivent la thématique choisie.
  const filters = useMemo<Filter[]>(() => {
    const pool = articles.filter(inTheme);
    const counts = new Map<string, number>();
    for (const a of articles) counts.set(a.series ?? HORS_SERIE, 0);
    for (const a of pool) {
      const name = a.series ?? HORS_SERIE;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [
      { key: ALL, label: t.all, count: pool.length },
      // « Hors série » ferme la liste : c'est le reste, pas une série de plus
      // (même place que « Autres » dans un filtre, 2026-10-24).
      ...[...counts]
        .sort(([a], [b]) => Number(a === HORS_SERIE) - Number(b === HORS_SERIE))
        .map(([name, count]) => ({ key: name, label: name === HORS_SERIE ? t.noSeries : name, count })),
    ];
  }, [articles, t, picked]);

  // Les thématiques, par ordre alphabétique : la liste grandit avec le
  // journal, on y cherche un mot, pas un rang. Vide : pas de groupe.
  const themes = useMemo<Filter[]>(() => {
    const names = new Map<string, string>();
    const colors = new Map<string, string | null>();
    for (const a of articles) {
      for (const tag of a.tags) {
        names.set(tag.slug, tag.title);
        colors.set(tag.slug, tag.color);
      }
    }
    if (names.size === 0) return [];
    const pool = articles.filter(inSeries);
    return [
      { key: ALL, label: t.all, count: pool.length },
      ...[...names]
        .sort(([, x], [, y]) => x.localeCompare(y, lang))
        .map(([slug, title]) => ({
          key: slug,
          label: title,
          color: colors.get(slug),
          count: pool.filter((a) => a.tags.some((tag) => tag.slug === slug)).length,
        })),
    ];
  }, [articles, t, lang, series]);

  useEffect(() => {
    setFoldersState(readFolders());
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setSettled(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  // `?theme=<slug>,<slug>` : lu au montage (l'export est statique, le HTML
  // servi ne connaît pas l'adresse), réécrit à chaque choix pour que l'adresse
  // se partage. Un slug inconnu (thématique retirée depuis) est ignoré.
  useEffect(() => {
    const slugs = (new URLSearchParams(window.location.search).get(THEME_PARAM) ?? '')
      .split(',')
      .filter((slug) => articles.some((a) => a.tags.some((tag) => tag.slug === slug)));
    if (slugs.length) {
      setPickedState(slugs);
      openThemes();
    }
  }, [articles]);

  const setPicked = (slugs: string[]) => {
    setPickedState(slugs);
    const url = new URL(window.location.href);
    if (slugs.length === 0) url.searchParams.delete(THEME_PARAM);
    else url.searchParams.set(THEME_PARAM, slugs.join(','));
    window.history.replaceState(window.history.state, '', url);
  };

  // Depuis les dossiers : un seul choix, « Tout » vide le filtre.
  const setTheme = (key: string) => {
    setPicked(key === ALL ? [] : [key]);
  };

  // Bascule depuis le bandeau : ajoute ou retire, dans l'ordre de la liste.
  const toggleTheme = (key: string) => {
    const next = picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key];
    setPicked(themes.map((f) => f.key).filter((k) => next.includes(k)));
  };

  // Depuis une ligne : le filtre passe à CETTE thématique. Si le bandeau est
  // au-dessus de l'écran (ligne lointaine, ou téléphone), on y remonte pour que
  // le tri se voie. Il ne grandit que vers le bas : son haut ne bouge pas
  // pendant qu'il s'ouvre, la cible tient.
  const pickTheme = (key: string) => {
    setPicked([key]);
    openThemes();
    const box = bar.current;
    if (box && box.getBoundingClientRect().top < 0) {
      const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      box.scrollIntoView({ block: 'start', behavior: instant ? 'auto' : 'smooth' });
    }
  };

  // La page de la série choisie dans les filtres : le filtre trie, la page présente.
  const seriesSlug = series === ALL ? null : (articles.find((a) => a.series === series)?.seriesSlug ?? null);
  const seriesLink = seriesSlug && (
    <Link
      href={seriesPath(seriesSlug, lang)}
      className={cn(MICRO_LABEL, 'group flex w-fit items-center gap-2 text-[var(--color-fg)] underline underline-offset-4')}
    >
      {t.seriesPage}
      <span aria-hidden className="no-underline transition-[translate] duration-200 ease-out group-hover:translate-x-[3px] motion-reduce:transition-none">
        →
      </span>
    </Link>
  );

  // Nombre de parties de chaque série : les articles publiés dans cette
  // langue, ou la plus haute partie si une traduction manque au milieu.
  const totals = useMemo(() => {
    const out = new Map<string, number>();
    for (const a of articles) {
      if (a.series) out.set(a.series, Math.max(out.get(a.series) ?? 0, a.part));
    }
    for (const [name, n] of out) out.set(name, Math.max(n, articles.filter((a) => a.series === name).length));
    return out;
  }, [articles]);

  const shown = articles.filter((a) => inSeries(a) && inTheme(a));
  const tabsId = useId();
  // Le voyant de chaque onglet : son filtre trie-t-il encore ?
  const lit = { series: series !== ALL, themes: picked.length > 0 };

  const seriesSelector = (
    <ListSelector
      hint={t.seriesHint}
      ariaLabel={t.filterBySeries}
      items={filters}
      value={series}
      onChange={setSeries}
      mark="dot"
      tone="plate"
      lit={series !== ALL}
    />
  );

  return (
    <div className="flex flex-col md:grid md:gap-x-12" style={{ gridTemplateColumns: `${FILTER_COL}px minmax(0, 1fr)` }}>
      {/* FILTRES — téléphone. Les drapeaux vivent dans le bloc de titre
          (`JournalHome`) : le bloc remonte vers eux, l'écart de page
          (`PAGE_TITLE_GAP`) ramené à MOBILE_FILTERS_GAP — les onglets suivent
          la langue au lieu d'attendre après un grand blanc (2026-10-20). */}
      <div
        className="md:hidden"
        style={{ marginTop: MOBILE_FILTERS_GAP - PAGE_TITLE_GAP, marginBottom: 32, scrollMarginTop: 16 }}
      >
        {themes.length === 0 ? (
          <>
            {seriesSelector}
            {seriesLink && <div style={{ marginTop: 16 }}>{seriesLink}</div>}
          </>
        ) : (
          <div role="group" aria-label={t.filters} className="flex flex-col">
            <Folder
              id={`${tabsId}-m-series`}
              name={t.seriesHeading}
              state={folders.series}
              settled={settled}
              onToggle={() => toggleFolder('series')}
              lit={lit.series}
              entries={filters.length - 1}
              roomy
              peek={
                <FolderPeek
                  current={filters[0]}
                  isOn={(key) => key === series}
                  onChange={setSeries}
                  more={t.showAllSeries(filters.length - 1)}
                  onMore={() => setFolder('series', 'open')}
                />
              }
            >
              <FolderFlow items={filters} isOn={(key) => key === series} onChange={setSeries} after={seriesLink} />
            </Folder>
            <Folder
              id={`${tabsId}-m-themes`}
              name={t.themesHeading}
              state={folders.themes}
              settled={settled}
              onToggle={() => toggleFolder('themes')}
              lit={lit.themes}
              entries={themes.length - 1}
              roomy
              peek={<FolderPeek more={t.showAllThemes(themes.length - 1)} onMore={() => setFolder('themes', 'open')} />}
            >
              <FolderFlow
                items={themes}
                isOn={(key) => (key === ALL ? picked.length === 0 : picked.includes(key))}
                onChange={setTheme}
              />
            </Folder>
          </div>
        )}
      </div>

      {/* FILTRES — desktop, colonne collante */}
      {/* Même grammaire que le rail d'un article (2026-10-25) : un filet
          CLAIR entre les blocs, 16 px de part et d'autre ; le chevron de la
          langue pend dans l'air du dessous. Pas de filet au-dessus des
          couvertures : vides hors survol, il pendrait sur du blanc. */}
      <aside className="hidden md:flex flex-col self-start sticky top-6" aria-label={t.filters} style={{ gap: RAIL_SECTION_GAP }}>
        <div style={{ marginBottom: -FLAG_CHEVRON_HANG }}>{language}</div>
        <div aria-hidden className="shrink-0 self-stretch" style={{ height: 1, backgroundColor: 'var(--color-line)' }} />
        {themes.length === 0 ? (
          <FilterGroup heading={t.seriesHeading} items={filters} isOn={(key) => key === series} onChange={setSeries}>
            {seriesLink && <div style={{ paddingTop: 16 }}>{seriesLink}</div>}
          </FilterGroup>
        ) : (
          <div role="group" aria-label={t.filters} className="flex flex-col">
            <Folder
              id={`${tabsId}-d-series`}
              name={t.seriesHeading}
              state={deskOpen === 'series' ? 'open' : 'closed'}
              settled={settled}
              onToggle={() => setDeskOpen('series')}
              lit={lit.series}
              entries={filters.length - 1}
              peek={null}
            >
              <FolderList items={filters} isOn={(key) => key === series} onChange={setSeries}>
                {seriesLink && <div style={{ paddingBottom: 10, paddingLeft: TREE_INDENT }}>{seriesLink}</div>}
              </FolderList>
            </Folder>
            <Folder
              id={`${tabsId}-d-themes`}
              name={t.themesHeading}
              state={deskOpen === 'themes' ? 'open' : 'closed'}
              settled={settled}
              onToggle={() => setDeskOpen('themes')}
              lit={lit.themes}
              entries={themes.length - 1}
              peek={null}
            >
              <FolderList
                items={themes}
                isOn={(key) => (key === ALL ? picked.length === 0 : picked.includes(key))}
                onChange={setTheme}
              />
            </Folder>
          </div>
        )}

        {covers.length > 0 && (
          <div className="journal-covers" aria-hidden style={{ marginTop: 40 - RAIL_SECTION_GAP }}>
            {covers.map((a) => (
              <div key={a.slug} className="journal-cover" data-on={a.slug === active ? '' : undefined}>
                <img
                  src={a.cover!.src}
                  srcSet={a.cover!.srcSet}
                  sizes={`${FILTER_COL}px`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: a.cover!.position }}
                />
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* INDEX */}
      <section aria-label="Articles" className="flex flex-col min-w-0">
        <ThemeBar
          ref={bar}
          lang={lang}
          themes={themes.filter((f) => f.key !== ALL)}
          picked={picked}
          onToggle={toggleTheme}
          onClear={() => setPicked([])}
        />
        <div
          className={cn(MICRO_LABEL, 'hidden md:grid leading-none text-[var(--color-fg-muted)]')}
          style={{
            gridTemplateColumns: `${DATE_COL}px minmax(0, 1fr)`,
            // Même souligné que « Langue », sur la même ligne : les deux
            // filets noirs n'en font qu'un, d'une colonne à l'autre (2026-10-25).
            paddingBottom: 4,
            borderBottom: '1px solid var(--color-fg)',
          }}
        >
          {/* Aligné sur le texte des dates : retrait de ligne (8) + voyant (7) + écart (10). */}
          <span style={{ paddingLeft: 25 }}>{t.dateCol}</span>
          <span>{t.titleCol}</span>
        </div>
        {shown.length === 0 ? (
          <p className={cn(EDITORIAL_SIDENOTE, 'text-[15px]')} style={{ paddingBlock: 24 }}>
            {t.noArticles}
          </p>
        ) : (
          <ol className="flex flex-col">
            {shown.map((a) => (
              <Row
                key={a.slug}
                article={a}
                lang={lang}
                total={a.series ? (totals.get(a.series) ?? 0) : 0}
                showSeriesName={series === ALL}
                onTheme={pickTheme}
                onHot={(on) => setActive((cur) => (on ? a.slug : cur === a.slug ? null : cur))} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
