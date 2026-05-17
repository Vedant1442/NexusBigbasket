/**
 * useSearchStore.js
 *
 * Core WS-backed store for search, home content, and autocomplete.
 *
 * Key fixes over the original:
 *  1. Listens for BOTH `streamUpdate` AND `searchResults`
 *     (original server only emitted `searchResults` with products, but the
 *     fixed server now emits `streamUpdate` first then `searchResults` — both handled)
 *  2. Sends real lat/lon from useLocationStore with every WS message
 *  3. `setLocation()` so LocationModal has a single call surface
 *  4. Product buckets derived from ACTIVE_SOURCES, not hardcoded `{ blinkit: [] }`
 *  5. WS socket shared with blinkitApi via `_registerWs`
 *  6. Reconnect loop with 3 s back-off
 *  7. WS responses for Promise-based API calls (auth, cart, etc.) forwarded
 *     to blinkitApi.routeWsResponse()
 */

import { create } from 'zustand';
import useLocationStore from './useLocationStore';
import { emptyProductBuckets, buildInitialServiceStatus } from '../config/activeSources';
import { _registerWs, routeWsResponse } from '../services/blinkitApi';

// ─── Singleton WebSocket ──────────────────────────────────────────────────────

let ws = null;
let reconnectTimer = null;

function defaultWsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window === 'undefined') return 'ws://localhost:5000';
  const { protocol, host } = window.location;
  const wsHost     = host.includes(':5173') ? host.replace(':5173', ':5000') : host;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${wsHost}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Enrich an outgoing message with the current lat/lon from useLocationStore.
 */
function withCoords(payload = {}) {
  const { lat, lon } = useLocationStore.getState();
  return { ...payload, lat, lon };
}

// ─── Store ────────────────────────────────────────────────────────────────────

const useSearchStore = create((set, get) => ({
  // ── Connection state ───────────────────────────────────────────────────────
  isConnected:   false,
  statusMessage: 'Connecting to Warp Pool…',

  // ── Search state ───────────────────────────────────────────────────────────
  isSearching:   false,
  isLiveScanning: false,         // true while Playwright scraper is running
  scanMessage:   '',             // shown in the UI during live scan
  products:      emptyProductBuckets(),   // { blinkit: [], zepto: [], … }
  serviceStatus: buildInitialServiceStatus('idle'),
  lastQuery:     '',

  // ── Home content ───────────────────────────────────────────────────────────
  categories:       [],
  featuredProducts: [],

  // ── Autocomplete ───────────────────────────────────────────────────────────
  suggestions: [],

  // ─────────────────────────────────────────────────────────────────────────
  // connect()
  // Opens the WebSocket and registers all message handlers.
  // ─────────────────────────────────────────────────────────────────────────
  connect: () => {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url    = defaultWsUrl();
    console.log('[Nexus] Connecting to Warp Pool:', url);
    const socket = new WebSocket(url);
    ws = socket;

    // Share socket reference with blinkitApi so its send helpers can use it
    _registerWs(socket);

    // Actions whose responses are consumed by Promise-based callers in
    // blinkitApi.js rather than being written into this store.
    const WS_ROUTED_ACTIONS = new Set([
      'otpSent', 'authSuccess',
      'cartData', 'cartUpdated',
      'addresses', 'addressAdded',
      'orderHistory',
      'productDetail', 'categoryProducts',
      'offers',
    ]);

    socket.onopen = () => {
      console.log('[Nexus] WS connected');
      set({ isConnected: true, statusMessage: 'Nexus Warp Ready' });
      get().fetchHomeContent();
    };

    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      const { action } = data;

      // Forward one-shot responses to blinkitApi Promise resolvers
      if (WS_ROUTED_ACTIONS.has(action)) {
        routeWsResponse(action, data);
        return;
      }

      switch (action) {

        // Home page categories + featured products
        case 'homeContent':
          set({
            categories:       data.categories ?? [],
            featuredProducts: data.products   ?? [],
          });
          break;

        // ── CRITICAL FIX ────────────────────────────────────────────────────
        // Old server.js only emitted `searchResults` with the product array.
        // Fixed server.js now emits `streamUpdate` (products) then
        // `searchResults` (completion). Both are handled here.

        // 1️⃣  Partial/stream results — populate the product grid immediately
        case 'streamUpdate':
          if (data.source && data.products) {
            // Scraper cache-miss: backend is spawning Playwright live scan
            if (data.scanning) {
              set({
                isLiveScanning: true,
                scanMessage:    data.scanMessage || '🔍 Scanning live inventory…',
                serviceStatus:  { ...get().serviceStatus, [data.source]: 'loading' },
                statusMessage:  data.scanMessage || 'Scanning Blinkit live…',
              });
              break;
            }

            // Normal result delivery (cache hit or scraper finished)
            set((state) => ({
              products: {
                ...state.products,
                [data.source]: data.products,
              },
              isLiveScanning: false,
              scanMessage:    '',
              serviceStatus: {
                ...state.serviceStatus,
                [data.source]: 'done',
              },
              statusMessage: `${data.source} results loaded`,
            }));
          }
          break;

        // 2️⃣  Search complete — clear the loading spinner
        case 'searchResults':
          set({
            isSearching:   false,
            statusMessage: data.total != null ? `${data.total} results` : 'Done',
          });
          break;

        // Autocomplete suggestions
        case 'searchSuggestions':
          set({ suggestions: data.suggestions ?? [] });
          break;

        // Server-side error
        case 'error':
          console.warn('[Nexus] server error:', data.originalAction, data.message);
          set((state) => ({
            isSearching:   false,
            serviceStatus: data.originalAction === 'search'
              ? buildInitialServiceStatus('error')
              : state.serviceStatus,
            statusMessage: data.message ?? 'Something went wrong',
          }));
          break;

        case 'groupCartUpdated':
          // Dynamically import to avoid circular dependency if any, or just use window global if possible.
          // Better: require/import at the top
          import('./useGroupCartStore').then(mod => {
            const groupCartStore = mod.default;
            const state = groupCartStore.getState();
            if (state.basket && state.basket.shareCode === data.basket.shareCode) {
               state.syncFromRemote(data.basket);
            }
          });
          break;

        default:
          break;
      }
    };

    socket.onclose = () => {
      console.log('[Nexus] WS disconnected — retrying in 3 s');
      set({ isConnected: false, statusMessage: 'Warp Pool Offline' });
      ws = null;
      _registerWs(null);
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => get().connect(), 3_000);
    };

    socket.onerror = (err) => {
      console.warn('[Nexus] WS error', err);
    };
  },

  // ─────────────────────────────────────────────────────────────────────────
  // search(query)
  // Sends a search request over WS, attaching current lat/lon.
  // ─────────────────────────────────────────────────────────────────────────
  search: (query) => {
    if (!query?.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;

    set({
      isSearching:   true,
      lastQuery:     query,
      products:      emptyProductBuckets(),
      serviceStatus: buildInitialServiceStatus('loading'),
      statusMessage: `Warping to Blinkit for "${query}"…`,
      suggestions:   [],
    });

    ws.send(JSON.stringify(withCoords({ action: 'search', searchTerm: query })));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // fetchHomeContent()
  // Loads categories + featured products for the current location.
  // ─────────────────────────────────────────────────────────────────────────
  fetchHomeContent: () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(withCoords({ action: 'getHomeContent' })));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getSuggestions(query)
  // Autocomplete — debounce in the UI before calling.
  // ─────────────────────────────────────────────────────────────────────────
  getSuggestions: (query) => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !query?.trim()) {
      set({ suggestions: [] });
      return;
    }
    ws.send(JSON.stringify(withCoords({ action: 'getSearchSuggestions', query })));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // setLocation()
  // Called by LocationModal after the user picks an address.
  // Updates the persisted location store then re-fetches home content.
  // ─────────────────────────────────────────────────────────────────────────
  setLocation: (fullAddress, lat, lon) => {
    if (lat != null && lon != null) {
      useLocationStore.getState().setLocation(
        fullAddress.split(',')[0],
        fullAddress,
        lat,
        lon
      );
    }
    get().fetchHomeContent();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // clearSuggestions()
  // ─────────────────────────────────────────────────────────────────────────
  clearSuggestions: () => set({ suggestions: [] }),

  // ─────────────────────────────────────────────────────────────────────────
  // syncGroupCart(basket)
  // ─────────────────────────────────────────────────────────────────────────
  syncGroupCart: (basket) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(withCoords({ action: 'syncGroupCart', basket })));
    }
  },
}));

export default useSearchStore;
