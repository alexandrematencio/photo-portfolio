/**
 * Pliage et découpe des chaînes, côté index comme côté requête.
 *
 * ⚠️ Le pliage NFD + retrait des diacritiques laisse le cyrillique INTACT
 * (aucune table de correspondance latine ici — elle le détruirait). Deux
 * effets de bord assumés et souhaitables en russe : « й » se replie sur
 * « и » et « ё » sur « е », exactement comme « é » se replie sur « e ».
 */

const DIACRITICS = /[̀-ͯ]/g;
const NON_WORD = /[^\p{L}\p{N}]+/u;

/** Minuscules, sans accents. La MÊME fonction sert à l'index et à la requête. */
export function fold(input: string): string {
  return input.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}

/** Découpe sur tout ce qui n'est ni lettre ni chiffre. Jamais de token vide. */
export function tokenize(input: string): string[] {
  return fold(input).split(NON_WORD).filter(Boolean);
}

/**
 * Pour chaque index de `folded`, dit s'il commence un mot. Sert au bonus de
 * frontière du score de sous-séquence (cf. distance.ts) : « djfi » est une
 * bonne abréviation de « djerba fishermen » parce que d et f y ouvrent un mot,
 * là où « bus » n'est pas une bonne abréviation de « buoys ».
 */
export function wordStarts(folded: string): boolean[] {
  const flags = new Array<boolean>(folded.length);
  let previousWasSeparator = true;
  for (let i = 0; i < folded.length; i++) {
    const isSeparator = NON_WORD.test(folded[i]);
    flags[i] = !isSeparator && previousWasSeparator;
    previousWasSeparator = isSeparator;
  }
  return flags;
}
