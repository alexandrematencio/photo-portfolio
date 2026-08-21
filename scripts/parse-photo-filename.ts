/**
 * Parser du nom de fichier photo — champs NOMMÉS, ordre libre, tous optionnels.
 *
 * Deux écritures possibles pour chaque champ, mélangeables dans un même nom :
 *
 *   1. Explicite (recommandée, jamais ambiguë) :
 *        Titre -lieu:paris, france -style:sp,paysage -serie:global street, topo
 *   2. Implicite (confort, devinée d'après le contenu du jeton) :
 *        Titre -paris, france -sp,paysage -2024
 *
 * Styles et séries acceptent PLUSIEURS valeurs, séparées par des virgules.
 *
 * L'ordre n'a AUCUNE importance : `-lieu:x -date:y` ≡ `-date:y -lieu:x`.
 * Un champ absent n'est pas une erreur — il est simplement vide, à compléter
 * dans le Studio. Un jeton incompréhensible n'interrompt jamais l'import : il
 * est signalé dans le rapport (`unresolved`).
 *
 * Seule règle de position : le PREMIER jeton est le titre, sauf s'il porte une
 * clé explicite (`titre:`).
 */

import { normalizeForMatch } from './taxonomy-helpers';

/** Champs reconnus + toutes leurs orthographes acceptées comme clé. */
const KEY_ALIASES: Record<string, PhotoField> = {
  titre: 'title',
  title: 'title',
  nom: 'title',

  lieu: 'location',
  location: 'location',
  ville: 'location',
  place: 'location',

  style: 'styles',
  styles: 'styles',
  type: 'styles',
  types: 'styles',

  boitier: 'camera',
  'boîtier': 'camera',
  camera: 'camera',
  'caméra': 'camera',
  appareil: 'camera',
  body: 'camera',

  objectif: 'lens',
  lens: 'lens',
  optique: 'lens',
  lentille: 'lens',

  annee: 'year',
  'année': 'year',
  year: 'year',
  an: 'year',

  date: 'date',

  serie: 'series',
  'série': 'series',
  series: 'series',
  'séries': 'series',
};

export type PhotoField =
  | 'title'
  | 'location'
  | 'styles'
  | 'camera'
  | 'lens'
  | 'year'
  | 'date'
  | 'series';

export type ParseContext = {
  /** normalize(alias|titre) → présence, pour les 4 styles connus. */
  styleAliases: Set<string>;
  /** normalize(alias|titre) → présence, boîtiers déjà connus. */
  cameraAliases: Set<string>;
  /** normalize(alias|titre) → présence, objectifs déjà connus. */
  lensAliases: Set<string>;
  /** normalize(lieu) → présence, lieux déjà utilisés dans le catalogue. */
  knownLocations: Set<string>;
  /** normalize(titre | slug) → présence, séries existantes du catalogue. */
  seriesKeys: Set<string>;
  /** Année courante, pour borner la détection d'année. */
  currentYear: number;
};

export type ParsedFilename = {
  title: string;
  location: string | null;
  styleTokens: string[];
  seriesTokens: string[];
  cameraToken: string | null;
  lensToken: string | null;
  year: number | null;
  dateTaken: string | null;
  /** Jetons non classés — signalés, jamais bloquants. */
  unresolved: string[];
  /** Messages d'avertissement (doublon de clé, clé inconnue…). */
  warnings: string[];
  /** true si le nom ne suit aucune convention (aucun séparateur). */
  legacy: boolean;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_RE = /^\d{4}$/;

function cleanToken(raw: string): string {
  // Tolère `--lieu:x` autant que `-lieu:x` : l'utilisateur pense souvent en
  // « flags » de ligne de commande.
  return raw.replace(/^-+/, '').trim();
}

function splitKey(token: string): { field: PhotoField | null; value: string; rawKey: string | null } {
  const m = token.match(/^([\p{L}]+)\s*:\s*(.*)$/u);
  if (!m) return { field: null, value: token, rawKey: null };
  const rawKey = m[1]!;
  const field = KEY_ALIASES[normalizeForMatch(rawKey)] ?? null;
  return { field, value: m[2]!.trim(), rawKey };
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Tous les segments correspondent-ils à un alias de style connu ? */
function looksLikeStyles(value: string, ctx: ParseContext): boolean {
  const parts = splitList(value);
  if (parts.length === 0) return false;
  return parts.every((p) => ctx.styleAliases.has(normalizeForMatch(p)));
}

/** Tous les segments correspondent-ils à une série existante (titre ou slug) ? */
function looksLikeSeries(value: string, ctx: ParseContext): boolean {
  const parts = splitList(value);
  if (parts.length === 0) return false;
  return parts.every((p) => ctx.seriesKeys.has(normalizeForMatch(p)));
}

function titleFromLegacyBase(base: string): string {
  return base
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parsePhotoFilename(
  base: string,
  ctx: ParseContext
): ParsedFilename {
  const result: ParsedFilename = {
    title: '',
    location: null,
    styleTokens: [],
    seriesTokens: [],
    cameraToken: null,
    lensToken: null,
    year: null,
    dateTaken: null,
    unresolved: [],
    warnings: [],
    legacy: false,
  };

  const rawTokens = base
    .split(/\s+-/)
    .map(cleanToken)
    .filter(Boolean);

  if (rawTokens.length <= 1) {
    // Aucun séparateur : mode dégradé, le nom entier fait office de titre.
    const single = rawTokens[0] ?? base;
    const keyed = splitKey(single);
    if (keyed.field === 'title') {
      result.title = keyed.value;
    } else {
      result.title = titleFromLegacyBase(single);
      result.legacy = true;
    }
    return result;
  }

  // Le premier jeton est le titre, sauf clé explicite contraire.
  const first = splitKey(rawTokens[0]!);
  let rest: string[];
  if (first.field && first.field !== 'title') {
    // Ex. « -lieu:paris -titre:Ma photo » : pas de titre en tête.
    rest = rawTokens;
  } else {
    result.title = first.field === 'title' ? first.value : rawTokens[0]!;
    rest = rawTokens.slice(1);
  }

  /** Pose une valeur, en signalant l'écrasement d'une valeur déjà posée. */
  const setOnce = (field: PhotoField, apply: () => void, already: boolean) => {
    if (already) {
      result.warnings.push(
        `champ « ${field} » renseigné plusieurs fois — la dernière valeur gagne`
      );
    }
    apply();
  };

  for (const token of rest) {
    const { field, value, rawKey } = splitKey(token);

    // ── Champ explicite ────────────────────────────────────────────────────
    if (field) {
      switch (field) {
        case 'title':
          setOnce('title', () => (result.title = value), Boolean(result.title));
          break;
        case 'location':
          setOnce(
            'location',
            () => (result.location = value),
            result.location !== null
          );
          break;
        case 'styles':
          setOnce(
            'styles',
            () => (result.styleTokens = splitList(value)),
            result.styleTokens.length > 0
          );
          break;
        case 'series':
          setOnce(
            'series',
            () => (result.seriesTokens = splitList(value)),
            result.seriesTokens.length > 0
          );
          break;
        case 'camera':
          setOnce(
            'camera',
            () => (result.cameraToken = value),
            result.cameraToken !== null
          );
          break;
        case 'lens':
          setOnce('lens', () => (result.lensToken = value), result.lensToken !== null);
          break;
        case 'year': {
          const n = Number.parseInt(value, 10);
          if (Number.isNaN(n) || n < 1900 || n > ctx.currentYear + 1) {
            result.warnings.push(`année « ${value} » invalide — ignorée`);
          } else {
            setOnce('year', () => (result.year = n), result.year !== null);
          }
          break;
        }
        case 'date': {
          const m = value.match(DATE_RE);
          if (!m) {
            result.warnings.push(
              `date « ${value} » invalide (format attendu AAAA-MM-JJ) — ignorée`
            );
          } else {
            result.dateTaken = value;
            if (result.year === null) result.year = Number.parseInt(m[1]!, 10);
          }
          break;
        }
      }
      continue;
    }

    // Clé écrite mais inconnue (« -truc:machin ») : on le dit, sans bloquer.
    if (rawKey) {
      result.warnings.push(`clé inconnue « ${rawKey}: » — jeton ignoré`);
      result.unresolved.push(token);
      continue;
    }

    // ── Champ implicite : déduction par le contenu ─────────────────────────
    const norm = normalizeForMatch(value);

    const dateMatch = value.match(DATE_RE);
    if (dateMatch) {
      result.dateTaken = value;
      if (result.year === null) result.year = Number.parseInt(dateMatch[1]!, 10);
      continue;
    }

    if (YEAR_RE.test(value)) {
      const n = Number.parseInt(value, 10);
      if (n >= 1900 && n <= ctx.currentYear + 1) {
        if (result.year === null) result.year = n;
        continue;
      }
    }

    if (result.styleTokens.length === 0 && looksLikeStyles(value, ctx)) {
      result.styleTokens = splitList(value);
      continue;
    }

    if (result.cameraToken === null && ctx.cameraAliases.has(norm)) {
      result.cameraToken = value;
      continue;
    }

    if (result.lensToken === null && ctx.lensAliases.has(norm)) {
      result.lensToken = value;
      continue;
    }

    // Séries — testées AVANT le lieu : un jeton multi-séries contient des
    // virgules (« global street, topo ») et serait sinon happé par la règle
    // « une virgule = un lieu ». Tous les segments doivent matcher une série
    // EXISTANTE ; une série encore inconnue passe par la clé explicite
    // (`-serie:`), qui seule autorise la création.
    if (result.seriesTokens.length === 0 && looksLikeSeries(value, ctx)) {
      result.seriesTokens = splitList(value);
      continue;
    }

    // Lieu : soit déjà connu du catalogue, soit de forme « Ville, Pays ».
    if (
      result.location === null &&
      (ctx.knownLocations.has(norm) || value.includes(','))
    ) {
      result.location = value;
      continue;
    }

    // Rien de sûr : on ne devine pas au hasard, on signale.
    result.unresolved.push(value);
  }

  if (!result.title) result.title = titleFromLegacyBase(base);

  return result;
}
