import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteSettings } from '@/lib/sanity/queries';
import { PortableBody } from '@/components/site/PortableBody';
import { ProtectedEmail } from '@/components/site/ProtectedEmail';
import {
  EDITORIAL_ANNEX,
  EDITORIAL_BODY,
  EDITORIAL_BODY_LINK,
  EDITORIAL_H2,
  EDITORIAL_H3,
  EDITORIAL_LEAD,
  EDITORIAL_LINK_DECORATION,
} from '@/lib/site/typography';
import { PageShell } from '@/components/site/PageShell';
import { AUTHOR_NAME } from '@/lib/site/author';

/**
 * Écart d'ouverture d'une section, en SUPPLÉMENT du `gap` de la colonne.
 *
 * Le REPLI ci-dessous empile ses blocs dans un flex à `gap` uniforme, là où le
 * Portable Text pose ses marges bloc par bloc (`RHYTHM`, PortableBody). Un gap
 * uniforme donne le MÊME écart au-dessus et en dessous d'un titre — or un titre
 * appartient à ce qui le suit. Ce supplément rétablit l'asymétrie : 24 (gap) +
 * 40 = 64 au-dessus d'un H2, 24 en dessous, soit `RHYTHM.h2Top` / `h2Bottom`.
 */
const SECTION_TOP = 40;

export const metadata = buildMetadata({
  title: 'Legal Notice',
  description:
    'Legal information, copyright and licensing terms for the photographs of A. Matencio.',
  path: '/legal',
});

export const revalidate = 300;

/**
 * Repli, affiché tant que `siteSettings.legalBody` est vide (CLAUDE.md §8.5 :
 * Sanity est la source de vérité, ceci n'est qu'un filet). L'identité de
 * l'éditeur reste entre crochets EXPRÈS : seul Alexandre la connaît, et il la
 * saisit dans le Studio (Réglages du site → Page « Legal notice »). Tout le
 * reste — hébergeur, propriété intellectuelle, licence, opposition TDM — est
 * exact et publiable tel quel.
 */
function LegalFallback() {
  return (
    <div className="flex flex-col gap-6">
      <p className={EDITORIAL_LEAD}>
        This site is published by {AUTHOR_NAME}, photographer. The information
        below is provided under French law (LCEN, art. 6 III) and the EU
        regulations applicable to publishers established in the European Union.
      </p>

      <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
        PUBLISHER
      </h2>

      <div className="flex flex-col gap-2 pb-4 md:pb-8">
        <h3 className={EDITORIAL_H3}>Editor of record</h3>
        {/* Registre ANNEXE : une fiche de coordonnées n'est pas du texte
            courant, elle se consulte. Cf. `EDITORIAL_ANNEX`. */}
        <p className={`${EDITORIAL_ANNEX} whitespace-pre-line`}>
          {`+ ${AUTHOR_NAME}
+ [Legal status, SIRET if applicable]
+ [Address]
+ Publication director: ${AUTHOR_NAME}`}
        </p>
      </div>

      <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
        HOSTING
      </h2>

      <p className={EDITORIAL_BODY}>
        Pages are hosted by GitHub, Inc., 88 Colin P. Kelly Jr. Street, San
        Francisco, CA 94107, USA (GitHub Pages). Images are delivered by the
        content network of Sanity AS, Oslo, Norway.
      </p>

      <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
        COPYRIGHT AND LICENSING
      </h2>

      <p className={EDITORIAL_BODY}>
        All photographs and texts published on this site are the exclusive
        property of {AUTHOR_NAME} and are protected by the French Intellectual
        Property Code (art. L.111-1 and following) and by international
        copyright treaties. All rights reserved.
      </p>

      <p className={EDITORIAL_BODY}>
        No photograph may be reproduced, downloaded, stored, modified,
        redistributed, published, used to train or evaluate machine-learning
        models, or otherwise exploited, in whole or in part, without the prior
        written permission of the author. Licences for editorial, exhibition and
        commercial use are granted on request:{' '}
        <ProtectedEmail className={EDITORIAL_LINK_DECORATION}>
          ask for a licence
        </ProtectedEmail>
        . Any unauthorised use will be invoiced at the rates in force and may
        give rise to legal proceedings.
      </p>

      <p className={EDITORIAL_BODY}>
        Text and data mining: the rightsholder expressly reserves the rights
        provided for in Article 4 of Directive (EU) 2019/790. This reservation
        is also expressed in machine-readable form on every page of this site.
      </p>

      <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
        CONTACT
      </h2>

      <ProtectedEmail className={EDITORIAL_BODY_LINK}>
        Get in touch by email
      </ProtectedEmail>
    </div>
  );
}

export default async function LegalPage() {
  const settings = await getSiteSettings();
  return (
    <PageShell title="LEGAL NOTICE">
      <PortableBody
        value={settings?.legalBody}
        variant="editorial"
        fallback={<LegalFallback />}
      />
    </PageShell>
  );
}
