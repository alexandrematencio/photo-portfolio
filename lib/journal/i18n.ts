/**
 * LES LANGUES DU JOURNAL (2026-10-18) — français, anglais, russe.
 *
 * - Adresses : le français garde la racine (les adresses déjà indexées ne
 *   bougent pas), l'anglais vit sous `/en/`, le russe sous `/ru/`. Chaque
 *   traduction a sa propre adresse, traduite (en caractères latins pour le
 *   russe : un lien partagé reste lisible).
 * - Contenu : un article traduit est un document `post` à part, qui pointe
 *   son original français (`translationOf`). Séries et signature portent
 *   leurs traductions dans un champ `translations` (sanity/schemas/journal.ts).
 * - Langue par défaut : celle du système, choisie AVANT le premier rendu par
 *   `languageScript` (layouts du blog), jusqu'à ce que le lecteur en choisisse
 *   une avec `LanguageSwitch` — son choix prime ensuite.
 *
 * Le russe est écrit au masculin : c'est Alexandre qui parle.
 *
 * Ce module ne dépend ni de React ni de Sanity : composants client et serveur
 * l'importent.
 */

export const LANGS = ['fr', 'en', 'ru'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'fr';

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/** Clé de `localStorage` du choix du lecteur (lue par `languageScript`). */
export const LANG_STORAGE_KEY = 'journal-lang';

/** Préfixe d'adresse : rien pour le français, `/en`, `/ru`. */
export function langPrefix(lang: Lang): string {
  return lang === DEFAULT_LANG ? '' : `/${lang}`;
}

/** Le segment des pages de série, dans la langue de l'adresse. */
const SERIES_SEGMENT: Record<Lang, string> = { fr: 'serie', en: 'series', ru: 'seriya' };

/** Accueil du journal dans une langue (slash final : `trailingSlash: true`). */
export function homePath(lang: Lang = DEFAULT_LANG): string {
  return `${langPrefix(lang)}/`;
}

export function articlePath(slug: string, lang: Lang = DEFAULT_LANG): string {
  return `${langPrefix(lang)}/${slug}/`;
}

export function seriesPath(slug: string, lang: Lang = DEFAULT_LANG): string {
  return `${langPrefix(lang)}/${SERIES_SEGMENT[lang]}/${slug}/`;
}

/** La langue d'une adresse du journal, lue sur son premier segment. */
export function langOfPath(pathname: string | null): Lang {
  const first = pathname?.split('/')[1];
  return isLang(first) && first !== DEFAULT_LANG ? first : DEFAULT_LANG;
}

/** Les attributs BCP 47 et Open Graph de chaque langue. */
/** `flag` : le fichier de `public/img/flags/` qui représente la langue dans le sélecteur. */
export const LOCALE: Record<Lang, { bcp47: string; og: string; native: string; code: string; flag: string }> = {
  fr: { bcp47: 'fr-FR', og: 'fr_FR', native: 'Français', code: 'FR', flag: 'fr' },
  en: { bcp47: 'en-US', og: 'en_US', native: 'English', code: 'EN', flag: 'uk' },
  ru: { bcp47: 'ru-RU', og: 'ru_RU', native: 'Русский', code: 'RU', flag: 'ru' },
};

/**
 * Le script qui choisit la langue AVANT la première peinture, posé en tête
 * du <body> des layouts du blog (le <head> est alors entièrement lu, donc
 * ses `<link rel="alternate" hreflang>` aussi).
 *
 * 1. Les robots ne sont jamais redirigés : Google doit voir et indexer les
 *    trois versions, chacune à son adresse.
 * 2. Le choix du lecteur (`LanguageSwitch`) prime ; à défaut, la première
 *    langue du système qu'on sait servir ; à défaut, l'anglais.
 * 3. On ne part que si la page existe dans cette langue (son lien
 *    `hreflang`) — un article non traduit reste où il est.
 *
 * `location.replace` : la page quittée ne reste pas dans l'historique, le
 * bouton Retour ne ramène pas à une redirection.
 */
export function languageScript(current: Lang): string {
  return `(function(){try{
if(/bot|crawl|spider|slurp|lighthouse|preview|facebookexternalhit|embedly|quora|whatsapp|telegram/i.test(navigator.userAgent))return;
var langs=${JSON.stringify(LANGS)},want=null;
try{want=localStorage.getItem(${JSON.stringify(LANG_STORAGE_KEY)});}catch(e){}
if(langs.indexOf(want)<0){want='en';var l=navigator.languages||[navigator.language];
for(var i=0;i<l.length;i++){var c=String(l[i]||'').slice(0,2).toLowerCase();if(langs.indexOf(c)>=0){want=c;break;}}}
if(want===${JSON.stringify(current)})return;
var a=document.querySelector('link[rel="alternate"][hreflang^="'+want+'"]');
if(a&&a.href)location.replace(a.href+location.hash);
}catch(e){}})();`;
}

/** Retient le choix du lecteur — appelé par le sélecteur de langue. */
export function rememberLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Navigation privée, stockage bloqué : le choix vaut pour ce clic.
  }
}

/**
 * Les mots de l'interface du journal. Le menu principal (All sites, Journal,
 * About) reste en anglais sur les trois langues, comme sur tout amatencio.com.
 */
/** Titre et description lus par les machines (<title>, <desc>), légende lue par tous. */
type FigureText = { title: string; desc: string; legend: string };

type Dict = {
  siteName: string;
  siteDescription: string;
  feedTitle: string;
  back: string;
  language: string;
  allArticles: string;
  minutes: (n: number) => string;
  references: (n: number) => string;
  articles: (n: number) => string;
  part: (n: number) => string;
  series: string;
  seriesHeading: string;
  seriesKicker: string;
  seriesPage: string;
  seriesNav: (title: string) => string;
  seriesLine: (title: string, n: number) => string;
  seriesFallback: (title: string, n: number, titles: string, author: string) => string;
  filters: string;
  filterBySeries: string;
  seriesHint: string;
  all: string;
  noSeries: string;
  dateCol: string;
  titleCol: string;
  noArticles: string;
  readArticle: string;
  expand: (title: string) => string;
  collapse: (title: string) => string;
  referencesTitle: string;
  backToCall: (n: string) => string;
  note: (n: string) => string;
  workshopNote: (n: string) => string;
  toDecide: string;
  close: string;
  notes: string;
  verdicts: {
    converge: string;
    nuance: string;
    open: string;
    fails: string;
    caption: string;
    distribution: string;
    head: [string, string, string];
  };
  /** « Fig. 3 » — numérotée dans l'ordre de l'article (`ArticleBody`). */
  figureLabel: (n: number) => string;
  /** Les libellés des figures dessinées (components/journal/figures/), une entrée par figure. */
  figures: {
    loop: FigureText & {
      brain: string;
      body: string;
      sends: string;
      returns: string;
      relief: string;
      head: string;
      gut: string;
      lag: string;
      time: string;
    };
    cascade: FigureText & {
      conscious: string;
      unconscious: string;
      light: string;
      mood: string;
      urge: string;
      memory: string;
      bodyState: string;
      lived: string;
      decision: string;
      unseen: string;
    };
    bridge: FigureText & {
      master: string;
      slave: string;
      bridge: string;
      consciousness: string;
      mechanisms: string;
      commands: string;
      watches: string;
      links: string;
    };
  };
  journalHome: string;
  dateLocale: string;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Russe : 1 статья, 2–4 статьи, 5+ статей (et 11–14 → статей). */
function ru(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const DICT: Record<Lang, Dict> = {
  fr: {
    siteName: 'Journal d’Alexandre Matencio',
    siteDescription:
      'Le journal d’Alexandre Matencio : des textes longs et sourcés sur les marchés de collection, la conscience et ce que la recherche en dit.',
    feedTitle: 'Journal d’Alexandre Matencio',
    back: 'Retour',
    language: 'Langue',
    allArticles: 'Tous les articles',
    minutes: (n) => `${n} min de lecture`,
    references: (n) => `${n} ${plural(n, 'référence', 'références')}`,
    articles: (n) => `${n} ${plural(n, 'article', 'articles')}`,
    part: (n) => `Partie ${n}`,
    series: 'Série',
    seriesHeading: 'Séries',
    seriesKicker: 'Journal · Série',
    seriesPage: 'Page de la série',
    seriesNav: (t) => `La série ${t}`,
    seriesLine: (t, n) => `La série · ${t} · ${n} articles`,
    seriesFallback: (t, n, titles, author) => `${t} : une série en ${n} articles d’${author} — ${titles}.`,
    filters: 'Filtres',
    filterBySeries: 'Filtrer par série',
    seriesHint: 'SÉRIE',
    all: 'Tout',
    noSeries: 'Hors série',
    dateCol: 'Date',
    titleCol: 'Titre',
    noArticles: 'Aucun article publié pour l’instant.',
    readArticle: 'Lire l’article →',
    expand: (t) => `Déplier « ${t} »`,
    collapse: (t) => `Replier « ${t} »`,
    referencesTitle: 'Références',
    backToCall: (n) => `Retour à l’appel de note ${n}`,
    note: (n) => `Note ${n}`,
    workshopNote: (n) => `Note d’atelier ${n}`,
    toDecide: 'À trancher',
    close: 'Fermer',
    notes: 'Notes',
    verdicts: {
      converge: 'Converge',
      nuance: 'Converge avec réserve',
      open: 'Ouvert, à tester',
      fails: 'Ne tient pas',
      caption: 'Le bilan idée par idée',
      distribution: 'Répartition des verdicts',
      head: ['Ce que j’ai déduit', 'Ce qui existait', 'Verdict'],
    },
    figureLabel: (n) => `Fig. ${n}`,
    figures: {
      loop: {
        title: 'La boucle corps-cerveau et le décalage qu’elle prédit',
        brain: 'CERVEAU',
        body: 'CORPS',
        sends: 'traite et envoie',
        returns: 'garde et renvoie',
        relief: 'soulagement',
        head: 'TÊTE',
        gut: 'VENTRE',
        lag: 'décalage mesurable',
        time: 'temps →',
        desc: 'En haut, le cerveau traite et envoie vers le corps, le corps garde et renvoie vers le cerveau. En bas, deux courbes d’activation après un soulagement : la tête redescend d’abord, le ventre ensuite ; l’écart entre les deux est le décalage mesurable.',
        legend: 'La boucle, et ce qu’elle prédit : après un vrai soulagement, la tête lâche d’abord, le ventre ensuite. Schéma d’après le texte, pas une mesure.',
      },
      cascade: {
        title: 'La cascade intérieure du samedi matin',
        desc: 'Une ligne horizontale figure le seuil de la conscience. En dessous, une variation de lumière, une disposition puis une envie de sortir s’enchaînent, nourries en chemin par un souvenir et par un état du corps. Seule la dernière étape franchit le seuil : la décision « Je sors, gare de Lyon », vécue comme un choix.',
        legend: 'Le samedi matin, tel que je me le représente : plusieurs influences se combinent sous le seuil, et je n’éprouve que la dernière, comme une décision. Schéma d’après le texte, pas une mesure.',
        conscious: 'CONSCIENT',
        unconscious: 'NON CONSCIENT',
        light: 'une variation de lumière',
        mood: 'une disposition',
        urge: 'une envie de sortir',
        memory: 'un souvenir ?',
        bodyState: 'un état du corps ?',
        lived: 'CE QUE JE VIS',
        decision: '« Je sors, gare de Lyon »',
        unseen: 'ce qui a pu se passer, sans être vu',
      },
      bridge: {
        title: 'Maître, esclave ou pont',
        desc: 'Trois façons de placer la conscience au-dessus des mécanismes inconscients. Maître : elle envoie des ordres vers eux. Esclave : elle ne fait que recevoir ce qui monte d’eux. Pont : le flux entre dans la conscience, y est relié, et en ressort vers les mécanismes.',
        legend: 'Trois places possibles pour la conscience. Celle que je retiens : un passage, qui reçoit, relie et renvoie vers ce qui l’a produit. Schéma d’après le texte, pas une mesure.',
        master: 'MAÎTRE',
        slave: 'ESCLAVE',
        bridge: 'PONT',
        consciousness: 'conscience',
        mechanisms: 'mécanismes inconscients',
        commands: 'elle commande tout',
        watches: 'elle regarde passer',
        links: 'elle relie et renvoie',
      },
    },
    journalHome: 'Journal — accueil',
    dateLocale: 'fr-FR',
  },
  en: {
    siteName: 'Alexandre Matencio’s Journal',
    siteDescription:
      'Alexandre Matencio’s journal: long, sourced essays on collectible markets, consciousness and what research has to say about them.',
    feedTitle: 'Alexandre Matencio’s Journal',
    back: 'Back',
    language: 'Language',
    allArticles: 'All articles',
    minutes: (n) => `${n} min read`,
    references: (n) => `${n} ${plural(n, 'reference', 'references')}`,
    articles: (n) => `${n} ${plural(n, 'article', 'articles')}`,
    part: (n) => `Part ${n}`,
    series: 'Series',
    seriesHeading: 'Series',
    seriesKicker: 'Journal · Series',
    seriesPage: 'Series page',
    seriesNav: (t) => `The ${t} series`,
    seriesLine: (t, n) => `The series · ${t} · ${n} articles`,
    seriesFallback: (t, n, titles, author) => `${t}: a series of ${n} articles by ${author} — ${titles}.`,
    filters: 'Filters',
    filterBySeries: 'Filter by series',
    seriesHint: 'SERIES',
    all: 'All',
    noSeries: 'Standalone',
    dateCol: 'Date',
    titleCol: 'Title',
    noArticles: 'Nothing published yet.',
    readArticle: 'Read the article →',
    expand: (t) => `Expand “${t}”`,
    collapse: (t) => `Collapse “${t}”`,
    referencesTitle: 'References',
    backToCall: (n) => `Back to note call ${n}`,
    note: (n) => `Note ${n}`,
    workshopNote: (n) => `Workshop note ${n}`,
    toDecide: 'To settle',
    close: 'Close',
    notes: 'Notes',
    verdicts: {
      converge: 'Converges',
      nuance: 'Converges, with caveats',
      open: 'Open, to be tested',
      fails: 'Doesn’t hold',
      caption: 'The assessment, idea by idea',
      distribution: 'Breakdown of verdicts',
      head: ['What I worked out', 'What already existed', 'Verdict'],
    },
    figureLabel: (n) => `Fig. ${n}`,
    figures: {
      loop: {
        title: 'The body–brain loop and the lag it predicts',
        brain: 'BRAIN',
        body: 'BODY',
        sends: 'processes and sends',
        returns: 'holds and sends back',
        relief: 'relief',
        head: 'HEAD',
        gut: 'GUT',
        lag: 'measurable lag',
        time: 'time →',
        desc: 'Top: the brain processes and sends to the body; the body holds and sends back to the brain. Bottom: two activation curves after a moment of relief — the head comes down first, the gut later; the gap between them is the measurable lag.',
        legend: 'The loop, and what it predicts: after real relief, the head lets go first and the gut follows. A diagram drawn from the text, not a measurement.',
      },
      cascade: {
        title: 'The inner cascade of that Saturday morning',
        desc: 'A horizontal line stands for the threshold of consciousness. Below it, a shift in the light, a disposition and then an urge to go out follow one another, fed along the way by a memory and a bodily state. Only the last step crosses the threshold: the decision “I’m going out, Gare de Lyon”, lived as a choice.',
        legend: 'That Saturday morning as I picture it: several influences combine below the threshold, and I only experience the last one, as a decision. A diagram drawn from the text, not a measurement.',
        conscious: 'CONSCIOUS',
        unconscious: 'NOT CONSCIOUS',
        light: 'a shift in the light',
        mood: 'a disposition',
        urge: 'an urge to go out',
        memory: 'a memory?',
        bodyState: 'a bodily state?',
        lived: 'WHAT I EXPERIENCE',
        decision: '“I’m going out, Gare de Lyon”',
        unseen: 'what may have happened, unseen',
      },
      bridge: {
        title: 'Master, slave or bridge',
        desc: 'Three ways of placing consciousness above unconscious mechanisms. Master: it sends orders down to them. Slave: it only receives what rises from them. Bridge: the flow enters consciousness, is linked there, and goes back out to the mechanisms.',
        legend: 'Three possible places for consciousness. The one I keep: a passage that receives, links and sends back to what produced it. A diagram drawn from the text, not a measurement.',
        master: 'MASTER',
        slave: 'SLAVE',
        bridge: 'BRIDGE',
        consciousness: 'consciousness',
        mechanisms: 'unconscious mechanisms',
        commands: 'it runs everything',
        watches: 'it watches things go by',
        links: 'it links and sends back',
      },
    },
    journalHome: 'Journal — home',
    dateLocale: 'en-GB',
  },
  ru: {
    siteName: 'Журнал Александра Матенсио',
    siteDescription:
      'Журнал Александра Матенсио: длинные тексты с источниками — о коллекционных рынках, о сознании и о том, что об этом говорят исследования.',
    feedTitle: 'Журнал Александра Матенсио',
    back: 'Назад',
    language: 'Язык',
    allArticles: 'Все статьи',
    minutes: (n) => `${n} мин чтения`,
    references: (n) => `${n} ${ru(n, 'источник', 'источника', 'источников')}`,
    articles: (n) => `${n} ${ru(n, 'статья', 'статьи', 'статей')}`,
    part: (n) => `Часть ${n}`,
    series: 'Серия',
    seriesHeading: 'Серии',
    seriesKicker: 'Журнал · Серия',
    seriesPage: 'Страница серии',
    seriesNav: (t) => `Серия «${t}»`,
    seriesLine: (t, n) => `Серия · ${t} · ${n} ${ru(n, 'статья', 'статьи', 'статей')}`,
    seriesFallback: (t, n, titles, author) =>
      `${t}: серия из ${n} ${ru(n, 'статьи', 'статей', 'статей')} — автор ${author}. ${titles}.`,
    filters: 'Фильтры',
    filterBySeries: 'Фильтр по серии',
    seriesHint: 'СЕРИЯ',
    all: 'Все',
    noSeries: 'Вне серий',
    dateCol: 'Дата',
    titleCol: 'Заголовок',
    noArticles: 'Пока ничего не опубликовано.',
    readArticle: 'Читать статью →',
    expand: (t) => `Развернуть «${t}»`,
    collapse: (t) => `Свернуть «${t}»`,
    referencesTitle: 'Источники',
    backToCall: (n) => `Вернуться к сноске ${n}`,
    note: (n) => `Сноска ${n}`,
    workshopNote: (n) => `Рабочая заметка ${n}`,
    toDecide: 'Решить',
    close: 'Закрыть',
    notes: 'Сноски',
    verdicts: {
      converge: 'Сходится',
      nuance: 'Сходится с оговоркой',
      open: 'Открыто, проверить',
      fails: 'Не держится',
      caption: 'Итог по каждой идее',
      distribution: 'Распределение вердиктов',
      head: ['Что я вывел', 'Что уже было', 'Вердикт'],
    },
    figureLabel: (n) => `Рис. ${n}`,
    figures: {
      loop: {
        title: 'Петля «тело — мозг» и задержка, которую она предсказывает',
        brain: 'МОЗГ',
        body: 'ТЕЛО',
        sends: 'обрабатывает и посылает',
        returns: 'держит и возвращает',
        relief: 'облегчение',
        head: 'ГОЛОВА',
        gut: 'ЖИВОТ',
        lag: 'измеримая задержка',
        time: 'время →',
        desc: 'Вверху: мозг обрабатывает сигнал и посылает его телу, тело держит и возвращает его мозгу. Внизу: две кривые активации после облегчения — голова успокаивается первой, живот позже; разрыв между ними и есть измеримая задержка.',
        legend: 'Петля и то, что она предсказывает: после настоящего облегчения первой отпускает голова, живот — следом. Схема по тексту, а не измерение.',
      },
      cascade: {
        title: 'Внутренний каскад того субботнего утра',
        desc: 'Горизонтальная линия обозначает порог сознания. Под ней друг за другом идут перемена света, настрой и желание выйти, по пути их подпитывают воспоминание и состояние тела. Порог пересекает только последний шаг: решение «Иду гулять, к Лионскому вокзалу», пережитое как выбор.',
        legend: 'То субботнее утро, каким я его себе представляю: под порогом складываются несколько влияний, а я переживаю только последнее — как решение. Схема по тексту, а не измерение.',
        conscious: 'ОСОЗНАННОЕ',
        unconscious: 'НЕОСОЗНАННОЕ',
        light: 'перемена света',
        mood: 'настрой',
        urge: 'желание выйти',
        memory: 'воспоминание?',
        bodyState: 'состояние тела?',
        lived: 'ЧТО Я ПЕРЕЖИВАЮ',
        decision: '«Иду гулять, к Лионскому вокзалу»',
        unseen: 'что могло произойти незаметно',
      },
      bridge: {
        title: 'Хозяин, раб или мост',
        desc: 'Три способа поместить сознание над бессознательными механизмами. Хозяин: оно отдаёт им приказы. Раб: оно лишь получает то, что поднимается от них. Мост: поток входит в сознание, связывается там и возвращается к механизмам.',
        legend: 'Три возможных места для сознания. Я выбираю одно: проход, который принимает, связывает и возвращает туда, откуда всё пришло. Схема по тексту, а не измерение.',
        master: 'ХОЗЯИН',
        slave: 'РАБ',
        bridge: 'МОСТ',
        consciousness: 'сознание',
        mechanisms: 'бессознательные механизмы',
        commands: 'оно всем управляет',
        watches: 'оно наблюдает со стороны',
        links: 'оно связывает и возвращает',
      },
    },
    journalHome: 'Журнал — главная',
    dateLocale: 'ru-RU',
  },
};

/** Guillemets d'une citation en exergue, selon la langue. */
export function quoteMarks(lang: Lang): [string, string] {
  if (lang === 'fr') return ['« ', ' »'];
  if (lang === 'ru') return ['«', '»'];
  return ['“', '”'];
}

/** Le séparateur « sujet : verdict » des intertitres (cf. `ArticleH2`). */
export function headingSeparator(lang: Lang): string {
  return lang === 'fr' ? ' : ' : ': ';
}
