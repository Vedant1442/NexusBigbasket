import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, ChevronRight, Zap } from 'lucide-react';
import useCartStore from '../../store/useCartStore';
import useAuthStore from '../../store/useAuthStore';

export default function CartDrawer() {
  const { isCartOpen, closeCart, cart, getCartCount, getSubtotal, removeItem, addItem, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const [isCheckingOut, setIsCheckingOut] = React.useState(false);

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    try {
      const items = Object.values(cart).map(i => ({ 
        id: i.product.id, 
        name: i.product.name, 
        price: i.product.price, 
        quantity: i.quantity,
        image: i.product.image || i.product.imageUrl
      }));
      const subtotal = getSubtotal();
      
      const res = await fetch('http://localhost:5000/api/auth/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id || null, items, totalAmount: subtotal + 2 })
      });
      
      if (!res.ok) throw new Error("Failed to purchase");

      clearCart();
      closeCart();
      alert('Order placed successfully! ' + (user ? 'Saved to your purchase history.' : 'Create an account to save history next time.'));
    } catch (e) {
      alert('Failed to place order: ' + e.message);
    }
    setIsCheckingOut(false);
  };

  const totalItems = getCartCount();
  const subtotal = getSubtotal();

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full md:w-[420px] bg-gray-50 dark:bg-[#0b0b0b] z-[110] shadow-2xl flex flex-col transition-colors duration-300"
          >
            {/* Header */}
            <div className="bg-white dark:bg-[#1a1a1a] px-6 py-5 flex items-center justify-between border-b border-gray-100 dark:border-white/5 z-10">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-xl">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">My Cart</h2>
                  <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{totalItems} Item{totalItems !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button onClick={closeCart} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition group">
                <X className="w-5 h-5 text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
              
              {/* Empty State */}
              {totalItems === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center pb-20">
                  <div className="w-32 h-32 bg-white dark:bg-white/5 rounded-full flex items-center justify-center mb-6 shadow-soft">
                    <ShoppingBag className="w-12 h-12 text-gray-200 dark:text-white/10" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Your cart is empty</h3>
                  <p className="text-sm text-gray-500 max-w-[240px]">Looks like you haven't added any products to your cart yet.</p>
                  <button 
                    onClick={closeCart} 
                    className="mt-8 bg-primary text-white px-8 py-3.5 rounded-2xl font-black text-sm hover:bg-primary-hover transition shadow-md active:scale-95"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <>
                  {/* Delivery Info Box */}
                  <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-2xl">
                        🚚
                      </div>
                      <div>
                        <h4 className="font-black text-gray-900 dark:text-white text-sm">Blinkit · ~8 min</h4>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-tight">Quick commerce from Blinkit listings</p>
                      </div>
                    </div>
                  </div>

                  {/* Cart Items List */}
                  <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
                    {Object.values(cart).map(({ product, quantity }) => {
                      const price = typeof product.price === 'string' 
                        ? parseFloat(product.price.replace('₹', '')) 
                        : product.price;

                      return (
                        <div key={product.id} className="flex gap-4 p-4 border-b border-gray-50 dark:border-white/5 last:border-0 hover:bg-gray-50/50 dark:hover:bg-white/5 transition">
                          <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center p-2 border border-gray-100 dark:border-white/10 relative shrink-0">
                            <img 
                              src={product.image || product.imageUrl} 
                              alt={product.name} 
                              className="max-h-full max-w-full object-contain" 
                              onError={(e) => { e.target.src = 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png'; }}
                            />
                            {/* Source Indicator */}
                            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border-2 border-white flex items-center justify-center shadow-sm
                              ${product.source === 'blinkit' ? 'bg-yellow-400' : 
                                product.source === 'zepto' ? 'bg-purple-500' : 
                                product.source === 'instamart' ? 'bg-orange-500' : 'bg-green-600'}`}
                            >
                              <Zap className="w-3 h-3 text-white fill-white" />
                            </div>
                          </div>

                          <div className="flex-1 flex flex-col justify-between py-1">
                            <div>
                              <h4 className="text-[13px] font-black text-gray-800 dark:text-gray-100 leading-tight mb-1 line-clamp-2">{product.name}</h4>
                              <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight">{product.quantity || product.packSize}</p>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex flex-col">
                                <span className="font-black text-gray-900 dark:text-white text-sm">₹{price * quantity}</span>
                                {quantity > 1 && <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500">₹{price} × {quantity}</span>}
                              </div>
                              
                              {/* Quantity Control */}
                              <div className={`flex items-center rounded-xl h-8 w-22 shadow-sm border
                                ${product.source === 'blinkit' ? 'bg-yellow-400 border-yellow-500' : 
                                  product.source === 'zepto' ? 'bg-purple-500 border-purple-600' : 
                                  product.source === 'instamart' ? 'bg-orange-500 border-orange-600' : 'bg-green-600 border-green-700'}`}
                              >
                                <button 
                                  onClick={() => removeItem(product.id)} 
                                  className="flex-1 text-center text-white text-lg font-black hover:bg-black/5 rounded-l-xl transition"
                                >−</button>
                                <span className="w-8 text-center text-xs font-black text-white">{quantity}</span>
                                <button 
                                  onClick={() => addItem(product)} 
                                  className="flex-1 text-center text-white text-lg font-black hover:bg-black/5 rounded-r-xl transition"
                                >+</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bill Details */}
                  <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-white/5 space-y-4">
                    <h3 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-widest">Bill Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                        <span>Items Total</span>
                        <span className="text-gray-900 dark:text-white">₹{subtotal}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                        <span>Delivery Fee</span>
                        <div className="flex items-center gap-1.5">
                          <span className="line-through text-gray-300 font-medium">₹25</span>
                          <span className="text-primary">FREE</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                        <span>Handling Charge</span>
                        <span className="text-gray-900 dark:text-white">₹{2}</span>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex justify-between items-center">
                      <span className="font-black text-base text-gray-900 dark:text-white">Grand Total</span>
                      <span className="font-black text-xl text-gray-900 dark:text-white">₹{subtotal + 2}</span>
                    </div>
                  </div>

                  {/* Safety note */}
                  <div className="bg-blue-50/50 dark:bg-blue-500/5 rounded-2xl p-4 flex gap-3 border border-blue-100/50 dark:border-blue-500/10">
                    <div className="text-xl">🛡️</div>
                    <p className="text-[10px] font-bold text-blue-600/80 dark:text-blue-400/80 leading-relaxed uppercase tracking-tight">
                      Open each product on Blinkit from search results to buy at the listed price. Checkout here is a demo total.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Checkout Bar */}
            {totalItems > 0 && (
              <div className="bg-white dark:bg-[#1a1a1a] border-t border-gray-100 dark:border-white/5 p-6 pb-8 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                <button 
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className={`w-full ${isCheckingOut ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary-hover active:scale-[0.98]'} text-white rounded-2xl h-16 flex items-center justify-between px-6 transition shadow-lg shadow-primary/20`}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-lg font-black tracking-tight">₹{subtotal + 2}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Proceed to Pay</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest bg-white/20 px-4 py-2 rounded-xl">
                    {isCheckingOut ? 'Processing...' : 'Checkout'} <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
