# Blocs retirés de CLAUDE.md le 2026-08-22 (filet de récupération)

> `CLAUDE.md` est **gitignoré** dans ce projet : il n'a donc pas d'historique git.
> Ce fichier-ci est versionné et conserve, à l'identique, les blocs supprimés lors de
> l'allègement du 2026-08-22 — ceux jugés **dérivables du code** (à la différence de
> l'historique, de la doc Studio et du guide de clonage, qui ont été *déplacés* vers
> `docs/JOURNAL-CLAUDE.md`, la skill `sanity-studio` et `docs/CLONER-CE-SETUP.md`).
>
> Rien ici n'est censé manquer à une session : soit l'information se relit dans le code,
> soit c'est un standard que le modèle connaît. À restaurer par copier-coller si l'un de
> ces blocs se révélait utile.

---

## §7.1 — Arborescence (état du 2026-05-27)

Retirée parce qu'un `ls` la donne, et qu'elle dérivait à chaque livraison. Les pièces
sensibles ★ et les conventions transverses ont été conservées dans `CLAUDE.md`.

```
app/
  (site)/                          # route group public
    page.tsx                       # / — homepage scroll-physics
    about/page.tsx
    contact/page.tsx
    digital-agency/page.tsx
    socials/page.tsx
    archives/page.tsx              # /archives (honore #photo-<slug>)
    legal/page.tsx                 # /legal (stub)
    privacy/page.tsx               # /privacy (stub)
  studio/[[...tool]]/
    page.tsx                       # routes /studio (force-static)
    Studio.tsx                     # 'use client' wrapper NextStudio
  layout.tsx
  globals.css                      # tokens + Tailwind v4
  sitemap.ts
  robots.ts

components/
  series/                          # page /series (voir §3.7 + spec)
    SeriesExperience.tsx           # ★ porteur d'état unique (série ouverte + photo active), ancre
    desktop/                       # rangée de piles, vue 3 colonnes, vols de clones (animations.ts ★)
    mobile/                        # liste verticale, dépliage Flip, sorties via modalHistory
    shared/SeriesMeta.tsx          # bloc année/lieu/boîtier/objectif (lignes vides masquées)
  gallery/
    ScrollPhysicsGallery.tsx       # home hero, GSAP physics
    FlatGallery.tsx                # masonry, hash deep-link
    PhotoBlock.tsx                 # bloc home
    PhotoCard.tsx                  # carte archives (id={`photo-${slug}`})
    PhotoLightbox.tsx              # carousel lightbox (voir §3.4)
    Placeholder.tsx
  layout/                          # nav, footer, MainPadding
  motion/                          # presets GSAP partagés

lib/
  sanity/
    client.ts                      # createClient gated previewDrafts/published
    env.ts                         # env vars + isSanityConfigured
    image.ts                       # urlFor wrapper @sanity/image-url
    queries.ts                     # GROQ + types (Photo, Series, SiteSettings)
  utils/                           # cn, helpers divers
  seo/                             # (à venir : metadata + JSON-LD)

sanity/
  studio.config.ts                 # ★ single source of truth pour le Studio (cf. §11.1)
  schemas/
    index.ts                       # array schemaTypes
    photo.ts                       # schema photo (styles 1–3, camera/lens refs, `series` warning)
    series.ts                      # schema series (slug isUnique, coverPhoto ref)
    taxonomies.ts                  # factory documents style / camera / lens (title, slug, aliases)
    siteSettings.ts                # singleton (dont `curation` — array ordonné de refs photo)
  structure/
    index.ts                       # buildStructure(S, ctx) — multi-axes
  tools/
    Dashboard.tsx                  # composant tool React (4 cartes)
    index.ts                       # export dashboardTool
  preview/
    PhotoPreviewView.tsx           # iframe pane photo (Prod/Local toggle)
    SiteSettingsPreviewView.tsx    # idem singleton

scripts/
  dev-shot.mjs                     # vérification visuelle Playwright (captures, séquences, clics ordonnancés, --mobile, --reduced)
  upload-photos.ts                 # bulk upload depuis portfolio/ (parse convention de nommage + EXIF)
  taxonomy-helpers.ts              # slugify / titleCase / normalizeForMatch + seed styles
  migrate-taxonomy.ts              # one-shot category→styles + onHomepage/order→curation (dry-run par défaut)
  set-hero.ts                      # upload les 2 images du hero dans siteSettings.hero
  wipe-photos.ts                   # dry-run / wipe photos + assets
  audit-photos-without-series.ts   # ★ read-only audit

public/                            # img/logos/glyph-alxmtnc.svg, fonts
portfolio/                         # photos source (gitignore) — pipeline upload
brand/                             # brand-book.md (gitignore, maintainer only)
doc/
  guidelines.md                    # référentiel opérationnel photographe
  html-script-reference.md         # référence scripts existants

NOMENCLATURE-PHOTOS.md             # ★ guide public (VERSIONNÉ) — convention de nommage des fichiers photo
sanity.config.ts                   # re-export depuis sanity/studio.config.ts (CLI standalone)
next.config.ts                     # output:'export' gated en prod
package.json                       # scripts npm (cf. §11.10)
CLAUDE.md                          # ce fichier (référentiel technique)
```

---

## §4 — Règles techniques a11y (liste complète)

Retirées parce que ce sont les critères WCAG 2.2 AA eux-mêmes. La cible et les points
propres au site (alt sensoriel, figure/figcaption, clavier lightbox et `/series`,
reduced-motion, skip link) sont restés dans `CLAUDE.md`.

- HTML sémantique strict : `<main>`, `<nav>`, `<article>`, `<section>`, `<figure>` + `<figcaption>` pour chaque photo.
- **Alt text obligatoire** sur chaque image. Pour les photos d'auteur : description sensorielle courte (lieu, sujet, ambiance), pas de keyword stuffing. Décoratif uniquement → `alt=""`.
- Focus visible toujours (contour 2 px minimum, contraste 3:1).
- Navigation clavier complète (Tab, Shift+Tab, Enter, Esc, flèches dans lightbox).
- ARIA seulement si HTML natif ne suffit pas. Pas d'ARIA décoratif.
- `prefers-reduced-motion` respecté partout (cf. §3.2).
- `prefers-color-scheme` respecté si thème clair/sombre proposé.
- Skip link « Aller au contenu » en début de page.
- Contraste minimum : 4.5:1 texte normal, 3:1 texte large/UI.
- Pas de texte uniquement en image (sauf logo).
- Vidéo : sous-titres + transcription si contenu informatif.

---

## §5.1 — Architecture technique SEO (liste complète)

Retirée : standards, ou déjà implémentée dans `app/sitemap.ts`, `app/robots.ts`,
`lib/seo/metadata.ts`. La convention de slug photo, elle, est restée.

- **URLs** : minuscules, kebab-case, sans accent, sans paramètre inutile. Pas de `?id=123`. Exemple : `/series/paris-nuit-2025`.
- **Slug photo** : `[année]-[lieu-court]-[sujet]`. Ex : `2025-tokyo-shinjuku-pluie.jpg`.
- **Sitemap** : `app/sitemap.ts` Next.js, régénéré à chaque build, soumis à Google Search Console.
- **Robots** : `app/robots.ts` — autoriser tout sauf `/api/`, `/admin/`, brouillons.
- **Canonical** : balise canonical sur chaque page (auto via metadata API Next.js).
- **Hreflang** : si i18n active, balises `hreflang` correctes (`fr`, `en`, `x-default`).

---

## §5.2 — Pattern `generateMetadata`

Retiré : implémenté à l'identique dans `lib/seo/metadata.ts` (`buildMetadata()`), qui est
désormais la seule voie autorisée pour les metadata de page.

```ts
// Pattern (le siteName et la formulation viennent du brand book) :
{
  title: '...',           // 50–60 caractères
  description: '...',     // 140–160 caractères, accroche + bénéfice + mot-clé principal
  openGraph: {
    title, description,
    type: 'website' | 'article' | 'profile',
    images: [{ url, width: 1200, height: 630, alt }],
    locale: 'en_US',
    siteName: '<brand book §X>',
  },
  twitter: { card: 'summary_large_image', ... },
  alternates: { canonical, languages: { 'en-US': ... } /* + 'fr-FR' si i18n réactivée */ },
}
```

---

## §5.6 — Performance SEO

Retiré : doublon de §3.5 (Core Web Vitals).

- Core Web Vitals dans le vert (cf. §3.5) — facteur de classement direct.
- HTTPS strict (HSTS).
- Mobile-first : design pensé mobile d'abord, testé sur device réel.

---

## §6.1 — Principes RGPD

Retiré : énoncé du cadre légal. Les engagements concrets du site (§6.2 données, §6.4 pages,
§6.6 transferts, §6.7 droit à l'image) sont restés dans `CLAUDE.md`.

> Le site doit être conforme au **RGPD (UE 2016/679)**, à la **loi Informatique et Libertés
> modifiée**, et aux recommandations **CNIL** (notamment lignes directrices cookies &
> traceurs du 17 sept. 2020 mises à jour).

---

## §6.3 — Cookies & traceurs (version longue)

Résumé dans `CLAUDE.md` (position « zéro cookie non essentiel » + exigences CMP en une
phrase). Version d'origine :

- **Par défaut, ZÉRO cookie non essentiel** sur ce site (recommandation forte).
- Si un cookie/traceur soumis à consentement doit être ajouté → **bandeau CMP conforme CNIL** :
  - Refus aussi simple que l'acceptation (boutons même niveau visuel).
  - Pas de pré-cochage.
  - Pas de scroll/navigation = consentement (interdit).
  - Choix granulaire par finalité.
  - Refus persistant ≥ 6 mois.
- Solutions recommandées : Axeptio, Didomi, ou maison si simple.

---

## §6.8 — Sécurité technique (liste complète)

Résumée dans `CLAUDE.md` (les deux points propres au projet : aucun log de données
personnelles, headers impossibles avant Vercel, CSP à scoper pour le pane preview).

- HTTPS strict, HSTS preload.
- Headers de sécurité : `Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- Mots de passe admin : hashage Argon2id si self-hosted, sinon déléguer à Clerk/Auth0.
- Backups chiffrés.
- Pas de logs de données personnelles sensibles.
