import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, Flex, Inline, Text } from '@sanity/ui';
import { useFormValue } from 'sanity';

type Mode = 'local' | 'prod';

const LOCAL_BASE = 'http://localhost:3010';

function getProdBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

function getInitialMode(): Mode {
  if (typeof window === 'undefined') return 'prod';
  return window.location.hostname === 'localhost' ? 'local' : 'prod';
}

export function PhotoPreviewView() {
  const slug = useFormValue(['slug', 'current']) as string | undefined;
  const [mode, setMode] = useState<Mode>(getInitialMode);
  const [cacheBuster, setCacheBuster] = useState<number>(() => Date.now());

  // Re-bust on every mode change so Safari/Chrome don't serve the cached iframe.
  useEffect(() => {
    setCacheBuster(Date.now());
  }, [mode]);

  const url = useMemo(() => {
    const base = mode === 'local' ? LOCAL_BASE : getProdBase();
    const path = slug ? `/archives/#photo-${slug}` : '/archives/';
    // Cache-buster goes in the query, before the hash.
    const [pathPart, hashPart = ''] = path.split('#');
    const sep = pathPart.includes('?') ? '&' : '?';
    const url = `${base}${pathPart}${sep}ts=${cacheBuster}${hashPart ? `#${hashPart}` : ''}`;
    return url;
  }, [mode, slug, cacheBuster]);

  return (
    <Flex direction="column" style={{ height: '100%', minHeight: 400 }}>
      <Card padding={3} borderBottom>
        <Flex align="center" justify="space-between" gap={3} wrap="wrap">
          <Inline space={2}>
            <Button
              text="Local (drafts)"
              mode={mode === 'local' ? 'default' : 'ghost'}
              tone={mode === 'local' ? 'primary' : 'default'}
              onClick={() => setMode('local')}
            />
            <Button
              text="Prod (published)"
              mode={mode === 'prod' ? 'default' : 'ghost'}
              tone={mode === 'prod' ? 'primary' : 'default'}
              onClick={() => setMode('prod')}
            />
          </Inline>
          <Text size={0} muted style={{ fontFamily: 'monospace' }}>
            {url || '—'}
          </Text>
        </Flex>
      </Card>
      <Box flex={1} style={{ position: 'relative', minHeight: 0 }}>
        {slug ? (
          <iframe
            key={url}
            src={url}
            title="Aperçu"
            style={{ width: '100%', height: '100%', border: 0, background: '#fff' }}
          />
        ) : (
          <Flex align="center" justify="center" style={{ height: '100%' }}>
            <Text muted>Définis un slug pour activer l&apos;aperçu.</Text>
          </Flex>
        )}
      </Box>
    </Flex>
  );
}
