import type { Exif } from 'sharp';
import { AUTHOR_NAME, copyrightNotice } from '../lib/site/author';

/**
 * Métadonnées de droits écrites dans CHAQUE fichier déposé chez Sanity.
 *
 * Franchise obligatoire : le CDN de Sanity les efface à la livraison (mesuré,
 * cf. prepare-image.ts en tête). Elles ne protègent donc pas le site. Elles
 * sont écrites quand même parce que (a) le fichier STOCKÉ les garde — si les
 * images changent d'hébergement un jour, le catalogue est déjà signé ; (b) le
 * même module signe `og-default.jpg`, servi par GitHub Pages sans
 * transformation, la seule image du site dont les métadonnées atteignent le
 * visiteur ; (c) ça ne coûte rien.
 *
 * Trois registres, parce que les lecteurs ne lisent pas les mêmes : EXIF
 * `Artist`/`Copyright` (le plus ancien, lu partout), XMP Dublin Core
 * (`dc:creator`, `dc:rights` — ce que Lightroom, Photoshop et Google lisent),
 * XMP Rights (`Marked`, `WebStatement`) et PLUS (`Licensor`) — ce que Google
 * Images utilise pour le badge « Licensable » quand le fichier arrive intact.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  'https://alexandrematencio.github.io/photo-portfolio';

export const RIGHTS_URL = `${SITE_URL}/legal/`;
export const LICENSOR_URL = `${SITE_URL}/contact/`;

export function exifRights(year?: number): Exif {
  return {
    IFD0: {
      Artist: AUTHOR_NAME,
      Copyright: copyrightNotice(year),
    },
  };
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function xmpRights(year?: number): string {
  const author = xmlEscape(AUTHOR_NAME);
  const notice = xmlEscape(copyrightNotice(year));
  return (
    `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">` +
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
    `<rdf:Description rdf:about=""` +
    ` xmlns:dc="http://purl.org/dc/elements/1.1/"` +
    ` xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"` +
    ` xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"` +
    ` xmlns:plus="http://ns.useplus.org/ldf/xmp/1.0/"` +
    ` photoshop:Credit="${author}"` +
    ` xmpRights:Marked="True"` +
    ` xmpRights:WebStatement="${xmlEscape(RIGHTS_URL)}">` +
    `<dc:creator><rdf:Seq><rdf:li>${author}</rdf:li></rdf:Seq></dc:creator>` +
    `<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${notice}</rdf:li></rdf:Alt></dc:rights>` +
    `<plus:Licensor><rdf:Seq><rdf:li rdf:parseType="Resource">` +
    `<plus:LicensorName>${author}</plus:LicensorName>` +
    `<plus:LicensorURL>${xmlEscape(LICENSOR_URL)}</plus:LicensorURL>` +
    `</rdf:li></rdf:Seq></plus:Licensor>` +
    `</rdf:Description></rdf:RDF></x:xmpmeta>` +
    `<?xpacket end="w"?>`
  );
}
