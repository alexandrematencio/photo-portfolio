import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Spinner,
  Stack,
  Text,
} from '@sanity/ui';
import {
  ImageIcon,
  WarningOutlineIcon,
  EditIcon,
  ClockIcon,
  AddIcon,
  CogIcon,
  EarthGlobeIcon,
  StarIcon,
} from '@sanity/icons';
import imageUrlBuilder from '@sanity/image-url';
import { useClient } from 'sanity';
import { IntentLink } from 'sanity/router';

const API_VERSION = '2026-01-01';

const DASHBOARD_QUERY = /* groq */ `
{
  "curation": *[_id == "siteSettings"][0].curation[]->{
    _id, title, "slug": slug.current, image
  },
  "photosWithoutStyles": *[_type == "photo" && (!defined(styles) || count(styles) == 0)]
    | order(_updatedAt desc) [0...20] { _id, title, year },
  "photosWithoutGear": *[_type == "photo" && (!defined(camera) || !defined(lens))]
    | order(_updatedAt desc) [0...20] {
      _id, title, year,
      "missing": select(
        !defined(camera) && !defined(lens) => "boîtier + objectif",
        !defined(camera) => "boîtier",
        "objectif"
      )
    },
  "photosWithoutCaption": *[_type == "photo" && !defined(caption)]
    | order(_updatedAt desc) [0...20] { _id, title, year },
  "photosWithoutSeries": *[_type == "photo" && (!defined(series) || count(series) == 0)]
    | order(_updatedAt desc) [0...20] { _id, title, year },
  "emptySeries": *[_type == "series"] {
    _id, title,
    "photoCount": count(*[_type == "photo" && references(^._id)])
  } [photoCount == 0],
  "drafts": *[_id in path('drafts.**')] | order(_updatedAt desc) [0...20] {
    _id, _type, _updatedAt, title
  },
  "totals": {
    "photos": count(*[_type == "photo"]),
    "series": count(*[_type == "series"]),
    "styles": count(*[_type == "style" && !(_id in path('drafts.**'))]),
    "cameras": count(*[_type == "camera" && !(_id in path('drafts.**'))]),
    "lenses": count(*[_type == "lens" && !(_id in path('drafts.**'))])
  },
  "byStyle": *[_type == "style" && !(_id in path('drafts.**'))] | order(title asc) {
    _id, title,
    "count": count(*[_type == "photo" && ^._id in styles[]._ref])
  },
  "axisRows": *[_type == "photo"]{
    year, location, "camera": camera->title, "lens": lens->title
  },
  "recent": *[_type == "photo"] | order(_updatedAt desc) [0...8] {
    _id, title, _updatedAt, image, location, year
  }
}
`;

type DocRow = { _id: string; title?: string; year?: number };

type DashboardData = {
  curation:
    | ({ _id: string; title: string; slug: string; image?: SanityImageish } | null)[]
    | null;
  photosWithoutStyles: DocRow[];
  photosWithoutGear: (DocRow & { missing: string })[];
  photosWithoutCaption: DocRow[];
  photosWithoutSeries: DocRow[];
  emptySeries: { _id: string; title: string; photoCount: number }[];
  drafts: { _id: string; _type: string; _updatedAt: string; title?: string }[];
  totals: {
    photos: number;
    series: number;
    styles: number;
    cameras: number;
    lenses: number;
  };
  byStyle: { _id: string; title: string; count: number }[];
  axisRows: {
    year?: number;
    location?: string;
    camera?: string | null;
    lens?: string | null;
  }[];
  recent: {
    _id: string;
    title: string;
    _updatedAt: string;
    image?: SanityImageish;
    location?: string;
    year?: number;
  }[];
};

type SanityImageish = { asset?: { _ref: string } };

function publishedId(id: string): string {
  return id.startsWith('drafts.') ? id.slice('drafts.'.length) : id;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return 'à l’instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `il y a ${diffD} j`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

/** Agrège { valeur → nombre de photos } sur un axe, trié par count desc. */
function tally(
  rows: DashboardData['axisRows'],
  pick: (r: DashboardData['axisRows'][number]) => string | null | undefined
): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const raw = pick(row);
    const label = raw == null || raw === '' ? '—' : String(raw);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'));
}

export function Dashboard() {
  const client = useClient({ apiVersion: API_VERSION });
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const builder = useMemo(() => imageUrlBuilder(client), [client]);
  const thumbUrl = useCallback(
    (image: SanityImageish | undefined, size: number): string | null => {
      if (!image?.asset?._ref) return null;
      return builder.image(image).width(size).height(size).fit('crop').url();
    },
    [builder]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.fetch<DashboardData>(DASHBOARD_QUERY);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const siteUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return (
      (process.env.NEXT_PUBLIC_SITE_URL ?? '') ||
      window.location.origin.replace('/studio', '')
    );
  }, []);

  return (
    <Box padding={4} style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Stack space={5}>
        <Flex align="center" justify="space-between">
          <Heading size={3}>Tableau de bord</Heading>
          <Flex gap={2} align="center">
            {loading && <Spinner muted />}
            <Button
              mode="ghost"
              text="Rafraîchir"
              onClick={() => load()}
              disabled={loading}
            />
          </Flex>
        </Flex>

        {error && (
          <Card padding={3} tone="critical" radius={2}>
            <Text size={1}>Erreur de chargement : {error}</Text>
          </Card>
        )}

        {data && (
          <>
            <StatsCard data={data} siteUrl={siteUrl} />
            <CurationCard data={data} thumbUrl={thumbUrl} />
            <CatalogueCard data={data} />
            <AlertsCard data={data} />
            <DraftsCard data={data} />
            <RecentCard data={data} thumbUrl={thumbUrl} />
          </>
        )}
      </Stack>
    </Box>
  );
}

type ThumbFn = (image: SanityImageish | undefined, size: number) => string | null;

// — Vue d'ensemble : compteurs + raccourcis —
function StatsCard({ data, siteUrl }: { data: DashboardData; siteUrl: string }) {
  const { totals } = data;
  const curated = (data.curation ?? []).filter(Boolean).length;
  return (
    <Card padding={4} radius={2} shadow={1}>
      <Stack space={4}>
        <Heading size={1}>Vue d&apos;ensemble</Heading>
        <Grid columns={[2, 3, 6]} gap={3}>
          <Stat label="Photos" value={totals.photos} />
          <Stat label="Curation" value={curated} />
          <Stat label="Séries" value={totals.series} />
          <Stat label="Styles" value={totals.styles} />
          <Stat label="Boîtiers" value={totals.cameras} />
          <Stat label="Objectifs" value={totals.lenses} />
        </Grid>
        <Flex gap={2} wrap="wrap">
          <IntentLink
            intent="create"
            params={{ type: 'photo' }}
            style={{ textDecoration: 'none' }}
          >
            <Button icon={AddIcon} text="Nouvelle photo" mode="default" tone="primary" />
          </IntentLink>
          <IntentLink
            intent="create"
            params={{ type: 'series' }}
            style={{ textDecoration: 'none' }}
          >
            <Button icon={AddIcon} text="Nouvelle série" mode="ghost" />
          </IntentLink>
          <IntentLink
            intent="edit"
            params={{ id: 'siteSettings', type: 'siteSettings' }}
            style={{ textDecoration: 'none' }}
          >
            <Button icon={StarIcon} text="Modifier la curation" mode="ghost" />
          </IntentLink>
          <IntentLink
            intent="edit"
            params={{ id: 'siteSettings', type: 'siteSettings' }}
            style={{ textDecoration: 'none' }}
          >
            <Button icon={CogIcon} text="Réglages du site" mode="ghost" />
          </IntentLink>
          {siteUrl && (
            <Button
              icon={EarthGlobeIcon}
              text="Ouvrir le site"
              mode="ghost"
              as="a"
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            />
          )}
        </Flex>
      </Stack>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card padding={3} radius={2} tone="transparent" border>
      <Stack space={2}>
        <Text size={0} muted>
          {label.toUpperCase()}
        </Text>
        <Heading size={2}>{value}</Heading>
      </Stack>
    </Card>
  );
}

// — La curation : la home telle qu'elle sortira, dans l'ordre —
type CurationEntry = {
  _id: string;
  title: string;
  slug: string;
  image?: SanityImageish;
};

function CurationCard({
  data,
  thumbUrl,
}: {
  data: DashboardData;
  thumbUrl: ThumbFn;
}) {
  const curation = (data.curation ?? []).filter((p): p is CurationEntry =>
    Boolean(p)
  );
  return (
    <Card padding={4} radius={2} shadow={1}>
      <Stack space={4}>
        <Flex align="center" gap={2}>
          <StarIcon />
          <Heading size={1}>La curation (home)</Heading>
          <Badge tone={curation.length > 0 ? 'primary' : 'caution'}>
            {curation.length}
          </Badge>
        </Flex>

        {curation.length === 0 ? (
          <Card padding={3} radius={2} tone="caution">
            <Text size={1}>
              Aucune photo curatée : la home est vide. Ouvre{' '}
              <strong>Réglages du site → Curation</strong> et ajoute des photos
              (glisser-déposer pour l&apos;ordre).
            </Text>
          </Card>
        ) : (
          <Flex gap={2} wrap="wrap">
            {curation.map((photo, i) => {
              const src = thumbUrl(photo.image, 160);
              return (
                <IntentLink
                  key={photo._id}
                  intent="edit"
                  params={{ id: publishedId(photo._id), type: 'photo' }}
                  style={{ textDecoration: 'none' }}
                >
                  <Card
                    radius={2}
                    tone="transparent"
                    border
                    style={{ width: 84, overflow: 'hidden' }}
                    title={photo.title}
                  >
                    <Box style={{ position: 'relative', width: 84, height: 84 }}>
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={photo.title}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <Flex
                          align="center"
                          justify="center"
                          style={{ width: '100%', height: '100%', opacity: 0.4 }}
                        >
                          <ImageIcon />
                        </Flex>
                      )}
                      <Badge
                        tone="default"
                        style={{ position: 'absolute', top: 4, left: 4 }}
                      >
                        {i + 1}
                      </Badge>
                    </Box>
                  </Card>
                </IntentLink>
              );
            })}
          </Flex>
        )}

        <Text size={0} muted>
          L&apos;ordre affiché = l&apos;ordre sur la home. Édition dans Réglages
          du site → Curation, puis Publish + <code>npm run deploy</code>.
        </Text>
      </Stack>
    </Card>
  );
}

// — Catalogue : répartition par axe —
function CatalogueCard({ data }: { data: DashboardData }) {
  const byYear = tally(data.axisRows, (r) => (r.year != null ? String(r.year) : null));
  const byLocation = tally(data.axisRows, (r) => r.location);
  const byCamera = tally(data.axisRows, (r) => r.camera);
  const byLens = tally(data.axisRows, (r) => r.lens);
  const byStyle = data.byStyle.map((s) => ({ label: s.title, count: s.count }));

  return (
    <Card padding={4} radius={2} shadow={1}>
      <Stack space={4}>
        <Heading size={1}>Catalogue par axe</Heading>
        <Grid columns={[1, 2, 5]} gap={4}>
          <AxisColumn title="Styles" rows={byStyle} />
          <AxisColumn title="Années" rows={byYear} />
          <AxisColumn title="Lieux" rows={byLocation} />
          <AxisColumn title="Boîtiers" rows={byCamera} />
          <AxisColumn title="Objectifs" rows={byLens} />
        </Grid>
      </Stack>
    </Card>
  );
}

function AxisColumn({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  const MAX = 8;
  const shown = rows.slice(0, MAX);
  return (
    <Stack space={3}>
      <Text size={0} weight="semibold" muted>
        {title.toUpperCase()}
      </Text>
      {shown.length === 0 ? (
        <Text size={1} muted>
          —
        </Text>
      ) : (
        <Stack space={2}>
          {shown.map((row) => (
            <Flex key={row.label} justify="space-between" gap={2}>
              <Text size={1} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {row.label}
              </Text>
              <Text size={1} muted>
                {row.count}
              </Text>
            </Flex>
          ))}
          {rows.length > MAX && (
            <Text size={0} muted>
              … et {rows.length - MAX} autre{rows.length - MAX > 1 ? 's' : ''}.
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  );
}

// — Alertes qualité —
function AlertsCard({ data }: { data: DashboardData }) {
  const {
    photosWithoutStyles,
    photosWithoutGear,
    photosWithoutCaption,
    photosWithoutSeries,
    emptySeries,
  } = data;
  const totalAlerts =
    photosWithoutStyles.length +
    photosWithoutGear.length +
    photosWithoutCaption.length +
    photosWithoutSeries.length +
    emptySeries.length;

  return (
    <Card padding={4} radius={2} shadow={1}>
      <Stack space={4}>
        <Flex align="center" gap={2}>
          <Box style={{ color: totalAlerts > 0 ? '#b8860b' : undefined }}>
            <WarningOutlineIcon />
          </Box>
          <Heading size={1}>Alertes qualité</Heading>
          <Badge tone={totalAlerts > 0 ? 'caution' : 'positive'}>{totalAlerts}</Badge>
        </Flex>

        {totalAlerts === 0 && (
          <Text size={1} muted>
            ✓ Aucune alerte. Catalogue complet et rangé.
          </Text>
        )}

        {photosWithoutStyles.length > 0 && (
          <AlertGroup
            title={`${photosWithoutStyles.length} photo${photosWithoutStyles.length > 1 ? 's' : ''} sans style`}
            items={photosWithoutStyles.map((p) => ({
              id: p._id,
              type: 'photo',
              label: `${p.title ?? p._id}${p.year ? ` (${p.year})` : ''}`,
            }))}
          />
        )}

        {photosWithoutGear.length > 0 && (
          <AlertGroup
            title={`${photosWithoutGear.length} photo${photosWithoutGear.length > 1 ? 's' : ''} sans matériel renseigné`}
            items={photosWithoutGear.map((p) => ({
              id: p._id,
              type: 'photo',
              label: `${p.title ?? p._id} — manque ${p.missing}`,
            }))}
          />
        )}

        {photosWithoutCaption.length > 0 && (
          <AlertGroup
            title={`${photosWithoutCaption.length} photo${photosWithoutCaption.length > 1 ? 's' : ''} sans légende`}
            items={photosWithoutCaption.map((p) => ({
              id: p._id,
              type: 'photo',
              label: `${p.title ?? p._id}${p.year ? ` (${p.year})` : ''}`,
            }))}
          />
        )}

        {photosWithoutSeries.length > 0 && (
          <AlertGroup
            title={`${photosWithoutSeries.length} photo${photosWithoutSeries.length > 1 ? 's' : ''} sans série`}
            items={photosWithoutSeries.map((p) => ({
              id: p._id,
              type: 'photo',
              label: `${p.title ?? p._id}${p.year ? ` (${p.year})` : ''}`,
            }))}
          />
        )}

        {emptySeries.length > 0 && (
          <AlertGroup
            title={`${emptySeries.length} série${emptySeries.length > 1 ? 's' : ''} vide${emptySeries.length > 1 ? 's' : ''}`}
            items={emptySeries.map((s) => ({
              id: s._id,
              type: 'series',
              label: s.title,
            }))}
          />
        )}
      </Stack>
    </Card>
  );
}

function AlertGroup({
  title,
  items,
}: {
  title: string;
  items: { id: string; type: string; label: string }[];
}) {
  return (
    <Stack space={2}>
      <Text size={1} weight="semibold">
        {title}
      </Text>
      <Stack space={1}>
        {items.slice(0, 8).map((item) => (
          <IntentLink
            key={item.id}
            intent="edit"
            params={{ id: publishedId(item.id), type: item.type }}
            style={{ textDecoration: 'none' }}
          >
            <Card padding={2} radius={1} tone="transparent" __unstable_focusRing>
              <Flex gap={2} align="center">
                <EditIcon style={{ opacity: 0.5 }} />
                <Text size={1}>{item.label}</Text>
              </Flex>
            </Card>
          </IntentLink>
        ))}
        {items.length > 8 && (
          <Text size={0} muted>
            … et {items.length - 8} autre{items.length - 8 > 1 ? 's' : ''}.
          </Text>
        )}
      </Stack>
    </Stack>
  );
}

// — Brouillons en attente —
function DraftsCard({ data }: { data: DashboardData }) {
  const { drafts } = data;
  return (
    <Card padding={4} radius={2} shadow={1}>
      <Stack space={4}>
        <Flex align="center" gap={2}>
          <EditIcon />
          <Heading size={1}>Brouillons en attente</Heading>
          <Badge tone={drafts.length > 0 ? 'caution' : 'default'}>{drafts.length}</Badge>
        </Flex>

        {drafts.length === 0 ? (
          <Text size={1} muted>
            ✓ Aucun brouillon. Tout est publié.
          </Text>
        ) : (
          <>
            <Card padding={3} radius={2} tone="caution">
              <Text size={1}>
                <strong>Rappel :</strong> les brouillons sont invisibles sur le site
                tant que tu n&apos;as pas cliqué <em>Publish</em>, puis lancé
                <code> npm run deploy</code>.
              </Text>
            </Card>
            <Stack space={1}>
              {drafts.map((d) => (
                <IntentLink
                  key={d._id}
                  intent="edit"
                  params={{ id: publishedId(d._id), type: d._type }}
                  style={{ textDecoration: 'none' }}
                >
                  <Card padding={2} radius={1} tone="transparent" __unstable_focusRing>
                    <Flex gap={2} align="center" justify="space-between">
                      <Flex gap={2} align="center">
                        <Badge tone="primary" mode="outline">
                          {d._type}
                        </Badge>
                        <Text size={1}>{d.title ?? d._id}</Text>
                      </Flex>
                      <Text size={0} muted>
                        {formatRelative(d._updatedAt)}
                      </Text>
                    </Flex>
                  </Card>
                </IntentLink>
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </Card>
  );
}

// — Récemment modifiées —
function RecentCard({
  data,
  thumbUrl,
}: {
  data: DashboardData;
  thumbUrl: ThumbFn;
}) {
  const { recent } = data;
  return (
    <Card padding={4} radius={2} shadow={1}>
      <Stack space={4}>
        <Flex align="center" gap={2}>
          <ClockIcon />
          <Heading size={1}>Photos récemment modifiées</Heading>
        </Flex>
        {recent.length === 0 ? (
          <Text size={1} muted>
            Aucune photo dans le dataset.
          </Text>
        ) : (
          <Stack space={1}>
            {recent.map((p) => {
              const src = thumbUrl(p.image, 80);
              return (
                <IntentLink
                  key={p._id}
                  intent="edit"
                  params={{ id: publishedId(p._id), type: 'photo' }}
                  style={{ textDecoration: 'none' }}
                >
                  <Card padding={2} radius={1} tone="transparent" __unstable_focusRing>
                    <Flex gap={3} align="center">
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 4,
                          overflow: 'hidden',
                          background: 'var(--card-border-color, #eee)',
                          flex: '0 0 auto',
                        }}
                      >
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            alt=""
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        ) : (
                          <ImageIcon
                            style={{
                              width: '100%',
                              height: '100%',
                              padding: 8,
                              opacity: 0.5,
                            }}
                          />
                        )}
                      </Box>
                      <Flex direction="column" flex={1}>
                        <Text size={1}>{p.title}</Text>
                        <Text size={0} muted>
                          {[p.location, p.year].filter(Boolean).join(' · ') || '—'} ·{' '}
                          {formatRelative(p._updatedAt)}
                        </Text>
                      </Flex>
                    </Flex>
                  </Card>
                </IntentLink>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
