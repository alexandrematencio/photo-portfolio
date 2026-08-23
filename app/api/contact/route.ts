import { validateContact, HONEYPOT_FIELD, MIN_FILL_MS } from '@/lib/contact/schema';
import { sendContactEmail } from '@/lib/contact/send';

/**
 * POST /api/contact — réception du formulaire.
 *
 * ⚠️ INERTE AUJOURD'HUI. Le site est en `output: 'export'` (CLAUDE.md §2.1) :
 * ce handler n'est pas émis dans `out/`, il est simplement ignoré par le build
 * statique — vérifié, le build passe et la route n'apparaît pas. Il devient
 * vivant tel quel le jour de la migration serveur, sans rien à réécrire.
 * Marche à suivre ce jour-là : `docs/CONTACT-FORM.md`.
 */

export const runtime = 'nodejs';
// ⚠️ PAS de `export const dynamic = 'force-dynamic'` ici : sous
// `output: 'export'`, Next REFUSE le build avec cette ligne (« cannot be used
// with output: export » — erreur constatée, pas supposée). Sans elle, le
// handler POST est simplement ignoré par l'export statique et le build passe.
// Elle n'apporterait de toute façon rien : un handler qui lit le corps d'une
// requête POST est dynamique par nature.

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid-body' }, { status: 400 });
  }

  const body = (payload ?? {}) as Record<string, unknown>;

  // ── Anti-spam, AVANT toute validation ─────────────────────────────────────
  // Deux pièges muets. Un bot qui tombe dedans reçoit un « ok » : lui répondre
  // en erreur, c'est lui apprendre ce qu'il faut corriger. Rien n'est envoyé.
  const honeypot = body[HONEYPOT_FIELD];
  const elapsed = typeof body.elapsedMs === 'number' ? body.elapsedMs : 0;
  if ((typeof honeypot === 'string' && honeypot.length > 0) || elapsed < MIN_FILL_MS) {
    return Response.json({ ok: true }, { status: 200 });
  }

  // Re-validation SERVEUR, avec le même schéma que le navigateur. Ce qui est
  // validé côté client est une commodité d'affichage, jamais une garantie.
  const result = validateContact(body);
  if (!result.ok) {
    return Response.json({ ok: false, errors: result.errors }, { status: 400 });
  }

  const sent = await sendContactEmail(result.data);
  if (!sent.ok) {
    return Response.json({ ok: false, error: sent.reason }, { status: 502 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
