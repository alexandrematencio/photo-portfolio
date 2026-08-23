# Formulaire de contact — écrit, testé, éteint

> Préparé le 2026-08-23, en vue de la migration serveur annoncée pour
> septembre 2026. Tout le code est en place et vérifié ; il ne s'active pas
> tant qu'il n'y a pas de serveur pour l'exécuter.

## Pourquoi il est éteint

Le site est en `output: 'export'` : un tas de fichiers statiques, aucun
processus qui tourne. Un formulaire a besoin de quelqu'un pour recevoir le POST.
Aujourd'hui, `/api/contact` n'existe pas dans `out/` — le build l'ignore
silencieusement. Le formulaire afficherait donc « envoyé » ou une erreur 404
selon l'humeur du CDN, ce qui est pire que pas de formulaire.

D'où l'interrupteur : `lib/contact/config.ts` lit `NEXT_PUBLIC_CONTACT_FORM`.
Tant qu'il ne vaut pas `1`, `/contact` garde son seul lien email protégé et le
composant n'est même pas rendu.

## Ce qui existe déjà

| Fichier | Rôle |
|---|---|
| `lib/contact/schema.ts` | Champs + messages d'erreur, **partagés client/serveur** (zod) |
| `lib/contact/send.ts` | Envoi via l'API REST Resend (`fetch`, aucun SDK) |
| `lib/contact/config.ts` | L'interrupteur |
| `app/api/contact/route.ts` | Le handler POST — validation, anti-spam, envoi |
| `components/site/ContactForm.tsx` | Le formulaire (a11y, états, honeypot) |
| `app/(site)/contact/page.tsx` | Affiche le formulaire **si** l'interrupteur est à `1` |

**Conformité déjà en place** (CLAUDE.md §6.5) : trois champs et rien de plus,
case de consentement **non pré-cochée** avec lien vers `/privacy`, confirmation
explicite après envoi (le formulaire disparaît, la réponse prend sa place),
aucune donnée stockée (l'email EST l'enregistrement), aucune donnée personnelle
dans les logs, honeypot + piège temporel de 3 s.

**Anti-spam** : deux pièges muets — un champ leurre invisible, et un envoi
refusé s'il arrive moins de 3 s après l'affichage. Dans les deux cas, la réponse
est un `200 ok` : renvoyer une erreur à un robot, c'est lui apprendre ce qu'il
faut corriger. Rien n'est envoyé.

## Le jour de la migration

1. **Compte Resend + domaine vérifié.** Sans domaine vérifié, les envois partent
   en spam ou sont refusés. `CONTACT_FROM` doit être une adresse de ce domaine
   (`contact@…`), `CONTACT_TO` la boîte qui reçoit.
2. **Variables d'environnement** chez l'hébergeur (pas dans le repo) :
   `RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM`, et `NEXT_PUBLIC_CONTACT_FORM=1`.
3. **`next.config.ts`** : retirer `output: 'export'`. Pour le `basePath` (qui
   disparaît sur un domaine propre), **une seule chose à faire** : vider
   `NEXT_PUBLIC_BASE_PATH` dans `.env.production`. `next.config.ts` et
   `lib/utils/asset.ts` lisent la même variable depuis le 2026-08-23 — il n'y a
   plus deux littéraux à garder d'accord.
4. **Garder `trailingSlash: true` en tête** : il vaut aussi pour les route
   handlers. Le formulaire appelle `/api/contact/` **avec** le slash final —
   sans lui, chaque envoi commence par un 308 (mesuré).
5. **Anti-bot de la plateforme.** Sur Vercel, activer BotID sur la route
   (CLAUDE.md §2.2/§6.5). Le honeypot est un filtre, pas un rempart. Pas de
   reCAPTCHA Google : transfert hors UE sans consentement.
6. **`/privacy` doit dire ce que le formulaire fait** avant qu'il soit visible.
   Paragraphe prêt à poser :

   > When you use the contact form, the name, email address and message you
   > provide are sent to my mailbox so I can answer you. Legal basis:
   > pre-contractual measures (GDPR art. 6.1.b). Nothing is stored in a
   > database — your message lives in my inbox and is kept for 3 years after
   > our last exchange. Delivery is handled by Resend, acting as a processor
   > under a data processing agreement.

   ⚠️ Compléter avec la juridiction réelle du compte Resend (US ou UE) et
   l'hébergeur en place au moment de la publication — §6.6 impose de nommer
   explicitement le transfert hors UE.
7. **Un envoi réel de bout en bout** avant d'annoncer quoi que ce soit, puis
   vérifier que la réponse (« Reply ») écrit bien au visiteur : le champ
   `reply_to` est posé pour ça.

## Ce qu'il reste à décider avec Alexandre

- **Le titre au-dessus du formulaire** s'écrit dans le Studio, en fin de
  `contactBody` (le formulaire se pose dessous, sans titre à lui — §8.5).
- **Le lien email protégé reste-t-il** une fois le formulaire en ligne ? Les
  deux peuvent coexister ; garder l'adresse visible reste utile pour les pièces
  jointes et pour les gens qui préfèrent leur propre boîte.
- **Habillage visuel** : ce qui est livré est sobre et cohérent avec les pages
  éditoriales (trait de 2 px sous chaque champ, bouton plein). Les valeurs
  fines relèvent du brand book.

## Vérifié le 2026-08-23 (dev local, `npm run dev`)

| Cas | Réponse |
|---|---|
| Honeypot rempli | `200 {"ok":true}` — rien n'est envoyé |
| Envoi en moins de 3 s | `200 {"ok":true}` — rien n'est envoyé |
| Champs invalides | `400` + une erreur par champ |
| Corps illisible | `400 invalid-body` |
| Données valides, envoi non configuré | `502 not-configured` |
| `npm run build` (export statique) | passe ; `/api/contact` **absent** de `out/` |
