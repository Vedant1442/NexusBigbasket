/**
 * useHomeContent — declarative hook for Home page data.
 *
 * Subscribes to home categories and featured products from useSearchStore.
 * Automatically re-fetches when connection drops and reconnects.
 *
 * Usage:
 *   const { categories, featuredProducts, isConnected, refetch } = useHomeContent();
 */
import { useEffect, useCallback } from 'react';
import useSearchStore from '../store/useSearchStore';

export function useHomeContent() {
  const {
    categories,
    featuredProducts,
    isConnected,
    fetchHomeContent,
  } = useSearchStore();

  const refetch = useCallback(() => {
    if (isConnected) fetchHomeContent();
  }, [isConnected, fetchHomeContent]);

  // Auto-fetch when WS connects (or reconnects)
  useEffect(() => {
    if (isConnected) {
      fetchHomeContent();
    }
  }, [isConnected, fetchHomeContent]);

  return {
    /** Categories array from backend (may be empty while loading) */
    categories,
    /** Featured products array from backend (may be empty while loading) */
    featuredProducts,
    /** Whether the WebSocket connection to the backend is active */
    isConnected,
    /** Manually re-trigger a home content fetch */
    refetch,
  };
}
