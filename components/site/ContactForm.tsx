'use client';

import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { asset } from '@/lib/utils/asset';
import {
  CONTACT_LIMITS,
  HONEYPOT_FIELD,
  validateContact,
  type ContactFieldErrors,
} from '@/lib/contact/schema';
import { EDITORIAL_BODY } from '@/lib/site/typography';

/**
 * Formulaire de contact — RGPD §6.5, a11y §4.
 *
 * ⚠️ Ne s'affiche que si `CONTACT_FORM_ENABLED` (cf. `lib/contact/config.ts`).
 * Tant que le site est un export statique, `/api/contact` n'existe pas : le
 * formulaire répondrait 404 à chaque envoi. Voir `docs/CONTACT-FORM.md`.
 *
 * Points qui ne se devinent pas :
 *  • Les `padding` sont en style INLINE. Le reset universel de `globals.css`
 *    (`* { padding: 0 }`) vit hors `@layer` et écrase les utilities Tailwind —
 *    même piège que le footer (CLAUDE.md §7.6). Un `px-4` ici ne ferait rien.
 *  • Le champ leurre est caché en CSS mais RESTE dans le DOM et dans l'envoi :
 *    c'est tout l'intérêt. `aria-hidden` + `tabIndex={-1}` + `autoComplete
 *    ="off"` pour qu'aucun humain, clavier ou lecteur d'écran, ne le croise.
 *  • Les erreurs sont rendues APRÈS le champ et reliées par `aria-describedby`,
 *    et le statut d'envoi vit dans une région `aria-live` : sans ça, un lecteur
 *    d'écran n'annonce ni l'échec ni la confirmation.
 *
 * Les valeurs visuelles fines (échelle, épaisseur de trait, couleurs d'état)
 * relèvent du brand book — ce qui est ici est sobre et cohérent avec les pages
 * éditoriales, à ajuster avec Alexandre.
 */

type Status = 'idle' | 'sending' | 'sent' | 'error';

const LABEL_CLASS =
  'block text-[13px] md:text-[15px] font-bold uppercase tracking-[0.08em] text-[var(--color-fg)] opacity-70';

const FIELD_CLASS =
  'w-full bg-transparent text-[17px] md:text-[20px] font-bold tracking-[-0.02em] text-[var(--color-fg)] border-0 border-b-2 border-[var(--color-fg)] outline-none focus-visible:border-[var(--color-accent)] transition-colors motion-reduce:transition-none';

const FIELD_STYLE: React.CSSProperties = {
  paddingTop: 10,
  paddingBottom: 10,
  borderRadius: 0,
};

const ERROR_CLASS =
  'text-[13px] md:text-[15px] font-bold tracking-[-0.01em] text-[var(--color-accent)]';

export function ContactForm() {
  const id = useId();
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Départ du chrono anti-bot : l'instant où le formulaire s'affiche.
  const mountedAt = useRef<number>(Date.now());

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const candidate = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      message: String(form.get('message') ?? ''),
      consent: form.get('consent') === 'on',
    };

    const check = validateContact(candidate);
    if (!check.ok) {
      setErrors(check.errors);
      setFormError(null);
      setStatus('idle');
      return;
    }

    setErrors({});
    setFormError(null);
    setStatus('sending');

    try {
      // Slash final OBLIGATOIRE : `trailingSlash: true` (next.config.ts) vaut
      // aussi pour les route handlers — sans lui, l'envoi part en 308 vers
      // l'URL slashée avant d'arriver (mesuré). Le POST survit à la
      // redirection, mais c'est un aller-retour gratuit sur chaque envoi.
      const res = await fetch(asset('/api/contact/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...check.data,
          [HONEYPOT_FIELD]: String(form.get(HONEYPOT_FIELD) ?? ''),
          elapsedMs: Date.now() - mountedAt.current,
        }),
      });

      if (res.ok) {
        setStatus('sent');
        return;
      }

      const data = (await res.json().catch(() => null)) as
        | { errors?: ContactFieldErrors }
        | null;
      if (data?.errors) setErrors(data.errors);
      setFormError(
        "Something went wrong on my side. Please write to me by email instead."
      );
      setStatus('error');
    } catch {
      setFormError(
        'The message could not be sent. Check your connection, or write to me by email instead.'
      );
      setStatus('error');
    }
  }

  // Confirmation EXPLICITE (§6.5) : le formulaire disparaît, la réponse prend
  // sa place. Un simple message sous des champs encore remplis laisse toujours
  // planer le doute sur ce qui est parti.
  if (status === 'sent') {
    return (
      <p className={EDITORIAL_BODY} role="status">
        Thank you — your message is on its way. I usually reply within 48 to 72
        hours.
      </p>
    );
  }

  const describe = (field: keyof ContactFieldErrors) =>
    errors[field] ? `${id}-${field}-error` : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      {/* Nom et email plafonnés : une ligne de saisie de 1050 px pour un
          prénom est illisible à l'œil et pénible à relire. Le message, lui,
          garde toute la largeur — c'est le champ qu'on écrit vraiment. */}
      <div className="flex flex-col gap-2 max-w-[520px]">
        <label className={LABEL_CLASS} htmlFor={`${id}-name`}>
          Name
        </label>
        <input
          id={`${id}-name`}
          name="name"
          type="text"
          required
          maxLength={CONTACT_LIMITS.name}
          autoComplete="name"
          className={FIELD_CLASS}
          style={FIELD_STYLE}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describe('name')}
        />
        {errors.name && (
          <p id={`${id}-name-error`} className={ERROR_CLASS}>
            {errors.name}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 max-w-[520px]">
        <label className={LABEL_CLASS} htmlFor={`${id}-email`}>
          Email
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          maxLength={CONTACT_LIMITS.email}
          autoComplete="email"
          className={FIELD_CLASS}
          style={FIELD_STYLE}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describe('email')}
        />
        {errors.email && (
          <p id={`${id}-email-error`} className={ERROR_CLASS}>
            {errors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className={LABEL_CLASS} htmlFor={`${id}-message`}>
          Message
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          required
          rows={6}
          maxLength={CONTACT_LIMITS.message}
          className={`${FIELD_CLASS} resize-y`}
          style={FIELD_STYLE}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describe('message')}
        />
        {errors.message && (
          <p id={`${id}-message-error`} className={ERROR_CLASS}>
            {errors.message}
          </p>
        )}
      </div>

      {/* Leurre. Jamais pré-rempli, jamais visible, jamais atteignable au clavier. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
        }}
      >
        <label htmlFor={`${id}-${HONEYPOT_FIELD}`}>Company</label>
        <input
          id={`${id}-${HONEYPOT_FIELD}`}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          {/* NON pré-cochée — exigence CNIL, pas une préférence. */}
          <input
            id={`${id}-consent`}
            name="consent"
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={describe('consent')}
          />
          <label
            htmlFor={`${id}-consent`}
            className="text-[14px] md:text-[16px] font-bold tracking-[-0.01em] leading-[1.4] text-[var(--color-fg)]"
          >
            I agree that my data may be processed in order to answer my enquiry,
            as described in the{' '}
            {/* `Link` et non `<a>` : le `basePath` n'est appliqué qu'aux
                navigations framework — un `href` brut casserait en prod. */}
            <Link
              href="/privacy"
              className="underline underline-offset-[4px] decoration-2 hover:opacity-60 transition-opacity motion-reduce:transition-none"
            >
              privacy policy
            </Link>
            .
          </label>
        </div>
        {errors.consent && (
          <p id={`${id}-consent-error`} className={ERROR_CLASS}>
            {errors.consent}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-fit text-[17px] md:text-[20px] font-bold uppercase tracking-[0.04em] text-[var(--color-bg)] bg-[var(--color-fg)] hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity motion-reduce:transition-none"
          style={{ paddingTop: 14, paddingBottom: 14, paddingLeft: 28, paddingRight: 28 }}
        >
          {status === 'sending' ? 'Sending…' : 'Send'}
        </button>

        {/* Région d'état : toujours montée, sinon un lecteur d'écran n'annonce
            rien — un `aria-live` inséré en même temps que son texte est muet. */}
        <p className={ERROR_CLASS} role="status" aria-live="polite">
          {formError ?? ''}
        </p>
      </div>
    </form>
  );
}
