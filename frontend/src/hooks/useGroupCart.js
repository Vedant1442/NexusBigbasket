/**
 * useGroupCart — wraps useGroupCartStore for clean, declarative group cart access.
 *
 * Usage:
 *   const { isActive, basket, shareCode, isHost, userName, addItem, removeItem } = useGroupCart();
 */
import { useCallback } from 'react';
import useGroupCartStore from '../store/useGroupCartStore';

export function useGroupCart() {
  const {
    basket,
    shareCode,
    isHost,
    userName,
    notification,
    createBasket: _createBasket,
    joinBasket: _joinBasket,
    addItem: _addItem,
    removeItem: _removeItem,
    leaveBasket: _leaveBasket,
    syncFromRemote,
  } = useGroupCartStore();

  /**
   * Whether a group basket is currently active.
   */
  const isActive = !!basket;

  /**
   * Total item count in the group basket.
   */
  const itemCount = basket?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  /**
   * Get the quantity of a specific product in the group basket.
   * @param {string} productId
   */
  const getItemQty = useCallback(
    (productId) => basket?.items.find((i) => i.product.id === productId)?.quantity ?? 0,
    [basket],
  );

  /**
   * Create a new group basket as host.
   * @param {string} hostName
   * @returns {string} shareCode
   */
  const createBasket = useCallback((hostName) => _createBasket(hostName), [_createBasket]);

  /**
   * Join an existing group basket as a guest.
   * @param {string} shareCode
   * @param {string} guestName
   */
  const joinBasket = useCallback(
    (code, guestName) => _joinBasket(code, guestName),
    [_joinBasket],
  );

  /**
   * Add a product to the group basket.
   * @param {object} product
   */
  const addItem = useCallback((product) => _addItem(product), [_addItem]);

  /**
   * Remove one unit of a product from the group basket.
   * @param {string} productId
   */
  const removeItem = useCallback((productId) => _removeItem(productId), [_removeItem]);

  /**
   * Leave the current group basket (clears local state).
   */
  const leaveBasket = useCallback(() => _leaveBasket(), [_leaveBasket]);

  return {
    /** Full basket object or null if no basket is active */
    basket,
    /** Whether the user is currently in a group basket */
    isActive,
    /** The 6-char share code for the current basket */
    shareCode,
    /** Whether the current user is the basket host */
    isHost,
    /** The current user's display name in the basket */
    userName,
    /** Toast notification (transient) from add operations */
    notification,
    /** Total item count across all members */
    itemCount,
    /** Basket member list */
    members: basket?.members ?? [],
    /** Basket line items */
    items: basket?.items ?? [],
    /** Basket total price */
    totalPrice: basket?.totalPrice ?? 0,
    /** Look up qty for a single product in the group basket */
    getItemQty,
    createBasket,
    joinBasket,
    addItem,
    removeItem,
    leaveBasket,
    syncFromRemote,
  };
}
