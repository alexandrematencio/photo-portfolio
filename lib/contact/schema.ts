import { z } from 'zod';

/**
 * Schéma du formulaire de contact — PARTAGÉ client / serveur.
 *
 * Une seule définition des champs et des messages : le navigateur valide avec
 * exactement ce que le serveur re-valide. Un schéma dupliqué finit toujours par
 * diverger, et la divergence se voit du mauvais côté (l'utilisateur passe la
 * validation locale et se prend un 400 sans explication).
 *
 * RGPD (CLAUDE.md §6.5) : trois champs, tous nécessaires à répondre — nom,
 * email, message. Rien de plus. Pas de téléphone, pas de société, pas de
 * « comment nous avez-vous connus ». La minimisation n'est pas une option de
 * confort, c'est la base légale du traitement.
 */

/** Plafonds de saisie. Repris tels quels par les `maxLength` du formulaire. */
export const CONTACT_LIMITS = {
  name: 80,
  email: 120,
  message: 2000,
} as const;

/**
 * Piège temporel anti-bot : un humain ne remplit pas trois champs en moins de
 * 3 s. Contrôlé côté SERVEUR uniquement (le client, lui, envoie juste le temps
 * écoulé depuis l'affichage). Volontairement bas — c'est un filtre à robots
 * grossiers, pas une épreuve pour un visiteur pressé.
 */
export const MIN_FILL_MS = 3000;

/** Nom du champ leurre. Un bot remplit tout ce qu'il trouve ; un humain ne le voit pas. */
export const HONEYPOT_FIELD = 'company';

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: 'Please enter your name.' })
    .max(CONTACT_LIMITS.name, { error: 'This name is too long.' }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(CONTACT_LIMITS.email, { error: 'This address is too long.' })
    .pipe(z.email({ error: 'Please enter a valid email address.' })),
  message: z
    .string()
    .trim()
    .min(10, { error: 'A few more words, please.' })
    .max(CONTACT_LIMITS.message, {
      error: `Please keep it under ${CONTACT_LIMITS.message} characters.`,
    }),
  // Case NON pré-cochée, obligatoire (§6.5). `literal(true)` plutôt que
  // `boolean()` : un `false` doit être un refus explicite, pas un champ absent.
  consent: z.literal(true, {
    error: 'Please accept the privacy terms so I can reply.',
  }),
});

export type ContactInput = z.infer<typeof contactSchema>;

/** Erreurs par champ, forme consommée directement par le formulaire. */
export type ContactFieldErrors = Partial<Record<keyof ContactInput, string>>;

/**
 * Valide et rend la PREMIÈRE erreur de chaque champ. `z.flattenError` plutôt
 * que l'ancien `error.flatten()` (retiré en zod v4).
 */
export function validateContact(
  raw: unknown
): { ok: true; data: ContactInput } | { ok: false; errors: ContactFieldErrors } {
  const parsed = contactSchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };

  const flat = z.flattenError(parsed.error).fieldErrors as Record<
    string,
    string[] | undefined
  >;
  const errors: ContactFieldErrors = {};
  for (const key of Object.keys(flat) as (keyof ContactInput)[]) {
    const first = flat[key]?.[0];
    if (first) errors[key] = first;
  }
  return { ok: false, errors };
}
