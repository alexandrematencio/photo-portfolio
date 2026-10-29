/**
 * LA GARDE DES ANCRES DE LA CONCEPT MAP (phase 3,
 * docs/superpowers/plans/2026-10-28-journal-map.md).
 *
 * Un nœud de la carte pointe un paragraphe par son `_key`, et garde la
 * citation exacte qui l'y a placé. Entre deux exports, Alexandre retouche ses
 * articles dans le Studio : un paragraphe scindé change de clé, une phrase
 * reprise fait disparaître la citation. On recale ici, sans rien écrire :
 *
 *   ok        la clé existe et contient toujours la citation ;
 *   moved     la citation se retrouve dans un autre paragraphe → recalé ;
 *   reworded  citation introuvable, mais le paragraphe d'ancre existe encore
 *             → le lien reste bon, la citation est à reprendre ;
 *   section   paragraphe disparu → l'intertitre d'où il venait ;
 *   article   plus rien → l'article.
 *
 * Les trois derniers sont de la DÉRIVE : le Studio la signale (pastille sur
 * l'article, liste au Tableau de bord), le build ne s'arrête jamais dessus.
 *
 * Module pur, sans Node ni React : le même code tourne au build du site, dans
 * `map:check` et dans le Studio.
 */

export type MapBlock = {
  _key: string;
  _type: string;
  style?: string;
  children?: { _type: string; text?: string }[];
};

/** Ce qui ne doit pas empêcher une citation de se retrouver : espaces fines, apostrophes, point final. */
export const normalizeQuote = (s: string) =>
  s
    .normalize('NFC')
    .replace(/[   ]/g, ' ')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.…]+$/, '')
    .toLowerCase();

export const blockText = (b: MapBlock) =>
  (b.children ?? []).filter((c) => c._type === 'span').map((c) => c.text ?? '').join('');

const isParagraph = (b: MapBlock) => b._type === 'block' && (b.style ?? 'normal') === 'normal' && blockText(b).trim() !== '';
const isSection = (b: MapBlock) => b._type === 'block' && b.style === 'h2';

/** Les paragraphes d'un article dans l'ordre (ceux qui portent une ancre `#p-<clé>`), avec leur intertitre. */
export function mapParagraphs(body: MapBlock[] | undefined) {
  const out: { key: string; text: string; section: string | null }[] = [];
  let section: string | null = null;
  for (const b of body ?? []) {
    if (isSection(b)) section = b._key;
    else if (isParagraph(b)) out.push({ key: b._key, text: blockText(b), section });
  }
  return out;
}

export type AnchorStatus = 'ok' | 'moved' | 'reworded' | 'section' | 'article';
export const DRIFT: ReadonlySet<AnchorStatus> = new Set(['reworded', 'section', 'article']);

/** Ce qu'un nœud sait de son ancre au moment de l'export. */
export type StoredAnchor = { quote: string; anchor: string | null; section?: string | null };

export type Resolved = {
  status: AnchorStatus;
  /** Où mène le lien : un paragraphe (`#p-<clé>`), un intertitre (son bloc), ou l'article. */
  target: { kind: 'paragraph' | 'section'; key: string } | { kind: 'article'; key: null };
};

export function resolveAnchor(node: StoredAnchor, body: MapBlock[] | undefined): Resolved {
  const paras = mapParagraphs(body);
  const q = normalizeQuote(node.quote ?? '');
  const has = (p: { text: string }) => q !== '' && normalizeQuote(p.text).includes(q);
  const at = node.anchor ? paras.find((p) => p.key === node.anchor) : undefined;

  if (at && has(at)) return { status: 'ok', target: { kind: 'paragraph', key: at.key } };
  const found = paras.find(has);
  if (found) return { status: 'moved', target: { kind: 'paragraph', key: found.key } };
  if (at) return { status: 'reworded', target: { kind: 'paragraph', key: at.key } };
  if (node.section && (body ?? []).some((b) => b._key === node.section && isSection(b)))
    return { status: 'section', target: { kind: 'section', key: node.section } };
  return { status: 'article', target: { kind: 'article', key: null } };
}

/**
 * Les thèses d'UN article, dans l'ordre : chacune recalée, puis ses `covers`
 * recalculés sur le texte du moment — de son paragraphe jusqu'à celui de la
 * thèse suivante. Une thèse sans paragraphe ne couvre rien.
 */
export function resolveArticleTheses<T extends StoredAnchor>(theses: T[], body: MapBlock[] | undefined) {
  const paras = mapParagraphs(body);
  const index = new Map(paras.map((p, i) => [p.key, i]));
  const resolved = theses.map((t) => resolveAnchor(t, body));
  const starts = resolved.map((r) => (r.target.kind === 'paragraph' ? index.get(r.target.key)! : -1));
  return theses.map((t, k) => {
    const i = starts[k];
    const end = starts.slice(k + 1).find((x) => x > i) ?? paras.length;
    return { node: t, ...resolved[k], covers: i >= 0 ? paras.slice(i, end).map((p) => p.key) : [] };
  });
}

/** Clés de paragraphe pointées par la carte et absentes d'une traduction (régression du traducteur). */
export function missingKeys(keys: Iterable<string>, body: MapBlock[] | undefined) {
  const present = new Set((body ?? []).map((b) => b._key));
  return [...new Set(keys)].filter((k) => !present.has(k));
}

export const STATUS_LABEL: Record<AnchorStatus, string> = {
  ok: 'en place',
  moved: 'recalée sur un autre paragraphe',
  reworded: 'citation introuvable, paragraphe toujours là',
  section: 'paragraphe disparu, renvoie à l’intertitre',
  article: 'plus rien ne correspond, renvoie à l’article',
};
