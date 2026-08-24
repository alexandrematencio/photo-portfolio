import { buildMetadata } from '@/lib/seo/metadata';
import { ProtectedEmail } from '@/components/site/ProtectedEmail';
import {
  EDITORIAL_ANNEX,
  EDITORIAL_BODY,
  EDITORIAL_BODY_LINK,
  EDITORIAL_H2,
  EDITORIAL_H3,
  EDITORIAL_LEAD,
} from '@/lib/site/typography';
import { PageShell } from '@/components/site/PageShell';

/**
 * Écart d'ouverture d'une section, en SUPPLÉMENT du `gap` de la colonne.
 *
 * Les deux pages en dur (`/legal`, `/privacy`) empilent leurs blocs dans un
 * flex à `gap` uniforme, là où le Portable Text pose ses marges bloc par bloc
 * (`RHYTHM`, PortableBody). Un gap uniforme donne le MÊME écart au-dessus et
 * en dessous d'un titre — or un titre appartient à ce qui le suit. Ce
 * supplément rétablit l'asymétrie : 24 (gap) + 40 = 64 au-dessus d'un H2,
 * 24 en dessous, soit exactement `RHYTHM.h2Top` / `RHYTHM.h2Bottom`.
 */
const SECTION_TOP = 40;

export const metadata = buildMetadata({
  title: 'Legal Notice',
  description: 'Legal information for amatencio.photo.',
  path: '/legal',
});

export default function LegalPage() {
  return (
    <PageShell title="LEGAL NOTICE">
      <div className="flex flex-col gap-6">
        <p className={EDITORIAL_LEAD}>
          Placeholder. Before going live, fill in the details required by French law (LCEN, art. 6 III) and the EU regulations applicable to publishers established in the European Union.
        </p>

        <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
          PUBLISHER
        </h2>

        <div className="flex flex-col gap-2 pb-4 md:pb-8">
          <h3 className={EDITORIAL_H3}>Editor of record</h3>
          {/* Registre ANNEXE : une fiche de coordonnées n'est pas du texte
              courant, elle se consulte. Cf. `EDITORIAL_ANNEX`. */}
          <p className={`${EDITORIAL_ANNEX} whitespace-pre-line`}>
            {`+ [Name / legal entity]
+ [Legal status, SIRET if applicable]
+ [Address]
+ [Email] · [Phone]
+ Publication director: [Name]`}
          </p>
        </div>

        <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
          HOSTING
        </h2>

        <p className={EDITORIAL_BODY}>
          Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA.
        </p>

        <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
          INTELLECTUAL PROPERTY
        </h2>

        <p className={EDITORIAL_BODY}>
          All photographs and texts published on this site are protected by copyright. Any reproduction, even partial, is forbidden without prior written authorization.
        </p>

        <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
          CONTACT
        </h2>

        <ProtectedEmail className={EDITORIAL_BODY_LINK}>
          Get in touch by email
        </ProtectedEmail>
      </div>
    </PageShell>
  );
}
