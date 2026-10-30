import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Card, Flex, Text } from '@sanity/ui';
import { useClient } from 'sanity';
import { BLOG_URL } from '@/lib/site/sites';
import { AUTHOR_JOURNAL_SIGNATURE } from '@/lib/site/author';
import { isLang } from '@/lib/journal/i18n';
import type { RawImage, RawPost, RawSeries } from '@/lib/journal/convert';
import { PREVIEW_PATH, PREVIEW_READY, PREVIEW_UPDATE, type PreviewPayload } from '@/lib/journal/preview';

/**
 * Onglet « Aperçu » d'un article du journal (2026-10-18, demande Alexandre :
 * voir l'article dans sa page finale AVANT de publier).
 *
 * L'iframe charge la page d'aperçu du BLOG (`/apercu/`, son vrai layout) et
 * ce composant lui envoie le brouillon par `postMessage` à chaque frappe
 * (300 ms de calme). Le brouillon ne quitte jamais le navigateur pour un
 * serveur : c'est le Studio, connecté, qui lit, la page du blog ne fait que
 * dessiner.
 *
 * Une traduction emprunte date, série, partie et couverture à son original,
 * comme au build (`postsQuery`) ; le tout est lu en perspective `drafts`
 * pour qu'une série ou un original pas encore publiés s'affichent aussi.
 *
 * En local, l'aperçu demande le serveur du blog (`npm run dev:blog`, port 3011).
 */

type Displayed = {
  language?: string;
  translationOf?: { _ref?: string };
  slug?: { current?: string };
  title?: string;
  dek?: string;
  date?: string;
  series?: { _ref?: string };
  part?: number;
  cover?: RawImage;
  referencesNote?: string;
  aiNote?: RawPost['aiNote'];
  body?: RawPost['body'];
  references?: RawPost['references'];
};

type Original = { date?: string; seriesId?: string; part?: number; cover?: RawImage } | null;

type Extras = {
  original: Original;
  series: RawSeries | null;
  siblings: PreviewPayload['siblings'];
  signature: string | null;
};

const PREVIEW_URL = `${BLOG_URL}${PREVIEW_PATH}`;
const BLOG_ORIGIN = new URL(BLOG_URL).origin;

export function ArticlePreviewView({ document }: { document: { displayed: Displayed } }) {
  const d = document.displayed;
  const baseClient = useClient({ apiVersion: '2025-02-19' });
  // `withConfig` rend un client NEUF à chaque appel : sans mémo, chaque rendu
  // relançait la lecture des extras, dont le retour re-rendait, et le délai
  // de 300 ms n'arrivait jamais au bout — l'aperçu restait vide.
  const client = useMemo(() => baseClient.withConfig({ perspective: 'drafts' }), [baseClient]);
  const frame = useRef<HTMLIFrameElement>(null);
  // Compte les montages de la page d'aperçu : chacun réclame l'état courant.
  const [ready, setReady] = useState(0);
  const [extras, setExtras] = useState<Extras | null>(null);

  const lang = isLang(d.language) ? d.language : 'fr';
  const originalId = lang === 'fr' ? null : (d.translationOf?._ref ?? null);
  const ownSeriesId = d.series?._ref ?? null;

  // Ce que le brouillon ne contient pas : l'original d'une traduction, la
  // série, ses autres articles, la signature. Relu quand un de ces liens change.
  useEffect(() => {
    let live = true;
    (async () => {
      const original = originalId
        ? await client.fetch<Original>(
            `*[_id == $id][0]{ date, "seriesId": series._ref, part, cover }`,
            { id: originalId },
          )
        : null;
      const seriesId = originalId ? (original?.seriesId ?? null) : ownSeriesId;
      const [series, siblings, signature] = await Promise.all([
        seriesId
          ? client.fetch<RawSeries | null>(
              `*[_id == $id][0]{ _id, "slug": slug.current, title, description, translations }`,
              { id: seriesId },
            )
          : null,
        seriesId
          ? client.fetch<PreviewPayload['siblings']>(
              `*[_type == "post" && coalesce(translationOf->series._ref, series._ref) == $id && coalesce(language, "fr") == $lang]{
                "slug": slug.current, title, "part": coalesce(translationOf->part, part)
              }`,
              { id: seriesId, lang },
            )
          : [],
        client.fetch<string | null>(
          `*[_id == "journalSettings"][0]{ "s": select($lang == "fr" => signature, translations[$lang].signature) }.s`,
          { lang },
        ),
      ]);
      if (live) setExtras({ original, series, siblings, signature });
    })().catch(() => live && setExtras({ original: null, series: null, siblings: [], signature: null }));
    return () => {
      live = false;
    };
  }, [client, originalId, ownSeriesId, lang]);

  const payload = useMemo<PreviewPayload | null>(() => {
    if (!extras) return null;
    const o = extras.original;
    return {
      raw: {
        slug: d.slug?.current ?? '',
        lang,
        group: '',
        title: d.title ?? '',
        dek: d.dek ?? '',
        date: (originalId ? o?.date : d.date) ?? null,
        publishedAt: '',
        seriesId: (originalId ? o?.seriesId : ownSeriesId) ?? null,
        part: (originalId ? o?.part : d.part) ?? null,
        referencesNote: d.referencesNote ?? null,
        aiNote: d.aiNote ?? [],
        cover: originalId ? o?.cover : d.cover,
        body: d.body ?? [],
        references: d.references ?? [],
      },
      series: extras.series,
      siblings: extras.siblings.filter((s) => s.slug),
      signature: extras.signature?.trim() || AUTHOR_JOURNAL_SIGNATURE[lang],
    };
  }, [d, extras, lang, originalId, ownSeriesId]);

  // La page d'aperçu se signale une fois montée.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === BLOG_ORIGIN && e.data?.type === PREVIEW_READY) setReady((n) => n + 1);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Chaque modification part après 300 ms de calme : pas un rendu par frappe.
  useEffect(() => {
    if (!ready || !payload) return;
    const id = window.setTimeout(() => {
      frame.current?.contentWindow?.postMessage({ type: PREVIEW_UPDATE, payload }, BLOG_ORIGIN);
    }, 300);
    return () => window.clearTimeout(id);
  }, [ready, payload]);

  return (
    <Flex direction="column" style={{ height: '100%', minHeight: 400 }}>
      <Card padding={3} borderBottom>
        <Text size={1} muted>
          L’article tel qu’il paraîtra, brouillon compris. Rien n’est publié tant que tu ne cliques pas sur « Publish ».
        </Text>
      </Card>
      <Box flex={1} style={{ position: 'relative', minHeight: 0 }}>
        <iframe
          ref={frame}
          src={PREVIEW_URL}
          title="Aperçu de l’article"
          style={{ width: '100%', height: '100%', border: 0, background: '#fafaf8' }}
        />
      </Box>
    </Flex>
  );
}
