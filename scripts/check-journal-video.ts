/**
 * Vérification du bloc « Vidéo YouTube » du journal (2026-11-14) :
 * - convert.ts ne laisse passer qu'un identifiant de 11 caractères sûrs
 *   (il finit dans une adresse d'iframe) ;
 * - le rendu ne contient JAMAIS d'iframe ni d'adresse youtube-nocookie.com :
 *   la page ne contacte pas YouTube (décision d'Alexandre, CSP `frame-src 'none'`) ;
 * - le clic ouvre youtube.com dans la langue de la page, nouvel onglet, sans référent.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { toArticle, type PTBlock, type RawPost } from '../lib/journal/convert';
import { ArticleVideo } from '../components/journal/ArticleVideo';

const post = (body: PTBlock[]) =>
  ({ slug: 's', lang: 'fr', group: 'g', title: 't', dek: 'd', date: '2026-11-14', publishedAt: '', seriesId: null, part: null, referencesNote: null, body, references: [] }) as unknown as RawPost & { date: string; lang: 'fr' };

let failed = 0;
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failed++;
    console.log(`✗ ${label}`);
  }
};

const GOOD = 'uKfTEQIKIsA';
const BAD = ['', 'short', 'uKfTEQIKIsA1', 'uKfTEQIKIs"', 'abc/../xyz1', 'x"onload="1', 'javascript:', 'uKfTEQ IKIs'];

const ok = toArticle(post([{ _type: 'journalVideo', videoId: GOOD, title: 'T' }]), undefined).blocks;
check(ok.length === 1 && ok[0].type === 'video' && ok[0].id === GOOD, 'un identifiant valide donne un bloc vidéo');
for (const id of BAD) {
  const out = toArticle(post([{ _type: 'journalVideo', videoId: id, title: 'T' }]), undefined).blocks;
  check(out.length === 0, `identifiant refusé : ${JSON.stringify(id)}`);
}

const LANGS = ['fr', 'en', 'ru'] as const;
for (const lang of LANGS) {
  const html = renderToStaticMarkup(
    createElement(ArticleVideo, { id: GOOD, title: 'T', poster: null, lang, watchLabel: 'W', notice: 'n', newTab: 'x' }),
  );
  check(!html.includes('<iframe'), `${lang} : aucune iframe`);
  check(!html.includes('youtube-nocookie'), `${lang} : aucune adresse youtube-nocookie`);
  check(html.includes(`href="https://www.youtube.com/watch?v=${GOOD}&amp;hl=${lang}"`), `${lang} : lien vers la vidéo dans la langue de la page`);
  check(html.includes('target="_blank"') && html.includes('rel="noopener noreferrer"'), `${lang} : nouvel onglet, sans référent`);
}

const total = 1 + BAD.length + LANGS.length * 4;
console.log(`${total - failed}/${total} cas OK.`);
if (failed > 0) process.exit(1);
