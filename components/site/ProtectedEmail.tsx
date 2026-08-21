'use client';

import { useEffect, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';

/**
 * Anti-scraping email link.
 *
 * Threat model : 95 % des scrapers grabent l'HTML statique et regexent
 * `mailto:` ou `\w+@\w+\.\w+`. Ils n'exécutent pas le JS et ne simulent
 * pas les events utilisateur. C'est ce contre quoi on protège ici.
 *
 * Mécanisme :
 *  - L'HTML servi par GH Pages contient `<a href="#">` — aucune string
 *    email présente, aucune ressemblance à un `mailto:`.
 *  - Le `mailto:` est construit côté DOM uniquement quand l'utilisateur
 *    hover, focus ou touch le lien (events qu'un crawler headless ne
 *    déclenche normalement pas). `onClick` arm aussi en dernier recours.
 *  - Le local-part et le domaine sont stockés séparément, jamais
 *    concaténés dans le source — un scraper qui parse le bundle JS
 *    minifié ne tombera pas sur la string complète.
 *
 * UX : aucun impact pour l'humain. Hover ou focus = href prêt avant que
 * le clic ne navigue. Lecteurs d'écran : `aria-label` annonce l'action
 * (`children` est libre — typiquement un CTA type "Write to me").
 *
 * Honeypot complémentaire : voir `EmailHoneypot.tsx` (rendu une fois
 * au layout). Empoisonne les listes des scrapers paresseux.
 */

// Local-part et domaine stockés séparément — pas de string complète
// dans le source ni dans le bundle compilé.
const LOCAL_PART = 'amatencio';
const DOMAIN = 'pm.me';

function arm(e: SyntheticEvent<HTMLAnchorElement>): void {
  e.currentTarget.href = `mailto:${LOCAL_PART}@${DOMAIN}`;
}

type Props = {
  children: ReactNode;
  className?: string;
  /** Optional subject prefilled in the mailto. */
  subject?: string;
};

/**
 * Adresse affichée en clair pour l'HUMAIN, jamais présente dans le HTML servi :
 * assemblée au montage client (useEffect), donc absente du HTML statique ET du
 * flight payload Next. Avant hydratation, un libellé neutre tient la place.
 * Utilisée par le jeton `@EMAIL` des textes CMS (PortableBody).
 */
export function EmailAddressText() {
  const [text, setText] = useState('email');
  useEffect(() => {
    setText(`${LOCAL_PART}@${DOMAIN}`);
  }, []);
  return <>{text}</>;
}

export function ProtectedEmail({ children, className, subject }: Props) {
  function armWithSubject(e: SyntheticEvent<HTMLAnchorElement>): void {
    const base = `mailto:${LOCAL_PART}@${DOMAIN}`;
    e.currentTarget.href = subject
      ? `${base}?subject=${encodeURIComponent(subject)}`
      : base;
  }

  const handler = subject ? armWithSubject : arm;

  return (
    <a
      href="#"
      onMouseEnter={handler}
      onFocus={handler}
      onTouchStart={handler}
      onClick={handler}
      className={className}
      aria-label="Send an email"
    >
      {children}
    </a>
  );
}
