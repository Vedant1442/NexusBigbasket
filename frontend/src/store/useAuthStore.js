import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthModalOpen: false,
      isLoading: false,
      error: null,
      
      get isAuthenticated() { return !!get().user; },

      openAuthModal: () => set({ isAuthModalOpen: true }),
      closeAuthModal: () => set({ isAuthModalOpen: false }),

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          set({ user: { id: data.userId, name: data.name, email: data.email }, isAuthModalOpen: false, isLoading: false });
        } catch (err) {
          set({ error: err.message, isLoading: false });
        }
      },

      signup: async (name, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch('http://localhost:5000/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          set({ user: { id: data.userId, name: data.name, email: data.email }, isAuthModalOpen: false, isLoading: false });
        } catch (err) {
          set({ error: err.message, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),

      signOut: () => set({ user: null })
    }),
    { 
      name: 'nexus-auth',
      partialize: (s) => ({ user: s.user })
    }
  )
);

export default useAuthStore;
