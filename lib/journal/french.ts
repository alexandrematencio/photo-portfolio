/**
 * Espaces insécables de la typographie française : un « ou un : ne doit
 * jamais finir seul en bout de ligne (constaté sur téléphone, 390 px).
 * Fine insécable devant ; : ! ?, insécable pleine dans les guillemets.
 */
export function frenchSpaces(text: string): string {
  return text
    .replace(/« /g, '«\u00a0')
    .replace(/ »/g, '\u00a0»')
    .replace(/ ([:;!?])/g, '\u202f$1');
}
