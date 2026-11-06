/**
 * Garde-fou des scripts destructifs (audit 2.7, 2026-11-06).
 *
 * Avant qu'un script supprime quoi que ce soit dans Sanity, on écrit sur le
 * disque ce qui va disparaître : les documents complets (ndjson, brouillons
 * compris) et les fichiers des assets image. Sanity n'a pas de corbeille pour
 * les assets, et l'historique des documents ne survit pas à une suppression.
 *
 * Tout échec lève une erreur : le script appelant s'arrête AVANT de supprimer.
 * Dossier : `backups/<nom>-<horodatage>/` à la racine du dépôt (gitignoré,
 * copié chaque jour par backup-client-files.sh).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SanityClient } from '@sanity/client';

type AssetRow = { _id: string; url?: string; originalFilename?: string | null };

export async function saveBeforeDelete(
  client: SanityClient,
  label: string,
  ids: { docs: string[]; assets: string[] }
): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.resolve('backups', `${label}-${stamp}`);
  await mkdir(path.join(dir, 'assets'), { recursive: true });

  const all = [...new Set([...ids.docs, ...ids.assets])];
  // `raw` : publiés ET brouillons, sans quoi un brouillon supprimé serait perdu.
  const docs = all.length
    ? await client.withConfig({ perspective: 'raw' }).fetch<Record<string, unknown>[]>(
        '*[_id in $ids || _id in $drafts]',
        { ids: all, drafts: all.map((id) => `drafts.${id}`) }
      )
    : [];
  await writeFile(path.join(dir, 'documents.ndjson'), docs.map((d) => JSON.stringify(d)).join('\n') + '\n');

  const assets = docs.filter((d) => ids.assets.includes(d._id as string)) as AssetRow[];
  for (const a of assets) {
    if (!a.url) throw new Error(`asset ${a._id} sans url : sauvegarde impossible, rien n'est supprimé`);
    const res = await fetch(a.url);
    if (!res.ok) throw new Error(`téléchargement ${a.url} → HTTP ${res.status}, rien n'est supprimé`);
    // Le nom côté CDN (<sha1>-<l>x<h>.<ext>) est unique ; le nom d'origine suit pour s'y retrouver.
    const name = path.basename(new URL(a.url).pathname) + (a.originalFilename ? `--${a.originalFilename}` : '');
    await writeFile(path.join(dir, 'assets', name.replace(/[/\\]/g, '_')), Buffer.from(await res.arrayBuffer()));
  }
  if (assets.length !== ids.assets.length) {
    throw new Error(`${ids.assets.length - assets.length} asset(s) introuvable(s) à sauvegarder, rien n'est supprimé`);
  }

  console.log(`✓ Sauvegardé avant suppression : ${docs.length} document(s), ${assets.length} fichier(s) → ${dir}`);
  return dir;
}
