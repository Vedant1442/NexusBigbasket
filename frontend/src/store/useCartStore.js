import { create } from 'zustand';

const useCartStore = create((set, get) => ({
  cart: {}, // { productId: { product, quantity } }
  isCartOpen: false,
  
  toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),
  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),

  addItem: (product) => set((state) => {
    const id = product.id;
    const existing = state.cart[id];
    return {
      cart: { 
        ...state.cart, 
        [id]: { 
          product, 
          quantity: (existing?.quantity || 0) + 1 
        } 
      }
    };
  }),

  removeItem: (id) => set((state) => {
    const newCart = { ...state.cart };
    if (newCart[id]) {
      if (newCart[id].quantity > 1) {
        newCart[id].quantity -= 1;
      } else {
        delete newCart[id];
      }
    }
    return { cart: newCart };
  }),

  clearCart: () => set({ cart: {} }),

  // Computed totals
  getCartCount: () => {
    const { cart } = get();
    return Object.values(cart).reduce((a, b) => a + b.quantity, 0);
  },
  
  getSubtotal: () => {
    const { cart } = get();
    return Object.values(cart).reduce((acc, item) => {
      const price = typeof item.product.price === 'string' 
        ? parseFloat(item.product.price.replace('₹', '')) 
        : item.product.price;
      return acc + (price * item.quantity);
    }, 0);
  }
}));

export default useCartStore;
