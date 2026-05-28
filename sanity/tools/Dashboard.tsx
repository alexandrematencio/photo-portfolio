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
} from '@sanity/icons';
import { useClient, useSchema } from 'sanity';
import { IntentLink } from 'sanity/router';

const API_VERSION = '2026-01-01';

const DASHBOARD_QUERY = /* groq */ `
{
  "photosWithoutSeries": *[_type == "photo" && !defined(series)] | order(_updatedAt desc) [0...10] {
    _id, title, "slug": slug.current, category, year
  },
  "photosWithoutCaption": *[_type == "photo" && !defined(caption)] | order(_updatedAt desc) [0...10] {
    _id, title, "slug": slug.current, category, year
  },
  "emptySeries": *[_type == "series"] {
    _id, title, "slug": slug.current,
    "photoCount": count(*[_type == "photo" && references(^._id)])
  } [photoCount == 0],
  "drafts": *[_id in path('drafts.**')] | order(_updatedAt desc) [0...20] {
    _id, _type, _updatedAt, title
  },
  "stats": {
    "totalPhotos": count(*[_type == "photo"]),
    "totalSeries": count(*[_type == "series"]),
    "onHomepage": count(*[_type == "photo" && onHomepage == true]),
    "byCategory": {
      "landscape":  count(*[_type == "photo" && category == "landscape"]),
      "architecture": count(*[_type == "photo" && category == "architecture"]),
      "portrait":   count(*[_type == "photo" && category == "portrait"]),
      "streetphotography": count(*[_type == "photo" && category == "streetphotography"])
    }
  },
  "recent": *[_type == "photo"] | order(_updatedAt desc) [0...10] {
    _id, title, "slug": slug.current, _updatedAt, image,
    "categoryLabel": select(
      category == "landscape" => "Paysage",
      category == "architecture" => "Archi",
      category == "portrait" => "Portrait",
      category == "streetphotography" => "Street",
      "—"
    )
  }
}
`;

type DashboardData = {
  photosWithoutSeries: { _id: string; title: string; slug: string; category: string; year: number }[];
  photosWithoutCaption: { _id: string; title: string; slug: string; category: string; year: number }[];
  emptySeries: { _id: string; title: string; slug: string; photoCount: number }[];
  drafts: { _id: string; _type: string; _updatedAt: string; title?: string }[];
  stats: {
    totalPhotos: number;
    totalSeries: number;
    onHomepage: number;
    byCategory: {
      landscape: number;
      architecture: number;
      portrait: number;
      streetphotography: number;
    };
  };
  recent: {
    _id: string;
    title: string;
    slug: string;
    _updatedAt: string;
    image?: { asset?: { _ref: string } };
    categoryLabel: string;
  }[];
};

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

export function Dashboard() {
  const client = useClient({ apiVersion: API_VERSION });
  const schema = useSchema();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            <AlertsCard data={data} hasSchema={Boolean(schema.get('series'))} />
            <DraftsCard data={data} />
            <RecentCard data={data} />
          </>
        )}
      </Stack>
    </Box>
  );
}

// — Stats + raccourcis —
function StatsCard({ data, siteUrl }: { data: DashboardData; siteUrl: string }) {
  const { stats } = data;
  return (
    <Card padding={4} radius={2} shadow={1}>
      <Stack space={4}>
        <Heading size={1}>Vue d&apos;ensemble</Heading>
        <Grid columns={[2, 3, 5]} gap={3}>
          <Stat label="Photos" value={stats.totalPhotos} />
          <Stat label="Séries" value={stats.totalSeries} />
          <Stat label="Sur la home" value={stats.onHomepage} />
          <Stat label="Paysage" value={stats.byCategory.landscape} />
          <Stat label="Portrait" value={stats.byCategory.portrait} />
          <Stat label="Archi" value={stats.byCategory.architecture} />
          <Stat label="Street" value={stats.byCategory.streetphotography} />
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

// — Alertes qualité —
function AlertsCard({ data, hasSchema }: { data: DashboardData; hasSchema: boolean }) {
  const { photosWithoutSeries, photosWithoutCaption, emptySeries } = data;
  const totalAlerts =
    photosWithoutSeries.length + photosWithoutCaption.length + emptySeries.length;

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
            ✓ Aucune alerte. Tout est rattaché et légendé.
          </Text>
        )}

        {photosWithoutSeries.length > 0 && (
          <AlertGroup
            title={`${photosWithoutSeries.length} photo${photosWithoutSeries.length > 1 ? 's' : ''} sans série`}
            items={photosWithoutSeries.map((p) => ({
              id: p._id,
              type: 'photo',
              label: `${p.title} (${p.year}, ${p.category})`,
            }))}
          />
        )}

        {photosWithoutCaption.length > 0 && (
          <AlertGroup
            title={`${photosWithoutCaption.length} photo${photosWithoutCaption.length > 1 ? 's' : ''} sans légende`}
            items={photosWithoutCaption.map((p) => ({
              id: p._id,
              type: 'photo',
              label: `${p.title} (${p.year})`,
            }))}
          />
        )}

        {hasSchema && emptySeries.length > 0 && (
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
function RecentCard({ data }: { data: DashboardData }) {
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
            {recent.map((p) => (
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
                        background: '#eee',
                        flex: '0 0 auto',
                      }}
                    >
                      <ImageIcon style={{ width: '100%', height: '100%', padding: 8, opacity: 0.5 }} />
                    </Box>
                    <Flex direction="column" flex={1}>
                      <Text size={1}>{p.title}</Text>
                      <Text size={0} muted>
                        {p.categoryLabel} · {formatRelative(p._updatedAt)}
                      </Text>
                    </Flex>
                  </Flex>
                </Card>
              </IntentLink>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
