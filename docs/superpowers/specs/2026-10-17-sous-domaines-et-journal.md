# Sous-domaines amatencio.com et journal dans Sanity

Décisions d'Alexandre du 2026-10-17. Ce document fixe la cible et l'ordre des
étapes ; chaque étape aura son plan au moment de la lancer.

## Cible

| Adresse | Contenu | Code |
|---|---|---|
| `amatencio.com` | Page d'accueil qui oriente vers les sous-domaines. C'est le projet **DESIGN-FOLIO** (nom trompeur), en cours. D'ici là : redirection vers `photo.amatencio.com`. | DESIGN-FOLIO, dépôt à part (Vite / three.js) |
| `photo.amatencio.com` | Le portfolio actuel | monorepo, `apps/photo` |
| `blog.amatencio.com` | Le journal | monorepo, `apps/blog` |
| `studio.amatencio.com` | Le Studio Sanity, un espace « Photo » et un espace « Journal » | monorepo, `apps/studio` |
| `design.amatencio.com` | Travaux de design, à redessiner de zéro | en dernier |

- **Un dépôt, un dossier par site**, et un paquet partagé pour la charte
  (typographie, cadre de page, `StateDot`, `PageShell`, `ListSelector`…). Le
  blog réutilise exactement les briques du site photo : deux dépôts les
  feraient diverger au premier réglage.
- **Un Studio, deux espaces (workspaces)**, un seul projet et un seul dataset
  (`yh5i5diw/production`) : un article pourra afficher une photo du portfolio
  par référence. Deux datasets l'interdiraient (références croisées = offre
  Enterprise).
- **Un webhook par site**, filtré par type de document : publier un article ne
  reconstruit que le blog.

## Étapes

1. **Le journal dans Sanity** — FAIT le 2026-10-17 sur `feat/journal-prototype` :
   documents `post` / `journalSeries` (`sanity/schemas/journal.ts`), rubrique
   « Journal » du Studio, site qui lit Sanity, cinq articles importés EN
   BROUILLONS (`npm run import-journal`). Pages en `noindex`, hors menu.
1 bis. **Le journal ouvert au public** — EN LIGNE le 2026-10-17 : « Journal »
   et « All sites » dans le menu, Contact + Socials en une page (`/contact`,
   encart sur /about), `/socials` en 301, `blog.amatencio.com` en 302 vers
   `/journal/`.
1 ter. **Le journal sur `blog.amatencio.com`** — EN LIGNE le 2026-10-17, indexé.
   Pas de monorepo à dossiers : le même dépôt produit deux builds
   (`SITE_TARGET=blog`, cf. `docs/JOURNAL-CLAUDE.md`). L'étape 3 se réduit
   donc au jour où les sites divergeront assez pour mériter chacun leur
   application.
   **Le portfolio reste sur `amatencio.com`** (décision Alexandre) : il ne
   déménage qu'avec la page d'accueil, en un seul mouvement — la racine sert
   alors l'accueil, le reste part en 301 vers `photo.` (étape 4). Caddyfile
   de cette bascule : `FREELANCE/RESOURCES/vps-amatencio/Caddyfile.bascule-photo`
   (302 sur la racine, à remplacer par la page d'accueil).
2. **Le Studio sur `studio.amatencio.com`**, deux espaces. Ce qui bouge : le
   `basePath` (`/studio` → racine du sous-domaine), `productionUrl` et les
   aperçus (adresses absolues par site), `/studio-probe`, la protection Caddy.
3. **Le monorepo et les sous-domaines** : `apps/photo`, `apps/blog`, paquet de
   charte ; DNS chez Hetzner (zone, pas OVH), blocs Caddy, un script de
   reconstruction et un webhook par site ; `amatencio.com` →
   `photo.amatencio.com` en attendant la page d'accueil.
4. **La bascule SEO du site photo** — à part, c'est le seul point risqué : 301
   page par page de `amatencio.com/*` vers `photo.amatencio.com/*`,
   `NEXT_PUBLIC_SITE_URL` (jamais dans `.env.local`, CLAUDE.md §2.1), canonicals,
   sitemap, Search Console (changement d'adresse). Quelques semaines de
   flottement à prévoir.
5. **`design.amatencio.com`**, quand les designs existent.

## Points de vigilance

- **Le dépôt est PUBLIC.** Les commits `a4a5858` et antérieurs de
  `feat/journal-prototype` contiennent les brouillons des articles
  (`content/journal/`, `lib/journal/prototype-article.ts`). Ne pas pousser
  cette branche telle quelle : fusionner par un squash qui ne garde que l'état
  final, ou réécrire l'historique avant.
- **Dataset en lecture publique** : un article PUBLIÉ est lisible par l'API,
  notes « à trancher » comprises. Les brouillons ne le sont pas (vérifié le
  2026-10-17 : 0 visible sans jeton).
- **Voir les brouillons en local** demande `SANITY_API_READ_TOKEN` (Viewer)
  dans `.env.local` — n'agit qu'en dev (`lib/sanity/client.ts`).
