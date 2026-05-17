/**
 * useLocation — wraps useLocationStore for declarative location access.
 *
 * Usage:
 *   const { isSet, title, full, lat, lon, open, close, setLocation } = useLocation();
 */
import useLocationStore from '../store/useLocationStore';

export function useLocation() {
  const {
    isLocationOpen,
    locationTitle,
    locationFull,
    isSet,
    lat,
    lon,
    openLocation,
    closeLocation,
    setLocation,
  } = useLocationStore();

  return {
    /** Whether location modal is open */
    isLocationOpen,
    /** Short display title (e.g. "Home", "Koramangala") */
    title: locationTitle,
    /** Full address string */
    full: locationFull,
    /** Whether a location has been explicitly set by the user */
    isSet,
    /** Decimal latitude — default Koramangala if not explicitly set */
    lat,
    /** Decimal longitude — default Koramangala if not explicitly set */
    lon,
    /** Open the location modal */
    open: openLocation,
    /** Close the location modal */
    close: closeLocation,
    /**
     * Confirm a location selection.
     * @param {string} title - Short display label
     * @param {string} full  - Full address string
     * @param {number} [lat] - Latitude (falls back to default if omitted)
     * @param {number} [lon] - Longitude (falls back to default if omitted)
     */
    setLocation,
  };
}
