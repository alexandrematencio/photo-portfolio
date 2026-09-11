'use client';

import { NextStudio } from 'next-sanity/studio';
import { createClient } from 'next-sanity';
import { defineConfig, type AuthStore, type CurrentUser } from 'sanity';
import { of } from 'rxjs';
import { studioConfig } from '@/sanity/studio.config';
import { apiVersion, dataset, projectId } from '@/lib/sanity/env';

/**
 * Sonde de DÉVELOPPEMENT : le Studio, à l'identique, mais sans session Sanity.
 *
 * Pourquoi : `/studio` est derrière l'authentification Sanity, que Playwright
 * n'a pas (profil vierge → « Choose login provider »). Impossible, donc, de
 * constater un rendu du Studio autrement que par les yeux d'Alexandre. Ce
 * montage remplace le magasin d'authentification par un état fixe
 * « authentifié » : le dataset est en lecture publique, l'interface se rend,
 * le DOM se mesure. Les écritures échouent (pas de jeton) — c'est voulu.
 *
 * Jamais en prod : la page renvoie `null` dès que `NODE_ENV === 'production'`
 * (cf. `page.tsx`), donc l'export statique n'en contient qu'une coquille vide.
 */
const client = createClient({ projectId, dataset, apiVersion, useCdn: false });

const currentUser: CurrentUser = {
  id: 'studio-probe',
  name: 'Sonde (lecture seule)',
  email: 'probe@localhost',
  role: 'viewer',
  roles: [{ name: 'viewer', title: 'Viewer' }],
};

const auth: AuthStore = {
  state: of({ authenticated: true, currentUser, client }),
  token: of(null),
};

const probeConfig = defineConfig({
  ...studioConfig,
  name: 'studio-probe',
  title: 'Sonde Studio',
  basePath: '/studio-probe',
  auth,
});

export function StudioProbe() {
  return <NextStudio config={probeConfig} />;
}
