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
 */
import { createClient } from '@sanity/client';
import assert from 'node:assert/strict';
import { parseMarkup, blockToMarkup, type PTBlock } from '../lib/journal/translate/markup';
import { applyUnits, extractUnits, type SourcePost } from '../lib/journal/translate/units';

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
      const marks = [...((c as { marks?: string[] }).marks ?? [])].filter((m) => ['strong', 'em', 'cite'].includes(m)).sort().join('+');
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
  ok('balise inconnue : refusée', () => assert.throws(() => parseMarkup('<u>x</u><ref id="n1"/><note id="d1"/>', block), /inconnue/));
  ok('unité manquante : refusée', () =>
    assert.throws(() => applyUnits({ _id: 'p', title: 'T', dek: 'D', body: [] }, [{ id: 'title', text: 'T' }]), /dek/),
  );
}

realPosts()
  .then(() => {
    fabricated();
    console.log(`\n${passed} assertions vertes.`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
