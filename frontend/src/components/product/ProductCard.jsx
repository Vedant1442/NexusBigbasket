import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Zap } from 'lucide-react';
import useCartStore from '../../store/useCartStore';
import useGroupCartStore from '../../store/useGroupCartStore';

const SOURCE_STYLES = {
  blinkit: {
    badge: 'bg-yellow-400 text-yellow-900',
    addBtn: 'border-yellow-500 text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 dark:bg-transparent dark:text-yellow-500',
    counterBg: 'bg-yellow-400 text-yellow-900',
    label: 'Blinkit',
  },
  zepto: {
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
    addBtn: 'border-purple-400 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-500/10 dark:bg-transparent dark:text-purple-400',
    counterBg: 'bg-purple-500 text-white',
    label: 'Zepto',
  },
  instamart: {
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
    addBtn: 'border-orange-400 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-500/10 dark:bg-transparent dark:text-orange-400',
    counterBg: 'bg-orange-500 text-white',
    label: 'Instamart',
  },
  bigbasket: {
    badge: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300',
    addBtn: 'border-green-500 text-green-700 hover:bg-green-50 dark:hover:bg-green-500/10 dark:bg-transparent dark:text-green-500',
    counterBg: 'bg-green-600 text-white',
    label: 'BigBasket',
  },
};

export default function ProductCard({ product }) {
  const { cart, addItem, removeItem } = useCartStore();
  const { basket, addItem: addGroupItem, removeItem: removeGroupItem, userName } = useGroupCartStore();
  
  const inGroup = !!basket;
  const qty = inGroup 
    ? (basket.items.find(i => i.product.id === product.id)?.quantity || 0)
    : (cart[product.id]?.quantity || 0);
    
  const style = SOURCE_STYLES[product.source] || SOURCE_STYLES.blinkit;

  const hasDiscount = product.discount > 0;
  const hasMRP = product.mrp && product.mrp > product.price && product.mrp !== product.price;

  return (
    <div className="w-[160px] md:w-[180px] rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/5 overflow-hidden relative flex flex-col transition hover:shadow-md hover:-translate-y-0.5 duration-200 group cursor-pointer flex-shrink-0">

      {/* Discount Badge */}
      {hasDiscount && (
        <div className="absolute top-2 left-2 bg-green-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md z-10 shadow-sm">
          {product.discount}% OFF
        </div>
      )}

      {/* Image */}
      <div className="h-[120px] w-full bg-gray-50 dark:bg-white/5 flex items-center justify-center p-3 relative overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-300"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-xl flex items-center justify-center text-2xl">🛒</div>
        )}
        {/* View link */}
        {product.productUrl && product.productUrl !== '#' && (
          <a
            href={product.productUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute top-1.5 right-1.5 bg-white/90 dark:bg-[#1a1a1a]/90 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Content */}
      <div className="p-2.5 flex flex-col flex-1">
        {/* Source + Delivery */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md ${style.badge}`}>
            {style.label}
          </span>
          {product.deliveryTime && (
            <span className="text-[9px] font-semibold text-gray-400 flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" />{product.deliveryTime}
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-snug mb-1 line-clamp-2 min-h-[30px]">
          {product.name}
        </h3>
        {product.rating != null && Number.isFinite(product.rating) && (
          <p className="text-[10px] font-semibold text-amber-700 mb-1">
            ★ {product.rating.toFixed(1)}
            {product.ratingCount != null && product.ratingCount > 0
              ? ` (${product.ratingCount > 999 ? `${Math.round(product.ratingCount / 1000)}k` : product.ratingCount})`
              : ''}
          </p>
        )}

        {/* Quantity */}
        {product.quantity && (
          <div className="text-[10px] font-semibold text-gray-400 mb-2">{product.quantity}</div>
        )}

        {/* Price + Add Button */}
        <div className="mt-auto flex items-end justify-between gap-1">
          <div className="flex flex-col">
            <span className="text-sm font-black text-gray-900 dark:text-white">
              {product.price > 0 ? `₹${product.price}` : '—'}
            </span>
            {hasMRP && (
              <span className="text-[10px] text-gray-400 line-through font-medium">₹{product.mrp}</span>
            )}
          </div>

          {/* Add / Counter */}
          <div className="h-8 w-[62px] relative flex-shrink-0">
            <AnimatePresence mode="wait">
              {qty === 0 ? (
                <motion.button
                  key="add"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={(e) => { 
                    e.preventDefault(); 
                    if (inGroup) addGroupItem(product);
                    else addItem(product); 
                  }}
                  className={`absolute inset-0 w-full h-full border-2 font-black text-xs rounded-xl bg-white dark:bg-transparent transition ${style.addBtn}`}
                >
                  ADD
                </motion.button>
              ) : (
                <motion.div
                  key="counter"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`absolute inset-0 w-full h-full rounded-xl flex items-center justify-between px-1.5 shadow-sm ${style.counterBg}`}
                >
                  <button
                    onClick={(e) => { 
                      e.preventDefault(); 
                      if (inGroup) removeGroupItem(product.id);
                      else removeItem(product.id); 
                    }}
                    className="text-base font-bold w-5 text-center hover:opacity-70 active:scale-90"
                  >−</button>
                  <span className="text-xs font-black">{qty}</span>
                  <button
                    onClick={(e) => { 
                      e.preventDefault(); 
                      if (inGroup) addGroupItem(product);
                      else addItem(product); 
                    }}
                    className="text-base font-bold w-5 text-center hover:opacity-70 active:scale-90"
                  >+</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
