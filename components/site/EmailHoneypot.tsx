/**
 * Honeypot — piège à scrapers d'emails.
 *
 * Rendu une fois au layout (`app/(site)/layout.tsx`). Présente un faux
 * `mailto:` aux scrapers qui font un parse HTML naïf — ils l'ajoutent
 * à leur liste, on a deux usages possibles côté ProtonMail :
 *
 *  1. **Filtre delete-on-arrival** : crée un filter "To: contient
 *     'trap-amatencio' → trash". Tout email vers cette adresse =
 *     spam confirmé, automatiquement supprimé.
 *  2. **Métrique** : laisse les mails arriver dans un dossier "honeypot"
 *     pour mesurer le volume de scraping ciblant le site.
 *
 * Pourquoi `position:absolute; left:-9999px` plutôt que `display:none` ?
 *  - `display:none` est un signal classique côté scraper "skip this".
 *    Les scrapers un peu malins filtrent les éléments cachés.
 *  - Le décalage hors-viewport reste visible côté DOM/HTML parsing,
 *    donc le scraper le trouve. Inacccessible visuellement et au
 *    clavier (`tabIndex={-1}` + `aria-hidden`).
 *
 * Si tu veux désactiver le honeypot : retire `<EmailHoneypot />` du
 * layout. Le composant reste en place pour réactivation facile.
 */
export function EmailHoneypot() {
  return (
    <a
      href="mailto:trap-amatencio@pm.me"
      aria-hidden="true"
      tabIndex={-1}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 'auto',
        width: 1,
        height: 1,
        overflow: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      Contact administrator
    </a>
  );
}
