/**
 * useLocationStore.js
 *
 * Persisted location state — tracks both display strings and real lat/lon
 * coordinates forwarded to the backend with every search/home request.
 *
 * Default coords: Koramangala, Bengaluru (same as backend default).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useLocationStore = create(
  persist(
    (set) => ({
      // ── UI display strings ─────────────────────────────────────────────────
      isLocationOpen: false,
      locationTitle:  'Delivery Location',
      locationFull:   'Select your address',
      isSet:          false,

      // ── Real coordinates (sent to backend) ────────────────────────────────
      lat: 12.9352,
      lon: 77.6245,

      // ── Actions ───────────────────────────────────────────────────────────
      openLocation:  () => set({ isLocationOpen: true }),
      closeLocation: () => set({ isLocationOpen: false }),

      /**
       * Called when the user confirms a location.
       * @param {string} title  - Short label shown in the navbar ("Home", "Koramangala"…)
       * @param {string} full   - Full address string shown below the title
       * @param {number} [lat]  - Latitude  (optional — falls back to default)
       * @param {number} [lon]  - Longitude (optional — falls back to default)
       */
      setLocation: (title, full, lat, lon) =>
        set({
          locationTitle:  title,
          locationFull:   full,
          isLocationOpen: false,
          isSet:          true,
          // Only update coords when real values are provided
          ...(lat != null && lon != null ? { lat, lon } : {}),
        }),
    }),
    {
      name: 'nexus-location',
      // Only persist coords and display strings; not the modal-open flag
      partialize: (s) => ({
        locationTitle: s.locationTitle,
        locationFull:  s.locationFull,
        isSet:         s.isSet,
        lat:           s.lat,
        lon:           s.lon,
      }),
    }
  )
);

export default useLocationStore;
