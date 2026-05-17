/**
 * useCart — wraps useCartStore for clean, declarative cart access.
 *
 * Usage:
 *   const { cartItems, count, subtotal, addItem, removeItem, clearCart, open } = useCart();
 */
import { useCallback } from 'react';
import useCartStore from '../store/useCartStore';

export function useCart() {
  const {
    cart,
    isCartOpen,
    openCart,
    closeCart,
    toggleCart,
    addItem: _addItem,
    removeItem: _removeItem,
    clearCart: _clearCart,
    getCartCount,
    getSubtotal,
  } = useCartStore();

  /**
   * Flat array of cart line items: { product, quantity }[]
   */
  const cartItems = Object.values(cart);

  /**
   * Total item count (sum of quantities).
   */
  const count = getCartCount();

  /**
   * Total price in rupees.
   */
  const subtotal = getSubtotal();

  /**
   * Get the quantity of a specific product in the cart.
   * Returns 0 if the product is not in the cart.
   * @param {string} productId
   */
  const getItemQty = useCallback(
    (productId) => cart[productId]?.quantity ?? 0,
    [cart],
  );

  const addItem    = useCallback((product)    => _addItem(product),    [_addItem]);
  const removeItem = useCallback((productId) => _removeItem(productId), [_removeItem]);
  const clearCart  = useCallback(()          => _clearCart(),           [_clearCart]);

  return {
    /** Raw cart object: { [productId]: { product, quantity } } */
    cart,
    /** Flat array of line items */
    cartItems,
    /** Total quantity across all items */
    count,
    /** Subtotal in ₹ */
    subtotal,
    /** Whether the cart drawer is open */
    isCartOpen,
    /** Open the cart drawer */
    open: openCart,
    /** Close the cart drawer */
    close: closeCart,
    /** Toggle the cart drawer */
    toggle: toggleCart,
    /** Add a product (increments quantity if already in cart) */
    addItem,
    /** Decrement quantity; removes if quantity reaches 0 */
    removeItem,
    /** Empty the cart */
    clearCart,
    /** Look up qty for a single product */
    getItemQty,
  };
}
