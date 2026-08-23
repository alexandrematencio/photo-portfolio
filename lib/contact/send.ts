import type { ContactInput } from './schema';

/**
 * Envoi de l'email de contact.
 *
 * **Pas de SDK, un `fetch` sur l'API REST du fournisseur.** Le besoin tient en
 * un POST JSON ; une dépendance de plus pour ça, c'est de la surface de chaîne
 * d'approvisionnement pour rien. Corollaire utile : changer de fournisseur ne
 * touche que ce fichier.
 *
 * **Rien n'est stocké.** L'email EST l'enregistrement, la boîte de réception
 * est le seul lieu de conservation (CLAUDE.md §6.2 : 3 ans après le dernier
 * contact, puis archivage). Pas de base, donc pas de base à sécuriser, à
 * purger, ni à déclarer.
 *
 * Variables d'environnement (à poser côté hébergeur, jamais dans le repo) :
 *   RESEND_API_KEY   — clé API du compte d'envoi
 *   CONTACT_TO       — boîte qui reçoit les messages
 *   CONTACT_FROM     — expéditeur, sur un domaine VÉRIFIÉ chez le fournisseur
 *                      (sinon tout part en spam, ou est refusé)
 */

const ENDPOINT = 'https://api.resend.com/emails';

export type SendOutcome =
  | { ok: true }
  | { ok: false; reason: 'not-configured' | 'provider-error' };

/** Échappe le contenu visiteur avant de le poser dans le corps HTML de l'email. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendContactEmail(input: ContactInput): Promise<SendOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO;
  const from = process.env.CONTACT_FROM;

  // Config absente = on le dit à l'appelant, on ne fait PAS semblant d'avoir
  // envoyé. Un formulaire qui répond « merci » dans le vide est pire que pas
  // de formulaire du tout.
  if (!apiKey || !to || !from) return { ok: false, reason: 'not-configured' };

  const subject = `Portfolio — message from ${input.name}`;
  const text = `${input.message}\n\n—\n${input.name} <${input.email}>`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">
<p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>
<hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
<p style="color:#666">${escapeHtml(input.name)} — ${escapeHtml(input.email)}</p>
</div>`;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html,
        // Répondre depuis la boîte de réception écrit directement au visiteur.
        reply_to: input.email,
      }),
    });

    if (!res.ok) {
      // Statut seul : le corps de la réponse peut contenir l'adresse du
      // visiteur, et aucune donnée personnelle ne va dans les logs (§6.8).
      console.error(`[contact] provider responded ${res.status}`);
      return { ok: false, reason: 'provider-error' };
    }
    return { ok: true };
  } catch {
    console.error('[contact] provider unreachable');
    return { ok: false, reason: 'provider-error' };
  }
}
