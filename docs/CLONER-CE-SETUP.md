# Réutiliser ce setup comme base pour un autre projet

Ce document est **portable sur la stack Next.js 16 + Sanity v5 + Tailwind v4 + GH Pages (ou Vercel)**. La plupart des sections sont génériques ; certaines contiennent des spécificités à customiser au clonage.

**Sections génériques (réutilisables sans édition)** :
- **§2** stack · **§3** UX/motion/perf · **§4** a11y (WCAG 2.2 AA + EAA) · **§5** SEO · **§6** RGPD · **§7** conventions de code.
- **§8** workflow & guardrails — dont **§8.4** (Studio → site déployé) et **§8.5** (no-hardcoded editable content), génériques pour tout projet headless-CMS + static export.
- **§9** références externes + memory files (`memory/lightbox_carousel_contract.md`, `memory/sanity_publish_workflow.md`) — patterns réutilisables, adapter le frontmatter au projet.

**Sections à customiser au clonage** :
- **§1 Contexte projet** — à remplacer intégralement (nature, disciplines, propriétaire, langue, public, objectif, promesse).
- **§3.4 Galerie & lightbox** — UX du composant `PhotoLightbox` carousel ; spécifique aux portfolios photo, à retirer ou adapter pour un autre type de site. **Spec visuelle dans le brand book**, pas ici.
- **§10 — stub** : créer un nouveau `brand/brand-book.md` propre au projet ; §10 reste un stub.
- **§11 Sanity Studio customization** — schémas (`photo`, `series`, `siteSettings`), structure multi-axes, Tableau de bord, preview pane Prod/Local. À retravailler intégralement selon le modèle de contenu du nouveau projet, mais le **pattern d'architecture Studio** (single source of truth `sanity/studio.config.ts`, singleton hardened, preview pane context-aware) reste valide.
- **Constantes & IDs hardcodés** : `projectId` Sanity, `basePath` GH Pages, nom du photographe / propriétaire dans les titres + metadata + Co-Authored-By des commits.

**Checklist clonage rapide** : 1. remplacer `§1` (Contexte projet) intégralement. 2. créer un nouveau `brand/brand-book.md` pour les tokens design (`§10` stub inchangé). 3. reconfigurer `§11` (ou supprimer si pas de Sanity), en gardant le pattern d'architecture. 4. régénérer les schémas `sanity/schemas/*.ts`. 5. modifier `next.config.ts` (`basePath`, remotePatterns) + `lib/sanity/env.ts` (projectId, dataset).


---

*Extrait de `CLAUDE.md` (§0) le 2026-08-22 : ce guide ne sert qu'au moment de cloner le
setup vers un autre projet, jamais pendant le travail sur celui-ci.*
