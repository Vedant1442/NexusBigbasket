/**
 * hooks/index.js — barrel export for all custom hooks.
 *
 * Import from here to keep component imports clean:
 *   import { useCart, useSearch, useTheme } from '../hooks';
 */

export { useSearch }        from './useSearch';
export { useHomeContent }   from './useHomeContent';
export { useLocation }      from './useLocation';
export { useCart }          from './useCart';
export { useGroupCart }     from './useGroupCart';
export { useAuth }          from './useAuth';
export { useTheme }         from './useTheme';
