/**
 * Assertions sur l'aller-retour article ⇄ unités de traduction
 * (`lib/journal/translate/`).
 *
 *   npm run check-translate-markup
 *
 * Deux étages :
 * 1. Les VRAIS articles français du dataset (lecture publique, sans jeton) :
 *    extraire puis réappliquer les unités SANS les traduire doit rendre
 *    chaque article à l'identique — texte, marques, objets en ligne, blocs.
 *    C'est ce qui prouve qu'aucune construction réelle n'est perdue en route.
 * 2. Des cas fabriqués pour ce que le modèle peut rendre de travers :
 *    appel déplacé (accepté), perdu, doublé, inventé, balise non fermée.
 * 3. La traduction incrémentale (`incremental.ts`), sur les vrais articles :
 *    rien de changé → rien à traduire ; une phrase, un titre ou une
 *    description changés → cette unité seule, avec son ancienne version.
 */
import { createClient } from '@sanity/client';
import assert from 'node:assert/strict';
import { parseMarkup, blockToMarkup, type PTBlock } from '../lib/journal/translate/markup';
import { applyUnits, extractUnits, localizeImages, type SourcePost } from '../lib/journal/translate/units';
import { canonical, planUnits, readSnapshot, snapshotOf } from '../lib/journal/translate/incremental';

let passed = 0;
const ok = (label: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✓ ${label}`);
};

/** Ce qui se voit d'un bloc : spans fusionnés par marques, objets en ligne par clé. */
function visible(children: PTBlock['children']) {
  const out: string[] = [];
  for (const c of children) {
    if (c._type === 'span') {
      const marks = [...((c as { marks?: string[] }).marks ?? [])].filter((m) => ['strong', 'em', 'cite', 'highlight'].includes(m)).sort().join('+');
      const text = (c as { text: string }).text;
      if (!text) continue;
      const last = out[out.length - 1];
      if (last?.startsWith(`[${marks}]`)) out[out.length - 1] = last + text;
      else out.push(`[${marks}]${text}`);
    } else out.push(JSON.stringify(c));
  }
  return out;
}

async function realPosts() {
  const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? 'yh5i5diw',
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
    apiVersion: '2026-01-01',
    useCdn: false,
  });
  const posts = await client.fetch<SourcePost[]>(
    `*[_type == "post" && (!defined(language) || language == "fr")]{_id, title, dek, seoTitle, seoDescription, referencesNote, body, references}`,
  );
  console.log(`Étage 1 — ${posts.length} articles français du dataset`);
  for (const post of posts) {
    ok(post._id, () => {
      const units = extractUnits(post);
      const back = applyUnits(post, units);
      assert.equal(back.title, post.title);
      assert.equal(back.body.length, post.body?.length ?? 0);
      (post.body ?? []).forEach((b, i) => {
        const r = back.body[i];
        assert.equal(r._key, b._key);
        assert.equal(r._type, b._type);
        if (b._type === 'block') assert.deepEqual(visible((r as unknown as PTBlock).children), visible((b as unknown as PTBlock).children), `bloc ${b._key}`);
        else assert.deepEqual(r, b, `bloc ${b._key}`);
      });
      (post.references ?? []).forEach((ref, i) => {
        const r = back.references![i];
        assert.equal(r._key, ref._key);
        (ref.citation ?? []).forEach((c, j) => assert.deepEqual(visible(r.citation![j].children), visible(c.children)));
      });
    });
  }
  return posts;
}

function fabricated() {
  console.log('Étage 2 — réponses du modèle');
  const block: PTBlock = {
    _type: 'block',
    _key: 'b1',
    style: 'normal',
    markDefs: [],
    children: [
      { _type: 'span', _key: 's1', text: 'Je l’ai lu dans ', marks: [] },
      { _type: 'span', _key: 's2', text: 'Le Corps', marks: ['cite'] },
      { _type: 'span', _key: 's3', text: ' & ', marks: [] },
      { _type: 'span', _key: 's4', text: 'surtout', marks: ['em', 'strong'] },
      { _type: 'journalNoteRef', _key: 'n1', refKey: 'damasio' },
      { _type: 'span', _key: 's5', text: ' <oublié>.', marks: ['em'] },
      { _type: 'journalDraftNote', _key: 'd1', text: 'à vérifier' },
    ],
  };
  const markup = blockToMarkup(block);
  ok('aller : marques imbriquées, échappement, objets en ligne', () =>
    assert.equal(markup, 'Je l’ai lu dans <cite>Le Corps</cite> &amp; <b><i>surtout</i></b><ref id="n1"/><i> &lt;oublié&gt;.</i><note id="d1"/>'),
  );
  ok('retour identique', () => assert.deepEqual(visible(parseMarkup(markup, block)), visible(block.children)));
  ok('appel déplacé : accepté, objet recopié tel quel', () => {
    const c = parseMarkup('<ref id="n1"/>I read it in <cite>The Body</cite> &amp; <b><i>above all</i></b><i> &lt;forgot&gt;.</i><note id="d1"/>', block);
    assert.deepEqual(c[0], { _type: 'journalNoteRef', _key: 'n1', refKey: 'damasio' });
  });
  ok('appel perdu : refusé', () => assert.throws(() => parseMarkup('I read it.<note id="d1"/>', block), /perdu/));
  ok('appel doublé : refusé', () => assert.throws(() => parseMarkup('<ref id="n1"/><ref id="n1"/><note id="d1"/>', block), /doublé/));
  ok('appel inventé : refusé', () => assert.throws(() => parseMarkup('<ref id="n1"/><ref id="n9"/><note id="d1"/>', block), /inventé/));
  ok('note prise pour un appel : refusée', () => assert.throws(() => parseMarkup('<ref id="d1"/><ref id="n1"/>', block), /inventé/));
  ok('balise non fermée : refusée', () => assert.throws(() => parseMarkup('<i>x<ref id="n1"/><note id="d1"/>', block), /jamais fermée/));
  ok('balise croisée : refusée', () => assert.throws(() => parseMarkup('<b><i>x</b></i><ref id="n1"/><note id="d1"/>', block), /mal fermée/));
  ok('surligné : <mark> à l’extérieur, retour identique', () => {
    const hl: PTBlock = {
      _type: 'block',
      _key: 'b2',
      style: 'normal',
      markDefs: [],
      children: [
        { _type: 'span', _key: 's1', text: 'Avant. ', marks: [] },
        { _type: 'span', _key: 's2', text: 'La phrase ', marks: ['highlight'] },
        { _type: 'span', _key: 's3', text: 'clé', marks: ['highlight', 'em'] },
        { _type: 'span', _key: 's4', text: '.', marks: ['highlight'] },
      ],
    };
    const m = blockToMarkup(hl);
    assert.equal(m, 'Avant. <mark>La phrase <i>clé</i>.</mark>');
    assert.deepEqual(visible(parseMarkup(m, hl)), visible(hl.children));
  });
  ok('balise inconnue : refusée', () => assert.throws(() => parseMarkup('<u>x</u><ref id="n1"/><note id="d1"/>', block), /inconnue/));
  const linkBlock: PTBlock = {
    _type: 'block',
    _key: 'b2',
    style: 'normal',
    markDefs: [{ _type: 'journalLink', _key: 'l1', article: { _type: 'reference', _ref: 'post-x' } }],
    children: [
      { _type: 'span', _key: 's1', text: 'Voir ', marks: [] },
      { _type: 'span', _key: 's2', text: 'le ', marks: ['l1'] },
      { _type: 'span', _key: 's3', text: 'DEVP', marks: ['l1', 'strong'] },
      { _type: 'span', _key: 's4', text: '.', marks: [] },
    ],
  };
  const linkMarkup = blockToMarkup(linkBlock);
  ok('lien : aller, décorateur imbriqué dans le lien', () => assert.equal(linkMarkup, 'Voir <a id="l1">le <b>DEVP</b></a>.'));
  ok('lien : retour avec la clé de la définition', () => {
    const c = parseMarkup('See <a id="l1">the <b>DEVP</b></a>.', linkBlock);
    assert.deepEqual(c.map((x) => (x as { marks?: string[] }).marks), [[], ['l1'], ['l1', 'strong'], []]);
  });
  ok('lien perdu : refusé', () => assert.throws(() => parseMarkup('See the DEVP.', linkBlock), /Lien\(s\) perdu/));
  ok('lien inventé : refusé', () => assert.throws(() => parseMarkup('See <a id="l9">the DEVP</a>.', linkBlock), /inventé/));
  ok('lien non fermé : refusé', () => assert.throws(() => parseMarkup('See <a id="l1">the DEVP.', linkBlock), /jamais fermée/));
  ok('unité manquante : refusée', () =>
    assert.throws(() => applyUnits({ _id: 'p', title: 'T', dek: 'D', body: [] }, [{ id: 'title', text: 'T' }]), /dek/),
  );
  const img = (ref: string) => ({ _type: 'image', asset: { _type: 'reference', _ref: ref } });
  const figure = { _key: 'i1', _type: 'journalImage', image: img('fr'), imageEn: img('en'), imageRu: img('ru'), alt: 'a' };
  const plain = { _key: 'i2', _type: 'journalImage', image: img('photo'), alt: 'b' };
  ok('image traduite : prise dans sa langue, les autres versions retirées', () => {
    assert.deepEqual(localizeImages([figure, plain], 'ru'), [
      { _key: 'i1', _type: 'journalImage', image: img('ru'), alt: 'a' },
      plain,
    ]);
  });
  ok('image sans version dans la langue : la française reste', () => {
    const { imageEn: _en, ...ruOnly } = figure;
    assert.deepEqual(localizeImages([ruOnly], 'en'), [{ _key: 'i1', _type: 'journalImage', image: img('fr'), alt: 'a' }]);
  });
}

function incremental(posts: SourcePost[]) {
  console.log('Étage 3 — traduction incrémentale');
  for (const post of posts) {
    // La « traduction » est l'article lui-même : on ne teste que le plan, pas la langue.
    const snapshot = readSnapshot(JSON.stringify(snapshotOf(post)));
    const total = extractUnits(post).length;
    ok(`${post._id} : rien de changé → 0 unité à traduire`, () => {
      const plan = planUnits(post, post, snapshot);
      assert.equal(plan.pending.length, 0);
      assert.equal(plan.reused.size, total);
      const rebuilt = applyUnits(post, [...plan.reused].map(([id, text]) => ({ id, text })));
      assert.equal(canonical(rebuilt.body), canonical(applyUnits(post, extractUnits(post)).body));
    });
    ok(`${post._id} : premier passage (sans source) → tout à traduire`, () =>
      assert.equal(planUnits(post, post, null).pending.length, total),
    );
    ok(`${post._id} : --full → tout à traduire, sans ancienne version`, () => {
      const plan = planUnits(post, post, snapshot, true);
      assert.equal(plan.pending.length, total);
      assert.ok(plan.pending.every((u) => u.previousSource === undefined));
    });

    const paragraph = (post.body ?? []).find((b) => b._type === 'block' && extractUnits({ _id: 'x', body: [b] }).length);
    if (paragraph) {
      ok(`${post._id} : une phrase changée → ce paragraphe seul, avec son ancienne version`, () => {
        const edited = structuredClone(post);
        const block = edited.body!.find((b) => b._key === paragraph._key) as unknown as PTBlock;
        const span = block.children.find((c) => c._type === 'span') as { text: string };
        span.text += ' Phrase ajoutée.';
        const plan = planUnits(edited, post, snapshot);
        assert.deepEqual(plan.pending.map((u) => u.id), [`body.${paragraph._key}`]);
        assert.equal(plan.pending[0].previousSource, snapshot![`body.${paragraph._key}`]);
        assert.ok(plan.pending[0].previousTranslation);
        assert.equal(plan.reused.size, total - 1);
      });
    }
    ok(`${post._id} : titre et description Google changés → ces deux champs seuls`, () => {
      const edited = { ...post, title: `${post.title} (bis)`, seoDescription: 'Une description neuve.' };
      const plan = planUnits(edited, post, snapshot);
      assert.deepEqual(plan.pending.map((u) => u.id).sort(), ['seoDescription', 'title']);
      // Sans description d'origine, il n'y a pas d'ancienne version à reprendre.
      assert.equal(plan.pending.find((u) => u.id === 'seoDescription')!.previousSource, post.seoDescription?.trim() ? post.seoDescription : undefined);
    });
    ok(`${post._id} : bloc supprimé → disparaît, rien à traduire`, () => {
      const edited = { ...post, body: (post.body ?? []).slice(1) };
      const plan = planUnits(edited, post, snapshot);
      assert.equal(plan.pending.length, 0);
      assert.equal(applyUnits(edited, [...plan.reused].map(([id, text]) => ({ id, text }))).body.length, edited.body.length);
    });
  }
  ok('retouche manuelle de la traduction conservée', () => {
    const fr: SourcePost = { _id: 'p', title: 'Titre', dek: 'Sous-titre', body: [] };
    const en: SourcePost = { _id: 'p-en', title: 'Title, revised by hand', dek: 'Subtitle', body: [] };
    const plan = planUnits(fr, en, snapshotOf(fr));
    assert.equal(plan.reused.get('title'), 'Title, revised by hand');
  });
  ok('unité absente de la traduction → retraduite même si le français n’a pas bougé', () => {
    const fr: SourcePost = { _id: 'p', title: 'Titre', dek: 'Sous-titre', body: [] };
    const plan = planUnits(fr, { _id: 'p-en', title: 'Title', body: [] }, snapshotOf(fr));
    assert.deepEqual(plan.pending.map((u) => u.id), ['dek']);
    assert.equal(plan.pending[0].previousTranslation, undefined);
  });
  ok('source illisible → tout traduire', () => assert.equal(readSnapshot('{pas du json'), null));
}

realPosts()
  .then((posts) => {
    fabricated();
    incremental(posts);
    console.log(`\n${passed} assertions vertes.`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
