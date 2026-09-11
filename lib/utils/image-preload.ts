/**
 * Préchargement d'images en tâche de fond, sans gêner le défilement.
 *
 * Deux voies :
 * - `preloadImage(src, 'high')` — l'INTENTION (appui, focus, survol posé) :
 *   la requête part tout de suite, le clic suit dans la seconde.
 * - `createIdlePreloader()` — l'ANTICIPATION : une file qu'on remplit avec ce
 *   qui approche de l'écran, vidée seulement quand le défilement est au repos
 *   ET que le navigateur est oisif, deux requêtes à la fois au plus, en
 *   priorité basse. Ce qui ressort de la zone avant son tour est retiré de la
 *   file : traverser la galerie d'un geste rapide ne télécharge rien.
 *
 * On remplit le cache HTTP, on ne DÉCODE pas d'avance : le CDN Sanity sert en
 * `max-age=31536000`, et décoder un 2048 px à l'ouverture coûte quelques
 * dizaines de ms, alors que garder trente bitmaps décodés d'avance
 * immobiliserait des centaines de Mo.
 *
 * ⚠️ L'URL préchargée doit être STRICTEMENT celle qu'affichera l'image : un
 * paramètre qui diffère est un autre fichier sur le CDN. D'où les helpers
 * uniques de `lib/sanity/image.ts` (`lightboxImageUrl`).
 */

type Priority = 'high' | 'low';

/** URLs déjà arrivées dans le cache. */
const settled = new Set<string>();
/** Requêtes en cours, pour ne jamais demander deux fois le même fichier. */
const inflight = new Map<string, Promise<boolean>>();

/** Résout `true` quand l'image est dans le cache, `false` sur erreur réseau. */
export function preloadImage(src: string, priority: Priority = 'low'): Promise<boolean> {
  if (!src || typeof window === 'undefined') return Promise.resolve(false);
  if (settled.has(src)) return Promise.resolve(true);
  const pending = inflight.get(src);
  if (pending) return pending;

  const p = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    // Attribut plutôt que propriété : Safari a longtemps ignoré
    // `fetchPriority`, l'attribut est inerte là où il n'est pas compris.
    img.setAttribute('fetchpriority', priority);
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  }).then((ok) => {
    inflight.delete(src);
    // Un échec n'est PAS mémorisé : la prochaine demande retentera.
    if (ok) settled.add(src);
    return ok;
  });
  inflight.set(src, p);
  return p;
}

/** Économiseur de données ou réseau très lent : pas d'anticipation. */
function prefersLightData(): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!connection) return false;
  return (
    connection.saveData === true ||
    connection.effectiveType === 'slow-2g' ||
    connection.effectiveType === '2g'
  );
}

export type IdlePreloader = {
  /** Met l'URL dans la file (sans effet si déjà en cache ou en file). */
  want: (src: string) => void;
  /** La retire de la file si elle n'est pas encore partie. */
  drop: (src: string) => void;
  destroy: () => void;
};

type IdleOptions = {
  /** Requêtes simultanées au plus. */
  concurrency?: number;
  /** Silence de défilement exigé avant de lancer quoi que ce soit, en ms. */
  quietMs?: number;
};

export function createIdlePreloader({
  concurrency = 2,
  quietMs = 250,
}: IdleOptions = {}): IdlePreloader {
  const disabled = typeof window === 'undefined' || prefersLightData();
  const queue: string[] = [];
  let running = 0;
  let lastScroll = 0;
  let destroyed = false;
  let cancelPending: (() => void) | null = null;

  const onScroll = () => {
    lastScroll = performance.now();
  };
  if (!disabled) window.addEventListener('scroll', onScroll, { passive: true });

  // Safari n'a pas `requestIdleCallback` : un court délai en tient lieu.
  const whenIdle = (cb: () => void): (() => void) => {
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(cb, { timeout: 1000 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(cb, 50);
    return () => window.clearTimeout(handle);
  };

  const pump = () => {
    while (!destroyed && running < concurrency && queue.length > 0) {
      // Le défilement a repris entre-temps : on attend le prochain silence.
      if (performance.now() - lastScroll < quietMs) break;
      const src = queue.shift() as string;
      running++;
      void preloadImage(src, 'low').then(() => {
        running--;
        schedule();
      });
    }
    schedule();
  };

  function schedule() {
    if (disabled || destroyed || cancelPending) return;
    if (running >= concurrency || queue.length === 0) return;
    const wait = Math.max(0, lastScroll + quietMs - performance.now());
    let cancelIdle: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      cancelIdle = whenIdle(() => {
        cancelPending = null;
        pump();
      });
    }, wait);
    cancelPending = () => {
      window.clearTimeout(timer);
      cancelIdle?.();
    };
  }

  return {
    want(src) {
      if (disabled || destroyed || !src) return;
      if (settled.has(src) || inflight.has(src) || queue.includes(src)) return;
      queue.push(src);
      schedule();
    },
    drop(src) {
      const i = queue.indexOf(src);
      if (i >= 0) queue.splice(i, 1);
    },
    destroy() {
      destroyed = true;
      queue.length = 0;
      cancelPending?.();
      cancelPending = null;
      if (!disabled) window.removeEventListener('scroll', onScroll);
    },
  };
}
