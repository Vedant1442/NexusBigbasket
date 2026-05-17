/**
 * useAuth — wraps useAuthStore for declarative authentication access.
 *
 * Usage:
 *   const { isAuthenticated, user, step, requestOtp, confirmOtp, signOut } = useAuth();
 */
import useAuthStore from '../store/useAuthStore';

export function useAuth() {
  const {
    token,
    user,
    phone,
    requestId,
    isLoading,
    error,
    step,
    requestOtp,
    confirmOtp,
    signOut,
    clearError,
    resetToPhone,
  } = useAuthStore();

  return {
    /** Whether the user is authenticated (token present) */
    isAuthenticated: !!token,
    /** JWT/session token (typically not needed directly by UI) */
    token,
    /** User profile object: { name, phone, ... } */
    user,
    /** Phone number being verified (transient, during OTP flow) */
    phone,
    /** Current auth flow step: 'idle' | 'otp_sent' | 'verifying' | 'done' */
    step,
    /** Whether an async auth action is in progress */
    isLoading,
    /** Error message string (null when no error) */
    error,

    /**
     * Step 1 — request an OTP for the given phone number.
     * @param {string} phone  e.g. "+919876543210"
     */
    requestOtp,

    /**
     * Step 2 — verify the OTP entered by the user.
     * Uses the phone and requestId stored from step 1.
     * @param {string} otp  6-digit code
     */
    confirmOtp,

    /** Sign out and clear all auth state. */
    signOut,

    /** Clear the current error message. */
    clearError,

    /** Go back to the phone entry step from the OTP entry step. */
    resetToPhone,
  };
}
