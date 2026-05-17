/**
 * frontend/src/services/blinkitApi.js
 * ────────────────────────────────────
 * Frontend service layer for all Blinkit API interactions.
 *
 * Architecture
 * ────────────
 * The browser cannot call Blinkit's internal API directly (CORS).
 * All requests are routed through the NEXUS backend:
 *
 *   Component  →  blinkitApi.*()  →  WS / REST  →  backend  →  blinkit.com/v1
 *
 * Two transports are used depending on call type:
 *   WebSocket (ws)  — real-time search & home content (managed by useSearchStore)
 *   REST HTTP (fetch) — one-shot lookups: product detail, category, suggestions, offers
 *
 * Message contract (WS)
 * ─────────────────────
 * Outbound:  { action, ...payload, lat, lon }
 * Inbound:
 *   streamUpdate    — partial results (products[source])
 *   searchResults   — search complete signal
 *   homeContent     — categories + featured products
 *   searchSuggestions
 *   productDetail
 *   categoryProducts
 *   offers
 *   otpSent / authSuccess
 *   cartData / cartUpdated
 *   addresses / addressAdded
 *   orderHistory
 *   error
 */

import useLocationStore from '../store/useLocationStore';

// ─── Config ───────────────────────────────────────────────────────────────────

/** Base URL for REST fallback routes. Auto-detects Vite dev vs production. */
function apiBase() {
  if (typeof window === 'undefined') return 'http://localhost:5000';
  const { protocol, host } = window.location;
  const h = host.includes(':5173') ? host.replace(':5173', ':5000') : host;
  return `${protocol}//${h}`;
}

// ─── Low-level transport helpers ──────────────────────────────────────────────

/**
 * Module-level WS reference shared from useSearchStore.
 * useSearchStore calls _registerWs(socket) after opening the connection.
 */
let _wsRef = null;
export function _registerWs(socket) { _wsRef = socket; }

function getWs() {
  return _wsRef?.readyState === WebSocket.OPEN ? _wsRef : null;
}

/** Attach current coords to any outbound payload. */
function withCoords(payload) {
  const { lat, lon } = useLocationStore.getState();
  return { ...payload, lat, lon };
}

/** Send a WS message. Returns true if sent, false if WS unavailable. */
function wsSend(payload) {
  const socket = getWs();
  if (!socket) return false;
  socket.send(JSON.stringify(withCoords(payload)));
  return true;
}

/**
 * One-shot REST GET via the backend's /api/* fallback routes.
 * Automatically appends lat/lon from the location store.
 */
async function restGet(path, params = {}) {
  const { lat, lon } = useLocationStore.getState();
  const url = new URL(`${apiBase()}${path}`);
  Object.entries({ lat, lon, ...params }).forEach(([k, v]) => {
    if (v != null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── One-time promise registry ────────────────────────────────────────────────
// For WS-based calls that need a Promise interface (auth, cart, etc.)

const _pending = new Map(); // key → { resolve, reject, timer }

export function _resolveWsResponse(action, data, keyField = null) {
  const key = keyField ? `${action}:${data[keyField]}` : action;
  const entry = _pending.get(key);
  if (entry) {
    clearTimeout(entry.timer);
    _pending.delete(key);
    entry.resolve(data);
  }
}

function waitForWsResponse(action, keyField = null, keyValue = null, timeoutMs = 10_000) {
  const key = keyField && keyValue != null ? `${action}:${keyValue}` : action;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      _pending.delete(key);
      reject(new Error(`WS response timeout: ${action}`));
    }, timeoutMs);
    _pending.set(key, { resolve, reject, timer });
  });
}

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Trigger a product search.
 * Results stream into useSearchStore.products via the `streamUpdate` WS event.
 * @param {string} query
 */
export function search(query) {
  // Delegates to useSearchStore to avoid circular dependency
  import('../store/useSearchStore').then(({ default: store }) => {
    store.getState().search(query);
  });
}

/**
 * Fetch autocomplete suggestions for a partial query.
 * @param {string}   query
 * @param {function} [onResult]  - called with suggestions[] from REST fallback
 */
export function getSuggestions(query, onResult) {
  if (!query?.trim()) return;
  if (!wsSend({ action: 'getSearchSuggestions', query })) {
    restGet('/api/suggestions', { q: query })
      .then(({ suggestions }) => onResult?.(suggestions ?? []))
      .catch(() => onResult?.([]));
  }
}

// ─── Home content ─────────────────────────────────────────────────────────────

/**
 * Load home page categories + featured products.
 * Results are written to useSearchStore.categories / featuredProducts.
 */
export function fetchHomeContent() {
  import('../store/useSearchStore').then(({ default: store }) => {
    store.getState().fetchHomeContent();
  });
}

// ─── Product detail ───────────────────────────────────────────────────────────

/**
 * Fetch full product detail for a single product (REST — no streaming needed).
 * @param {string} productId
 * @returns {Promise<object|null>}
 */
export async function getProductDetail(productId) {
  const data = await restGet(`/api/product/${productId}`);
  return data.product ?? null;
}

// ─── Category listing ─────────────────────────────────────────────────────────

/**
 * Fetch products for a category.
 * @param {string} categoryId
 * @param {number} [page=1]
 * @returns {Promise<{ products: object[], hasMore: boolean }>}
 */
export async function getCategoryProducts(categoryId, page = 1) {
  return restGet(`/api/category/${encodeURIComponent(categoryId)}`, { page });
}

// ─── Offers ───────────────────────────────────────────────────────────────────

/**
 * Fetch active coupons and offers for the current location.
 * @returns {Promise<object[]>}
 */
export async function getOffers() {
  const data = await restGet('/api/offers');
  return data.offers ?? [];
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Send an OTP to the given phone number.
 * @param {string} phone   e.g. "+919876543210"
 * @returns {Promise<{ requestId: string }>}
 */
export function sendOtp(phone) {
  const sent = wsSend({ action: 'sendOtp', phone });
  if (sent) return waitForWsResponse('otpSent');
  return Promise.reject(new Error('WebSocket not connected'));
}

/**
 * Verify the OTP and complete sign-in.
 * @param {string} phone
 * @param {string} otp
 * @param {string} requestId  — from the sendOtp response
 * @returns {Promise<{ token: string, user: object }>}
 */
export function verifyOtp(phone, otp, requestId) {
  const sent = wsSend({ action: 'verifyOtp', phone, otp, requestId });
  if (sent) return waitForWsResponse('authSuccess');
  return Promise.reject(new Error('WebSocket not connected'));
}

// ─── Cart (authenticated) ─────────────────────────────────────────────────────

/**
 * Fetch the server-side cart for the currently authenticated user.
 * @returns {Promise<object>}
 */
export function getServerCart() {
  const sent = wsSend({ action: 'getCart' });
  if (sent) return waitForWsResponse('cartData');
  return Promise.reject(new Error('WebSocket not connected'));
}

/**
 * Add, update, or remove a product from the server-side cart.
 * Pass quantity = 0 to remove.
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<object>}
 */
export function updateServerCart(productId, quantity) {
  const sent = wsSend({ action: 'updateCart', productId, quantity });
  if (sent) return waitForWsResponse('cartUpdated');
  return Promise.reject(new Error('WebSocket not connected'));
}

// ─── Addresses (authenticated) ────────────────────────────────────────────────

/**
 * Fetch saved delivery addresses for the authenticated user.
 * @returns {Promise<object[]>}
 */
export function getAddresses() {
  const sent = wsSend({ action: 'getAddresses' });
  if (sent) return waitForWsResponse('addresses');
  return Promise.reject(new Error('WebSocket not connected'));
}

// ─── Orders (authenticated) ───────────────────────────────────────────────────

/**
 * Fetch order history for the authenticated user.
 * @param {number} [page=1]
 * @returns {Promise<object[]>}
 */
export function getOrderHistory(page = 1) {
  const sent = wsSend({ action: 'getOrderHistory', page });
  if (sent) return waitForWsResponse('orderHistory');
  return Promise.reject(new Error('WebSocket not connected'));
}

// ─── WS message bridge ────────────────────────────────────────────────────────
// useSearchStore dispatches WS responses it doesn't own here so that
// Promise-based callers (sendOtp, getCart, etc.) can resolve.

/**
 * Call this from useSearchStore's onmessage handler for any action that
 * a Promise-based caller may be waiting on.
 */
export function routeWsResponse(action, data) {
  _resolveWsResponse(action, data);
}
