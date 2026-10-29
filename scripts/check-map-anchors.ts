/**
 * Assertions sur les ancres de paragraphe `#p-<clé>` (phase 1 de la Concept
 * Map, docs/superpowers/plans/2026-10-28-journal-map.md).
 *
 *   npm run check-map-anchors
 *
 * 1. Cas fabriqués pour `reuseKeys` (lib/journal/stableKeys.ts) : un
 *    réimport après insertion, retouche, suppression ou déplacement ne fait
 *    bouger aucune clé qui pouvait rester.
 * 2. Les VRAIS articles du dataset (lecture publique, sans jeton) :
 *    - réimporter un article tel quel garde toutes ses clés ;
 *    - chaque traduction porte les clés de son article français, bloc pour
 *      bloc — sinon un lien `#p-…` partagé en français tomberait dans le
 *      vide en anglais ou en russe (`align-translation-keys` répare).
 * 3. La garde de la phase 3 (lib/journal/mapAnchors.ts) : recalage d'une
 *    ancre par sa citation, replis intertitre puis article, `covers`
 *    recalculés, clés manquantes dans une traduction.
 */
import { createClient } from '@sanity/client';
import assert from 'node:assert/strict';
import { reuseKeys, type KeyedBlock } from '../lib/journal/stableKeys';
import { missingKeys, resolveAnchor, resolveArticleTheses, type MapBlock } from '../lib/journal/mapAnchors';

let passed = 0;
const ok = (label: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✓ ${label}`);
};

const p = (key: string, text: string): KeyedBlock => ({ _key: key, _type: 'block', style: 'normal', children: [{ text }] });
const h2 = (key: string, text: string): KeyedBlock => ({ _key: key, _type: 'block', style: 'h2', children: [{ text }] });
const keys = (bs: KeyedBlock[]) => bs.map((b) => b._key);

function fabricated() {
  console.log('\nCas fabriqués');
  const before = [h2('a', 'Titre'), p('b', 'Un.'), p('c', 'Deux.'), p('d', 'Trois.')];

  ok('réimport identique → mêmes clés', () =>
    assert.deepEqual(keys(reuseKeys([h2('n1', 'Titre'), p('n2', 'Un.'), p('n3', 'Deux.'), p('n4', 'Trois.')], before)), ['a', 'b', 'c', 'd']));

  ok('paragraphe inséré en tête → les autres gardent la leur, le neuf garde la sienne', () =>
    assert.deepEqual(
      keys(reuseKeys([p('new', 'Zéro.'), h2('n1', 'Titre'), p('n2', 'Un.'), p('n3', 'Deux.'), p('n4', 'Trois.')], before)),
      ['new', 'a', 'b', 'c', 'd'],
    ));

  ok('paragraphe retouché sur place → garde sa clé', () =>
    assert.deepEqual(keys(reuseKeys([h2('n1', 'Titre'), p('n2', 'Un.'), p('n3', 'Deux, retouché.'), p('n4', 'Trois.')], before)), ['a', 'b', 'c', 'd']));

  ok('paragraphe supprimé → les suivants gardent la leur', () =>
    assert.deepEqual(keys(reuseKeys([h2('n1', 'Titre'), p('n2', 'Un.'), p('n4', 'Trois.')], before)), ['a', 'b', 'd']));

  ok('paragraphes permutés → chacun suit son texte', () =>
    assert.deepEqual(keys(reuseKeys([h2('n1', 'Titre'), p('n4', 'Trois.'), p('n2', 'Un.'), p('n3', 'Deux.')], before)), ['a', 'd', 'b', 'c']));

  ok('deux paragraphes identiques → deux clés distinctes', () => {
    const twins = [p('x', 'Même.'), p('y', 'Même.')];
    assert.deepEqual(keys(reuseKeys([p('n1', 'Même.'), p('n2', 'Même.')], twins)), ['x', 'y']);
  });

  ok('un intertitre ne prend jamais la clé d’un paragraphe', () =>
    assert.deepEqual(keys(reuseKeys([h2('n1', 'Un.')], [p('b', 'Un.')])), ['n1']));

  ok('article neuf → clés neuves', () => assert.deepEqual(keys(reuseKeys([p('n1', 'Un.')], [])), ['n1']));
}

type Post = { _id: string; language?: string; slug?: string; src?: string; body?: KeyedBlock[] };

async function realPosts() {
  const client = createClient({ projectId: 'yh5i5diw', dataset: 'production', apiVersion: '2026-01-01', useCdn: false });
  const posts = await client.fetch<Post[]>(
    `*[_type == "post" && !(_id in path("drafts.**"))]{ _id, language, "slug": slug.current, "src": translationOf._ref, body }`,
  );
  const fr = posts.filter((x) => !x.src);
  console.log(`\nDataset : ${fr.length} articles français, ${posts.length - fr.length} traductions`);

  for (const post of fr) {
    ok(`${post.slug} : réimport tel quel → mêmes clés`, () => {
      const body = post.body ?? [];
      const fresh = body.map((b, i) => ({ ...b, _key: `neuf${i}` }));
      assert.deepEqual(keys(reuseKeys(fresh, body)), keys(body));
    });
  }

  const byId = new Map(fr.map((x) => [x._id, x]));
  for (const t of posts.filter((x) => x.src)) {
    const source = byId.get(t.src!);
    if (!source) continue;
    ok(`${t.slug} (${t.language}) : clés de ${source.slug}`, () =>
      assert.deepEqual(keys(t.body ?? []), keys(source.body ?? []), 'clés différentes du français : npm run align-translation-keys'),
    );
  }
}

function guard() {
  console.log('\nGarde des ancres (phase 3)');
  const b = (...bs: KeyedBlock[]) => bs.map((x) => ({ ...x, children: x.children?.map((c) => ({ _type: 'span', ...c })) })) as MapBlock[];
  const body = b(p('a', 'Intro. Le chat chaud fait le chart chaud.'), h2('s1', 'Argent : ça paie'), p('b', 'Les commus paient déjà.'), p('c', 'Le reste suit.'));
  const t1 = { quote: 'le chat chaud fait le chart chaud.', anchor: 'a', section: null };
  const t2 = { quote: 'Les commus paient déjà', anchor: 'b', section: 's1' };

  ok('ancre intacte → ok (casse, point final, apostrophes ignorés)', () => assert.equal(resolveAnchor(t1, body).status, 'ok'));
  ok('paragraphe scindé : la citation passe sous une clé neuve → recalée', () => {
    const split = b(p('a', 'Intro.'), p('n1', 'Le chat chaud fait le chart chaud.'), h2('s1', 'Argent'), p('b', 'Les commus paient déjà.'));
    assert.deepEqual(resolveAnchor(t1, split), { status: 'moved', target: { kind: 'paragraph', key: 'n1' } });
  });
  ok('citation réécrite, paragraphe toujours là → lien gardé, dérive signalée', () => {
    const r = resolveAnchor(t2, b(h2('s1', 'Argent'), p('b', 'Les communautés paient.')));
    assert.deepEqual(r, { status: 'reworded', target: { kind: 'paragraph', key: 'b' } });
  });
  ok('paragraphe disparu → intertitre de repli', () =>
    assert.deepEqual(resolveAnchor(t2, b(h2('s1', 'Argent'), p('z', 'Autre chose.'))), { status: 'section', target: { kind: 'section', key: 's1' } }));
  ok('intertitre disparu aussi → article', () =>
    assert.deepEqual(resolveAnchor(t2, b(p('z', 'Autre chose.'))), { status: 'article', target: { kind: 'article', key: null } }));
  ok('covers recalculés sur le texte du moment', () => {
    const r = resolveArticleTheses([t1, t2], body);
    assert.deepEqual(r.map((x) => x.covers), [['a'], ['b', 'c']]);
    const inserted = b(p('a', 'Intro. Le chat chaud fait le chart chaud.'), p('new', 'Ajout.'), h2('s1', 'Argent'), p('b', 'Les commus paient déjà.'));
    assert.deepEqual(resolveArticleTheses([t1, t2], inserted).map((x) => x.covers), [['a', 'new'], ['b']]);
  });
  ok('une thèse en dérive ne couvre rien, la précédente s’étend', () => {
    const r = resolveArticleTheses([t1, t2], b(p('a', 'Intro. Le chat chaud fait le chart chaud.'), p('c', 'Le reste suit.')));
    assert.deepEqual(r.map((x) => [x.status, x.covers]), [['ok', ['a', 'c']], ['article', []]]);
  });
  ok('clés absentes d’une traduction', () => assert.deepEqual(missingKeys(['a', 'b', 'b'], b(p('a', 'x'))), ['b']));
}

fabricated();
guard();
realPosts()
  .then(() => console.log(`\n${passed} assertions vertes.`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
