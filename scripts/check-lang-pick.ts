import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PICK_LANG_SRC } from '../lib/journal/i18n';

// La même chaîne que celle embarquée dans le script de la page (languageScript).
const pick = new Function(`${PICK_LANG_SRC}; return pickLang;`)() as (tags: string[]) => string;

test('les trois langues du journal', () => {
  assert.equal(pick(['fr-FR']), 'fr');
  assert.equal(pick(['fr-CH', 'en']), 'fr');
  assert.equal(pick(['en-GB']), 'en');
  assert.equal(pick(['ru-RU']), 'ru');
  assert.equal(pick(['ru']), 'ru');
});

test('langues de pays russophones → russe', () => {
  for (const t of ['uk-UA', 'be-BY', 'kk-KZ', 'ky-KG', 'uz-UZ', 'tg-TJ', 'az-AZ', 'hy-AM', 'ka-GE', 'et-EE', 'lv-LV', 'lt-LT', 'ro-MD'])
    assert.equal(pick([t]), 'ru', t);
});

test('toute autre langue → anglais', () => {
  for (const t of ['de-DE', 'es-ES', 'ja-JP', 'zh-CN', 'pl-PL', 'bg-BG', 'ro-RO', 'tr-TR', 'ar'])
    assert.equal(pick([t]), 'en', t);
  assert.equal(pick([]), 'en');
  assert.equal(pick(['']), 'en');
});

test("l'ordre de préférence du système tranche", () => {
  assert.equal(pick(['de-DE', 'fr-FR']), 'fr');
  assert.equal(pick(['uk-UA', 'en-US']), 'ru');
  assert.equal(pick(['en-US', 'uk-UA']), 'en');
  assert.equal(pick(['ja', 'ru']), 'ru');
});
