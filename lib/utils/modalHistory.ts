/**
 * Stack-based browser-history integration for nested modals.
 *
 * Problem this solves: the lightbox + original viewer live entirely in React
 * state, not in the URL. So when the user opens them and presses the
 * browser's back button, the browser pops to the previous URL (Google, an
 * About page, …) — almost certainly NOT what the user expected. They also
 * lose any way to "back out of the modal first". Then forward-from-Google
 * often paints a blank page because the previous tab was left with a locked
 * `body.style.overflow` and other modal state.
 *
 * Fix: each modal pushes a benign history entry on mount (no URL change,
 * just an extra slot). A single `popstate` listener walks a stack of close
 * handlers — the topmost wins. So back press 1 closes the topmost modal,
 * back press 2 closes the next, and only AFTER all modals are closed does
 * a third back leave the page. Forward then restores the page cleanly
 * because the modal state is already torn down.
 *
 * Cleanup semantics:
 *   - Modal unmounted because of popstate (browser back): the entry was
 *     already popped by the browser. The cleanup removes the modal from
 *     the stack only — no extra `history.back()`.
 *   - Modal unmounted because of user action (Esc / X / backdrop click):
 *     we pop our entry manually so the browser's back button is consistent
 *     afterwards. We mute the popstate listener around that call so the
 *     cascade doesn't also close the next-down modal in the stack.
 *
 * ⚠️ POURQUOI LE RETRAIT EST DIFFÉRÉ (bug réel, coûteux, invisible en prod)
 * ------------------------------------------------------------------------
 * `history.back()` est ASYNCHRONE, et React en mode strict joue chaque effet
 * DEUX fois : montage → nettoyage → montage. La version naïve (pushState au
 * montage, back() immédiat au nettoyage) donnait donc cette séquence, relevée
 * à la trace sur /archives :
 *
 *     pushState → len 3      (effet, 1er passage)
 *     back()    ← len 3      (nettoyage du mode strict, différé par le navigateur)
 *     pushState → len 4      (effet, 2e passage — AVANT que back() ne s'exécute)
 *     popstate  · len 3      (back() s'exécute enfin et mange la 2e entrée)
 *
 * Le compte est faux d'une unité : à la fermeture suivante, le `back()` reculait
 * une entrée trop loin et la page partait sur le **document vierge** (`about:blank`,
 * `document.body` vide). Symptôme côté utilisateur : « je clique sur une photo,
 * la page clignote et puis plus rien ». Invisible en production, où le mode
 * strict ne double pas les effets — d'où un bug qui ne se reproduit QUE chez le
 * développeur.
 *
 * Correctif : les retraits sont mis en attente et vidés au tick suivant, et un
 * `pushState` qui survient entre-temps ANNULE un retrait en attente au lieu
 * d'empiler une entrée de plus. Le va-et-vient du mode strict se neutralise donc
 * de lui-même, et une vraie fermeture retire exactement une entrée.
 */

type CloseFn = () => void;

type StackEntry = { close: CloseFn; viaPopState: { current: boolean } };

const stack: StackEntry[] = [];
let listener: ((e: PopStateEvent) => void) | null = null;
let listenerMuted = false;

/** Entrées à retirer, demandées mais pas encore exécutées (cf. préambule). */
let pendingPop = 0;
let flushScheduled = false;

/** Rend la parole au listener, que le popstate arrive ou non. */
function unmuteOnce() {
  let done = false;
  const release = () => {
    if (done) return;
    done = true;
    window.removeEventListener('popstate', release);
    listenerMuted = false;
  };
  window.addEventListener('popstate', release);
  // Filet : une entrée déjà consommée n'émet pas de popstate. Sans ce délai on
  // resterait muet pour toujours, et plus aucun retour navigateur ne fermerait
  // de modale.
  window.setTimeout(release, 250);
}

function flushPops() {
  flushScheduled = false;
  const n = pendingPop;
  pendingPop = 0;
  if (n <= 0 || typeof window === 'undefined') return;
  listenerMuted = true;
  unmuteOnce();
  window.history.go(-n);
}

function schedulePop() {
  pendingPop++;
  if (flushScheduled) return;
  flushScheduled = true;
  window.setTimeout(flushPops, 0);
}

function attachListener() {
  if (listener || typeof window === 'undefined') return;
  listener = () => {
    if (listenerMuted) return;
    const top = stack[stack.length - 1];
    if (!top) return;
    top.viaPopState.current = true;
    top.close();
  };
  window.addEventListener('popstate', listener);
}

function detachListenerIfEmpty() {
  if (!listener || stack.length > 0 || typeof window === 'undefined') return;
  window.removeEventListener('popstate', listener);
  listener = null;
}

/**
 * Push a history entry tied to this modal. Returns a cleanup function the
 * caller must invoke when the modal unmounts (typically from useEffect's
 * return). The cleanup pops the entry on user-initiated close and is a
 * no-op on popstate close.
 */
export function pushModalHistory(close: CloseFn): () => void {
  if (typeof window === 'undefined') return () => {};
  // Un retrait encore en attente sur ce tick = on vient d'être démonté puis
  // remonté (mode strict). On REPREND cette entrée au lieu d'en empiler une
  // seconde : c'est ce qui neutralise le va-et-vient, cf. préambule.
  if (pendingPop > 0) pendingPop--;
  else window.history.pushState({ modal: true }, '');

  // Chemin au moment de l'ouverture. Le démontage peut venir de DEUX causes
  // très différentes : la modale se ferme (on reste sur la page), ou
  // l'utilisateur NAVIGUE ailleurs (clic sur le logo, sur un lien du menu).
  // Dans le second cas, retirer l'entrée poussée revient à faire un
  // `history.back()` juste après la navigation — donc à l'ANNULER. Bug réel :
  // en immersion sur /series, le clic sur le logo repartait vers « / » puis
  // revenait aussitôt sur /series#slug, qui rouvrait la série au début.
  const pathAtPush =
    typeof window !== 'undefined' ? window.location.pathname : '';

  const entry: StackEntry = { close, viaPopState: { current: false } };
  stack.push(entry);
  attachListener();
  return () => {
    const idx = stack.indexOf(entry);
    if (idx >= 0) stack.splice(idx, 1);
    const navigated =
      typeof window !== 'undefined' &&
      window.location.pathname !== pathAtPush;
    if (!entry.viaPopState.current && !navigated && typeof window !== 'undefined') {
      // Fermeture par l'interface (X, Échap, fond, balayage) : on retire
      // l'entrée poussée à l'ouverture pour que le retour navigateur reste
      // cohérent ensuite. Différé d'un tick — un remontage immédiat l'annule.
      schedulePop();
    }
    detachListenerIfEmpty();
  };
}
