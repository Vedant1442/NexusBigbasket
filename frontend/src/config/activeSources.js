/**
 * activeSources.js
 *
 * Single source of truth for which platforms are active in this build.
 * Add a source string here and it automatically propagates to:
 *   • product bucket initialisation in useSearchStore
 *   • service status tracking
 *   • tab rendering in SearchResults
 *   • status messages
 *
 * Valid source ids: 'blinkit' | 'zepto' | 'instamart' | 'bigbasket'
 */

export const ACTIVE_SOURCES = ['blinkit'];

// ─── Display helpers ──────────────────────────────────────────────────────────

const DISPLAY_NAMES = {
  blinkit:   'Blinkit',
  zepto:     'Zepto',
  instamart: 'Instamart',
  bigbasket: 'BigBasket',
};

export function displayName(sourceId) {
  return DISPLAY_NAMES[sourceId] ?? (sourceId.charAt(0).toUpperCase() + sourceId.slice(1));
}

// ─── Store initialisers ───────────────────────────────────────────────────────

/**
 * Returns an empty product-list object keyed by every active source.
 * e.g. { blinkit: [] }
 */
export function emptyProductBuckets() {
  return Object.fromEntries(ACTIVE_SOURCES.map((s) => [s, []]));
}

/**
 * Returns a service-status object for every active source.
 * @param {'idle'|'loading'|'done'|'error'} value
 */
export function buildInitialServiceStatus(value = 'idle') {
  return Object.fromEntries(ACTIVE_SOURCES.map((s) => [s, value]));
}

// ─── Status messages ──────────────────────────────────────────────────────────

/**
 * Human-readable status shown while a search is starting.
 * "Searching Blinkit…" or "Searching Blinkit, Zepto…"
 */
export function searchStartingMessage() {
  if (ACTIVE_SOURCES.length === 1) {
    return `Searching ${displayName(ACTIVE_SOURCES[0])}…`;
  }
  return `Searching ${ACTIVE_SOURCES.map(displayName).join(', ')}…`;
}

/**
 * True if all active sources have a status of 'done' or 'error'.
 */
export function allSourcesSettled(serviceStatus) {
  return ACTIVE_SOURCES.every(
    (s) => serviceStatus[s] === 'done' || serviceStatus[s] === 'error'
  );
}

/**
 * Total product count across all active sources.
 */
export function totalProductCount(products) {
  return ACTIVE_SOURCES.reduce((sum, s) => sum + (products[s]?.length ?? 0), 0);
}
