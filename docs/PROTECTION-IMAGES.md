# Protéger tes photos en ligne — ce que le site fait, ce qu'il te reste à faire

> Pour Alexandre. Mis en place le 2026-09-11. L'audit complet est dans
> `docs/superpowers/specs/2026-09-11-protection-images-audit.md`.

## Ce qu'il faut savoir en une minute

Une photo affichée dans un navigateur est une photo déjà livrée : rien n'empêche
une capture d'écran. Le site ne cherche donc pas à empêcher la copie. Il fait
trois choses : il ne sert JAMAIS plus de 2048 px (inexploitable en impression :
17 × 11 cm à 300 dpi), il déclare ton nom, ton copyright et ta page de contact
à Google sur chaque photo (crédit d'auteur et badge « Licensable » dans Google
Images), et il refuse les robots d'entraînement d'IA de façon lisible par les
machines. Le clic droit bloqué est un signal, pas une protection.

Les métadonnées que Lightroom écrit dans tes fichiers (ton nom, le copyright)
N'ARRIVENT PAS jusqu'au visiteur : l'hébergeur d'images ré-encode tout et les
efface, comme Instagram ou Facebook. Elles servent ailleurs — voir ci-dessous.

## Ce que le site fait tout seul

- Plafond 2048 px sur tout le catalogue, y compris les anciennes photos.
- Le Studio REFUSE de publier une photo plus grande (message rouge sous l'image).
  Exporte à 2048 px, ou passe par `npm run upload-photos` qui réduit tout seul.
- Chaque page de photos porte ton nom, « © année Alexandre Matencio », un lien
  vers `/legal` (conditions) et `/contact` (demande de licence), lisibles par
  Google.
- Chaque page dit aux robots d'IA de ne pas s'en servir (`noai`, TDMRep).
  `robots.txt` les refuse aussi — il ne prendra effet qu'avec un domaine propre.
- Chaque fichier déposé dans Sanity est signé (EXIF + XMP), même si le CDN
  l'efface à la livraison : le jour où l'hébergement change, tout est prêt.

## Ce que toi seul peux faire

### 1. Lightroom : ton nom dans TOUS les fichiers (une fois, 5 minutes)

C'est le problème que tu décrivais. La correction se fait sur le catalogue, pas
photo par photo.

1. Module Bibliothèque → panneau Métadonnées → menu « Paramètres prédéfinis » →
   « Modifier les paramètres prédéfinis… ».
2. Coche et remplis : **Créateur** (Alexandre Matencio), **Copyright**
   (© Alexandre Matencio. All rights reserved.), **Statut du copyright**
   (Protégé par copyright), **Conditions d'utilisation des droits** (No use
   without prior written permission — licences: see website), **URL d'informations
   sur le copyright** (l'adresse de la page /legal du site). Enregistre sous
   « AM — droits ».
3. Sélectionne TOUTES les photos du catalogue (Ctrl/Cmd+A en vue Grille), puis
   applique le preset dans le panneau Métadonnées. Lightroom demande si tu veux
   appliquer à toutes les photos sélectionnées : oui.
4. Import : dans la fenêtre d'import, section « Appliquer pendant l'importation »,
   choisis le preset « AM — droits ». Chaque nouvelle photo l'aura.
5. Export : vérifie que « Métadonnées → Inclure : Tout » (ou au minimum
   « Copyright et informations de contact uniquement ») est coché, et que
   « Supprimer les informations de localisation » est coché (pas de GPS en ligne).

Lightroom (cloud/mobile) n'a que les champs Copyright et Créateur : remplis les
deux dans les Infos de chaque album, et fais le reste dans Lightroom Classic.

Ces métadonnées comptent pour tout ce que tu envoies à des tiers (presse,
concours, galeries, clients) — pas pour le site, qui les remplace par ses
déclarations à Google.

### 2. Preuve d'antériorité (une fois par an, 15 €)

Le droit d'auteur est automatique. Ce qui compte en cas de litige, c'est
prouver que TU avais la photo AVANT l'autre. Tes fichiers RAW et ton catalogue
Lightroom sont cette preuve : ne les perds jamais, sauvegarde-les hors de chez
toi. Une fois par an, dépose une enveloppe e-Soleau à l'INPI
(inpi.fr → e-Soleau, 15 € pour 10 Mo) avec une planche-contact PDF des nouvelles
photos : date certaine, reconnue par les tribunaux.

### 3. Surveiller les réutilisations (gratuit)

Crée un compte Pixsy (pixsy.com, gratuit jusqu'à 500 images) ou Copytrack
(copytrack.com, Berlin) et importe tes photos : ils cherchent où elles
apparaissent et proposent de gérer la réclamation à ta place, payés sur ce
qu'ils récupèrent. Sinon, une fois par trimestre : Google Images → icône
appareil photo → glisse une photo, ou tineye.com.

### 4. Quand tu trouves une photo volée

1. Capture d'écran de la page avec l'URL et la date visibles ; note l'adresse.
2. Cherche qui héberge le site : whois.domaintools.com ou hostingchecker.com.
3. Écris d'abord à l'auteur du site : « This photograph is mine (lien vers ta
   page /archives). Remove it within 7 days or license it: [tarif]. » Beaucoup
   retirent ou paient.
4. Sans réponse : notification à l'hébergeur. En France, c'est l'article 6-I-5
   de la LCEN (formulaire « signalement de contenu illicite » de l'hébergeur,
   avec ton identité, l'URL, la description des faits et la base légale : CPI
   art. L.122-4). Aux États-Unis, c'est une notice DMCA (chaque hébergeur a un
   formulaire, et Google a le sien pour retirer la page de ses résultats :
   google.com/webmasters/tools/dmca-notice). Les deux obligent au retrait.
5. Pour un usage commercial, Pixsy/Copytrack ou un avocat en propriété
   intellectuelle : le tarif de licence rétroactif se facture au double ou au
   triple du tarif normal.

## Décisions prises et à venir

- **Anciens fichiers pleine résolution** : purgés le 2026-09-11 sur ta décision
  (tu as les masters dans Lightroom). Sanity ne garde plus que les versions
  2048 px. Si une photo devait un jour être republiée plus grande, elle repart
  de ton master, jamais de Sanity.
- **Filigrane visible** : non, sur ta décision — il s'efface en un clic avec un
  outil d'IA, il abîme chaque photo, et il contredit « l'image d'abord ».
- **Domaine propre** : `robots.txt` et `/.well-known/tdmrep.json` ne sont lus
  qu'à la racine d'un domaine. Sous `github.io/photo-portfolio/`, ils sont
  inertes. Le jour du domaine, ils marchent sans rien changer.
