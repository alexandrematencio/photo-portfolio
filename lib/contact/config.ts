/**
 * Interrupteur du formulaire de contact.
 *
 * `false` tant que le site est un export statique : sans serveur, la route
 * `/api/contact` n'existe pas et chaque envoi finirait en 404. La page garde
 * donc son lien email protégé, et le formulaire n'est même pas rendu.
 *
 * À basculer le jour de la migration serveur — poser `NEXT_PUBLIC_CONTACT_FORM=1`
 * dans l'environnement du build. Marche à suivre complète : `docs/CONTACT-FORM.md`.
 *
 * `NEXT_PUBLIC_*` parce que la décision doit être lisible au rendu de la page,
 * donc côté client. Aucune valeur sensible ici : c'est un booléen.
 */
export const CONTACT_FORM_ENABLED =
  process.env.NEXT_PUBLIC_CONTACT_FORM === '1';
