import type { JsonLdObject } from '@/lib/seo/jsonld';

/**
 * Un bloc JSON-LD. `<` est échappé en `\u003c` : le JSON est injecté tel quel
 * dans un <script>, et une chaîne CMS contenant `</script>` fermerait la balise.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
