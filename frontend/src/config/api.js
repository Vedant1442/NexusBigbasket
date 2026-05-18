/**
 * frontend/src/config/api.js
 * Centralized API and WebSocket URL configuration.
 * Automatically checks for custom environment variables (useful in Vercel/Render deployment)
 * and falls back to dynamic localhost derivation for development.
 */

export function getApiBase() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (typeof window === 'undefined') return 'http://localhost:5000';
  const { protocol, host } = window.location;
  const h = (host.includes(':5173') || host.includes(':5174') || host.includes(':5175') || host.includes(':5176'))
    ? host.replace(/:(517\d)$/, ':5000')
    : (host.includes('localhost') || host.includes('127.0.0.1'))
      ? host.replace(/:\d+$/, ':5000')
      : host;
  return `${protocol}//${h}`;
}

export function getWsBase() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL.replace(/\/$/, '');
  }
  if (typeof window === 'undefined') return 'ws://localhost:5000';
  const { protocol, host } = window.location;
  const wsHost = (host.includes(':5173') || host.includes(':5174') || host.includes(':5175') || host.includes(':5176'))
    ? host.replace(/:(517\d)$/, ':5000')
    : (host.includes('localhost') || host.includes('127.0.0.1'))
      ? host.replace(/:\d+$/, ':5000')
      : host;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${wsHost}`;
}
