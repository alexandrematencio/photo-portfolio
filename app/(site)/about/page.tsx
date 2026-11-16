import { buildMetadata } from '@/lib/seo/metadata';
import { contactBlocks, getSiteSettings } from '@/lib/sanity/queries';
import { PortableBody } from '@/components/site/PortableBody';
import { EDITORIAL_BODY } from '@/lib/site/typography';
import { PageShell } from '@/components/site/PageShell';
import { TextReveal } from '@/components/site/TextReveal';
import { ContactAside } from '@/components/site/ContactAside';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, personJsonLd } from '@/lib/seo/jsonld';
import { SEO_DEFAULTS } from '@/lib/seo/defaults';
import { AUTHOR_FULL_NAME } from '@/lib/site/author';
import { HUB_URL, hubHref } from '@/lib/site/sites';
import { AboutExtras } from '@/components/journal/AboutPage';

/**
 * LA page About — la seule des sites, hors celle du journal (2026-10-22).
 * Construite ici, servie par Caddy sous `amatencio.com/about/` : la canonical
 * et le fil d'Ariane désignent donc le hub, pas le portfolio.
 *
 * Trois étages depuis le 2026-11-16, comme « À propos de ce journal » : le
 * texte principal, un encart de questions toujours ouvert, des compléments
 * repliés (`AboutExtras`, mêmes champs que le journal). Le bloc DIGITAL AGENCY
 * qui suivait a été retiré le même jour : il doublait le texte (AAXLO y est
 * présenté, et lié par son logo).
 *
 * Titre et description : Studio → Pages → About → « Référencement (Google) ».
 */
export async function generateMetadata() {
  const seo = (await getSiteSettings())?.aboutSeo;
  return buildMetadata({
    absoluteTitle: seo?.title?.trim() || SEO_DEFAULTS.about.title,
    description: seo?.description?.trim() || SEO_DEFAULTS.about.description,
    path: '/about',
    origin: hubHref(''),
    siteName: AUTHOR_FULL_NAME,
  });
}

export const revalidate = 300;

// Fallback only — used when `aboutPage.body` is empty (initial Sanity
// state, or local dev without a configured client). CLAUDE.md §8.5: Sanity is
// the single source of truth for every editable section here (bio, gear, lens
// lists, anything the photographer might rephrase). Don't grow this fallback
// to mirror current Sanity content — that would re-introduce the divergence
// bug it exists to prevent.
const BIO_FALLBACK = `I’m 🇫🇷🇪🇸🇻🇳, I grew up in the 🇳🇱, and worked in 🇹🇳 🇻🇳 and now in 🇫🇷.

Art Director for 8 years, photographer by way of cinema. Edit this copy from Studio (Réglages du site → Page "About") to take over.`;

export default async function AboutPage() {
  const settings = await getSiteSettings();
  const aboutBody = settings?.aboutBody;
  // Les étages ne se montrent que si le Studio en a publié ; `body` n'est pas
  // lu par `AboutExtras`, il rend seulement l'encart et les compléments.
  const extras = {
    body: null,
    questionsTitle: settings?.aboutQuestionsTitle ?? null,
    questions: settings?.aboutQuestions ?? null,
    sectionsTitle: settings?.aboutSectionsTitle ?? null,
    sections: settings?.aboutSections ?? null,
  };

  return (
    <>
      <JsonLd
        data={[
          personJsonLd(),
          breadcrumbJsonLd([
            { name: 'Home', url: HUB_URL },
            { name: 'About', url: hubHref('/about/') },
          ]),
        ]}
      />
      <PageShell title="ABOUT">
        {/* Deux zones dans la colonne de 1107 : la bio, calée à gauche sur sa
            mesure, et l'encart Contact (Contact a quitté le menu le
            2026-10-17). Au-dessus de `lg`, l'encart prend la colonne de droite
            que la mesure laisse libre, et reste en vue au défilement ; en
            dessous, il passe en tête, entre le titre et la bio. L'encart est
            PREMIER dans le DOM : c'est l'ordre lu sur téléphone. */}
        <div className="grid grid-cols-1 gap-y-12 lg:grid-cols-[minmax(0,var(--editorial-measure))_minmax(0,1fr)] lg:gap-x-16">
          <ContactAside
            blocks={contactBlocks(settings)}
            className="max-w-[var(--editorial-measure)] lg:col-start-2 lg:row-start-1 lg:sticky lg:top-8 lg:self-start lg:justify-self-end lg:w-full lg:max-w-[300px]"
          />
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <TextReveal>
              <PortableBody
                value={aboutBody}
                variant="editorial"
                fallback={
                  <p className={`${EDITORIAL_BODY} whitespace-pre-line`}>
                    {BIO_FALLBACK}
                  </p>
                }
              />
            </TextReveal>
            <AboutExtras about={extras} />
          </div>
        </div>
      </PageShell>
    </>
  );
}
