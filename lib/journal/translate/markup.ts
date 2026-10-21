/**
 * UN BLOC DE PORTABLE TEXT ⇄ UNE LIGNE BALISÉE — ce que le traducteur lit et
 * rend (2026-10-18, voir `scripts/translate-post.ts`).
 *
 * Traduire span par span casserait les phrases : une emphase, un titre
 * d'œuvre ou un appel de référence coupent une phrase en trois morceaux qui
 * ne se traduisent pas séparément. Le bloc part donc en UNE chaîne, ses
 * marques en balises :
 *
 *   « Je l'ai lu dans <cite>Le Corps</cite> <ref id="k3"/>, puis <i>oublié</i>. »
 *
 * - `<b>`, `<i>`, `<cite>` : les trois décorateurs du schéma (strong, em, cite).
 * - `<a id="…">…</a>` : un lien (annotation `journalLink`), désigné par la
 *   `_key` de sa définition. Le lien lui-même (article, adresse) reste dans
 *   les `markDefs` du bloc, recopiés tels quels : le modèle ne déplace que
 *   les mots qu'il couvre.
 * - `<ref id="…"/>`, `<note id="…"/>` : les objets EN LIGNE (appel de
 *   référence, note à trancher), désignés par leur `_key`. Au retour, l'objet
 *   d'origine est recopié tel quel : la clé de la référence appelée ne passe
 *   jamais par le modèle, elle ne peut pas être traduite ni inventée.
 *
 * `parseMarkup` REFUSE (exception) une ligne qui perd, double ou invente un
 * objet en ligne, ou dont les balises ne ferment pas : mieux vaut relancer la
 * traduction que publier un appel de note mort.
 *
 * Aucune dépendance : vérifié par `npm run check-translate-markup`.
 */

export type PTSpan = { _type: 'span'; _key: string; text: string; marks?: string[] };
export type PTInline = { _type: string; _key: string; [field: string]: unknown };
export type PTBlock = {
  _type: 'block';
  _key: string;
  style?: string;
  markDefs?: unknown[];
  children: (PTSpan | PTInline)[];
  [field: string]: unknown;
};

/** Décorateur du schéma → balise. L'ordre fixe l'imbrication à l'aller. */
const TAGS: Record<string, string> = { strong: 'b', em: 'i', cite: 'cite' };
const MARKS: Record<string, string> = Object.fromEntries(Object.entries(TAGS).map(([m, t]) => [t, m]));

/** Les clés des liens d'un bloc (annotations `journalLink`). */
function linkKeys(block: PTBlock): Set<string> {
  return new Set(
    ((block.markDefs ?? []) as { _key?: string; _type?: string }[])
      .filter((d) => d._type === 'journalLink' && d._key)
      .map((d) => d._key!),
  );
}

/** Balise ouverte : `b`, `i`, `cite`, ou `a:<clé>` pour un lien. */
const openTag = (t: string) => (t.startsWith('a:') ? `<a id="${t.slice(2)}">` : `<${t}>`);
const closeTag = (t: string) => (t.startsWith('a:') ? '</a>' : `</${t}>`);

/** Objet en ligne du schéma → balise vide. */
const INLINE_TAGS: Record<string, string> = { journalNoteRef: 'ref', journalDraftNote: 'note' };

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const isSpan = (c: PTSpan | PTInline): c is PTSpan => c._type === 'span';

/** Le bloc en une ligne balisée. Les marques inconnues du schéma sont ignorées. */
export function blockToMarkup(block: PTBlock): string {
  let out = '';
  const open: string[] = []; // balises ouvertes, de l'extérieur vers l'intérieur
  const links = linkKeys(block);

  const closeTo = (depth: number) => {
    while (open.length > depth) out += closeTag(open.pop()!);
  };

  for (const child of block.children ?? []) {
    if (!isSpan(child)) {
      const tag = INLINE_TAGS[child._type];
      if (!tag) throw new Error(`Objet en ligne inconnu « ${child._type} » dans le bloc ${block._key}`);
      closeTo(0); // un objet en ligne ne porte aucune marque
      out +=`<${tag} id="${child._key}"/>`;
      continue;
    }
    // Le lien d'abord : il enveloppe les décorateurs.
    const wanted = [
      ...(child.marks ?? []).filter((m) => links.has(m)).map((k) => `a:${k}`),
      ...Object.keys(TAGS)
        .filter((m) => child.marks?.includes(m))
        .map((m) => TAGS[m]),
    ];
    // Garde le plus long préfixe commun déjà ouvert, ferme le reste, ouvre ce qui manque.
    let keep = 0;
    while (keep < open.length && wanted.includes(open[keep])) keep++;
    closeTo(keep);
    for (const tag of wanted) {
      if (!open.includes(tag)) {
        out += openTag(tag);
        open.push(tag);
      }
    }
    out += escape(child.text ?? '');
  }
  closeTo(0);
  return out;
}

/** Les `_key` des objets en ligne d'un bloc, dans l'ordre. */
export function inlineKeys(block: PTBlock): string[] {
  return (block.children ?? []).filter((c) => !isSpan(c)).map((c) => c._key);
}

const TOKEN = /<\/?(b|i|cite)>|<(ref|note) id="([^"]+)"\s*\/>|<a id="([^"]+)">|(<\/a>)|<[^>]*>/g;

/**
 * Une ligne balisée → les `children` d'un bloc. `original` fournit les objets
 * en ligne à recopier et le préfixe des clés de spans (déterministes : une
 * régénération ne réécrit que ce qui change vraiment).
 */
export function parseMarkup(markup: string, original: PTBlock): (PTSpan | PTInline)[] {
  const inlines = new Map(
    (original.children ?? []).filter((c) => !isSpan(c)).map((c) => [c._key, c as PTInline]),
  );
  const seen = new Set<string>();
  const links = linkKeys(original);
  const linked = new Set<string>();
  const children: (PTSpan | PTInline)[] = [];
  const stack: string[] = [];
  let n = 0;

  const pushText = (raw: string) => {
    if (!raw) return;
    const text = unescape(raw);
    const marks = stack.map((t) => (t.startsWith('a:') ? t.slice(2) : MARKS[t]));
    const last = children[children.length - 1];
    if (last && isSpan(last) && sameMarks(last.marks ?? [], marks)) {
      last.text += text;
      return;
    }
    children.push({ _type: 'span', _key: `${original._key}s${n++}`, text, marks });
  };

  let cursor = 0;
  for (const m of markup.matchAll(TOKEN)) {
    pushText(markup.slice(cursor, m.index));
    cursor = m.index! + m[0].length;
    const [whole, mark, inlineTag, id, linkOpen, linkClose] = m;
    if (linkOpen) {
      if (!links.has(linkOpen)) throw new Error(`Lien inventé <a id="${linkOpen}"> dans le bloc ${original._key}`);
      if (stack.some((t) => t.startsWith('a:'))) throw new Error(`Lien dans un lien dans le bloc ${original._key}`);
      stack.push(`a:${linkOpen}`);
      linked.add(linkOpen);
    } else if (linkClose) {
      if (!stack[stack.length - 1]?.startsWith('a:')) throw new Error(`Balise </a> mal fermée dans le bloc ${original._key}`);
      stack.pop();
    } else if (mark) {
      if (whole.startsWith('</')) {
        if (stack[stack.length - 1] !== mark) throw new Error(`Balise </${mark}> mal fermée dans le bloc ${original._key}`);
        stack.pop();
      } else {
        if (stack.includes(mark)) throw new Error(`Balise <${mark}> ouverte deux fois dans le bloc ${original._key}`);
        stack.push(mark);
      }
    } else if (inlineTag) {
      const obj = inlines.get(id);
      if (!obj || INLINE_TAGS[obj._type] !== inlineTag) throw new Error(`Objet en ligne inventé <${inlineTag} id="${id}"/> dans le bloc ${original._key}`);
      if (seen.has(id)) throw new Error(`Objet en ligne « ${id} » doublé dans le bloc ${original._key}`);
      seen.add(id);
      children.push(obj);
    } else {
      throw new Error(`Balise inconnue ${whole} dans le bloc ${original._key}`);
    }
  }
  pushText(markup.slice(cursor));
  if (stack.length) throw new Error(`Balise ${openTag(stack[stack.length - 1])} jamais fermée dans le bloc ${original._key}`);
  const used = new Set((original.children ?? []).filter(isSpan).flatMap((c) => (c.marks ?? []).filter((k) => links.has(k))));
  const lostLinks = [...used].filter((k) => !linked.has(k));
  if (lostLinks.length) throw new Error(`Lien(s) perdu(s) dans le bloc ${original._key} : ${lostLinks.join(', ')}`);
  const lost = [...inlines.keys()].filter((k) => !seen.has(k));
  if (lost.length) throw new Error(`Objet(s) en ligne perdu(s) dans le bloc ${original._key} : ${lost.join(', ')}`);

  // Un bloc doit garder au moins un span (Portable Text l'exige).
  if (!children.some(isSpan)) children.push({ _type: 'span', _key: `${original._key}s${n}`, text: '', marks: [] });
  return children;
}

function sameMarks(a: string[], b: string[]) {
  return a.length === b.length && a.every((m) => b.includes(m));
}
