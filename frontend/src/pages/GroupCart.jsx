import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Share2, Copy, Trash2, ArrowRight, UserPlus, Shield, Sparkles, CheckCircle2 } from 'lucide-react';
import useGroupCartStore from '../store/useGroupCartStore';
import useAuthStore from '../store/useAuthStore';
import { getApiBase } from '../config/api';

export default function GroupCart() {
  const [searchParams] = useSearchParams();
  const joinCodeParam = searchParams.get('join');
  const navigate = useNavigate();

  const { 
    basket, 
    createBasket, 
    joinBasket, 
    leaveBasket, 
    notification, 
    userName,
    isHost,
    initiateCheckout,
    confirmCheckout,
    cancelCheckout
  } = useGroupCartStore();

  const { user } = useAuthStore();
  const [isProcessingFinal, setIsProcessingFinal] = useState(false);

  const handleFinalCheckout = useCallback(async () => {
    if (!basket || isProcessingFinal) return;
    setIsProcessingFinal(true);
    try {
      const items = basket.items.map(i => ({
        id: i.product.id,
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity,
        image: i.product.image || i.product.imageUrl,
        addedBy: i.addedBy
      }));
      
      const sharedWith = basket.members.map(m => m.name).filter(n => n !== basket.hostName);

      const res = await fetch(`${getApiBase()}/api/auth/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user?.id || null, 
          items, 
          totalAmount: basket.totalPrice + 2,
          isGroup: true,
          sharedWith: sharedWith.join(', ')
        })
      });
      
      if (!res.ok) throw new Error("Failed to purchase");

      alert('Group order placed successfully!');
      leaveBasket();
      navigate('/');
    } catch (e) {
      alert('Failed to place order: ' + e.message);
    } finally {
      setIsProcessingFinal(false);
    }
  }, [basket, user, leaveBasket, navigate, isProcessingFinal]);

  useEffect(() => {
    if (basket?.checkoutStatus === 'completed') {
      if (isHost && !isProcessingFinal) {
        // Use setTimeout to avoid synchronous setState in effect
        const timer = setTimeout(handleFinalCheckout, 0);
        return () => clearTimeout(timer);
      } else if (!isHost) {
        const timer = setTimeout(() => {
          if (!basket) navigate('/'); 
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [basket?.checkoutStatus, isHost, basket, isProcessingFinal, handleFinalCheckout, navigate]);

  const [mode, setMode] = useState(joinCodeParam ? 'join' : 'choice');
  const [name, setName] = useState(userName || '');
  const [joinCode, setJoinCode] = useState(joinCodeParam || '');

  // Adjust state when joinCodeParam changes externally
  const [prevJoinCodeParam, setPrevJoinCodeParam] = useState(joinCodeParam);
  if (joinCodeParam !== prevJoinCodeParam) {
    setJoinCode(joinCodeParam || '');
    setPrevJoinCodeParam(joinCodeParam);
    if (joinCodeParam && !basket) {
       setMode('join');
    }
  }

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    createBasket(name);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!name.trim() || !joinCode.trim()) return;
    joinBasket(joinCode.toUpperCase(), name);
  };

  const copyCode = () => {
    if (!basket) return;
    navigator.clipboard.writeText(basket.shareCode);
    alert('Code copied to clipboard!');
  };

  const shareLink = () => {
    if (!basket) return;
    const url = `${window.location.origin}/group-cart?join=${basket.shareCode}`;
    navigator.clipboard.writeText(url);
    alert('Share link copied to clipboard!');
  };

  // ── Step 1: Choice Screen ──────────────────────────────────────────────────
  if (!basket) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-4">Shared Shopping</h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto font-medium">
            Shop together with friends and family. Split delivery fees, unlock bulk discounts, and see what others are adding in real-time.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Create Card */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-[#1a1a1a] p-8 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-soft flex flex-col items-center text-center group"
          >
            <div className="w-16 h-16 bg-green-50 dark:bg-green-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition">
              <Sparkles className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Start a Group</h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-8 font-medium">Create a new basket and invite others to join via a secret code.</p>
            <button 
              onClick={() => setMode('create')}
              className="mt-auto w-full bg-gray-900 dark:bg-primary text-white py-4 rounded-2xl font-black text-sm hover:bg-black dark:hover:bg-primary/80 transition shadow-lg active:scale-95"
            >
              Create New Basket
            </button>
          </motion.div>

          {/* Join Card */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-[#1a1a1a] p-8 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-soft flex flex-col items-center text-center group"
          >
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition">
              <UserPlus className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Join a Group</h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-8 font-medium">Enter a friend's share code to start adding items to their shared cart.</p>
            <button 
              onClick={() => setMode('join')}
              className="mt-auto w-full bg-white dark:bg-white/5 text-gray-900 dark:text-white border-2 border-gray-100 dark:border-white/10 py-4 rounded-2xl font-black text-sm hover:bg-50 dark:hover:bg-white/10 transition active:scale-95"
            >
              Enter Join Code
            </button>
          </motion.div>
        </div>

        {/* Forms */}
        <AnimatePresence mode="wait">
          {mode === 'create' && (
            <motion.form 
              key="create"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              onSubmit={handleCreate} className="mt-12 max-w-sm mx-auto bg-white dark:bg-[#1a1a1a] p-8 rounded-3xl border border-primary/20 shadow-xl"
            >
              <h4 className="text-lg font-black mb-4 dark:text-white">Set your display name</h4>
              <input 
                autoFocus
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Rahul"
                className="w-full bg-gray-50 dark:bg-white/5 border-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-white/10 p-4 rounded-2xl outline-none font-bold text-gray-900 dark:text-white transition mb-4"
              />
              <button className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-lg">Start Session</button>
            </motion.form>
          )}

          {mode === 'join' && (
            <motion.form 
              key="join"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              onSubmit={handleJoin} className="mt-12 max-w-sm mx-auto bg-white dark:bg-[#1a1a1a] p-8 rounded-3xl border border-blue-200 dark:border-blue-500/20 shadow-xl"
            >
              <h4 className="text-lg font-black mb-4 dark:text-white">Join shared basket</h4>
              <input 
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Your Name"
                className="w-full bg-gray-50 dark:bg-white/5 border-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-white/10 p-4 rounded-2xl outline-none font-bold text-gray-900 dark:text-white transition mb-3"
              />
              <input 
                type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Share Code (e.g. AB12CD)"
                className="w-full bg-gray-50 dark:bg-white/5 border-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-white/10 p-4 rounded-2xl outline-none font-bold text-gray-900 dark:text-white transition mb-4 uppercase"
              />
              <button className="w-full bg-gray-900 dark:bg-primary text-white py-4 rounded-2xl font-black shadow-lg">Join Now</button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Step 2: Active Basket Screen ──────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-32">
      {/* Collaborative Checkout Overlay */}
      <AnimatePresence>
        {basket.checkoutStatus === 'pending' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1a1a1a] w-full max-w-lg rounded-[40px] p-10 shadow-2xl border border-white/10"
            >
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">Wait for Others?</h2>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  {basket.checkoutInitiatedBy} has initiated checkout. Everyone must confirm before proceeding.
                </p>
              </div>

              {/* Confirmation Status */}
              <div className="space-y-4 mb-10">
                {basket.members.map((m, i) => {
                  const hasConfirmed = basket.confirmations.includes(m.name);
                  return (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: m.color }}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-gray-700 dark:text-gray-300">{m.name}</span>
                      </div>
                      {hasConfirmed ? (
                        <div className="flex items-center gap-2 text-green-500 font-black text-xs uppercase tracking-widest">
                          <CheckCircle2 className="w-4 h-4" /> Ready
                        </div>
                      ) : (
                        <div className="text-gray-400 font-black text-xs uppercase tracking-widest animate-pulse">
                          Waiting...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={cancelCheckout}
                  className="py-4 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded-2xl font-black text-sm hover:bg-gray-200 dark:hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                {basket.confirmations.includes(userName) ? (
                  <div className="py-4 bg-green-500/20 text-green-500 rounded-2xl font-black text-sm flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Confirmed
                  </div>
                ) : (
                  <button 
                    onClick={confirmCheckout}
                    className="py-4 bg-primary text-white rounded-2xl font-black text-sm hover:bg-primary-hover shadow-lg shadow-primary/20 transition active:scale-95"
                  >
                    Confirm & Buy
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row gap-6 items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-primary/20">Active Session</span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Host: {basket.hostName}</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            Shared Basket <Users className="w-6 h-6 text-primary" />
          </h1>
        </div>

        {/* Share Card */}
        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-soft flex items-center gap-6">
          <div>
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Share Code</p>
            <div className="text-2xl font-black text-primary tracking-widest">{basket.shareCode}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={copyCode} className="p-3 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-2xl transition group" title="Copy Code">
              <Copy className="w-5 h-5 text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
            </button>
            <button onClick={shareLink} className="p-3 bg-primary text-white rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 transition active:scale-95" title="Share Link">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Item List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-[32px] border border-gray-100 dark:border-white/5 shadow-soft overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-50 dark:border-white/5 bg-gray-50/30 dark:bg-white/5 flex items-center justify-between">
              <h3 className="font-black text-lg text-gray-900 dark:text-white">Group Items ({basket.items.length})</h3>
              <div className="flex items-center -space-x-2">
                {basket.members.map((m, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-sm" style={{ backgroundColor: m.color }} title={m.name}>
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>

            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {basket.items.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="text-4xl mb-4">🛒</div>
                  <p className="text-gray-400 font-bold">Basket is empty. Go add some products!</p>
                </div>
              ) : (
                basket.items.map((item, idx) => (
                  <div key={idx} className="p-6 flex items-center gap-6 group hover:bg-gray-50/50 dark:hover:bg-white/5 transition">
                    <img src={item.product.image || item.product.imageUrl} className="w-20 h-20 object-contain rounded-2xl border border-gray-100 dark:border-white/10 p-2 bg-white" alt={item.product.name} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase text-primary bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">
                          {item.product.source}
                        </span>
                        <span className="text-[9px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-widest">Added by {item.addedBy}</span>
                      </div>
                      <h4 className="font-black text-gray-800 dark:text-white text-sm mb-1">{item.product.name}</h4>
                      <p className="text-xs font-bold text-gray-400 dark:text-gray-500">{item.product.quantity}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-black text-gray-900 dark:text-white">₹{(typeof item.product.price === 'string' ? parseFloat(item.product.price.replace('₹','')) : item.product.price) * item.quantity}</div>
                        {item.quantity > 1 && <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500">₹{item.product.price} × {item.quantity}</div>}
                      </div>
                      <button onClick={() => useGroupCartStore.getState().removeItem(item.product.id)} className="p-2 text-gray-300 hover:text-red-500 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Summary & Members */}
        <div className="space-y-6">
          {/* Members Card */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-[32px] p-6 border border-gray-100 dark:border-white/5 shadow-soft">
            <h3 className="font-black text-sm uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">Group Members</h3>
            <div className="space-y-4">
              {basket.members.map((m, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white" style={{ backgroundColor: m.color }}>
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-800 dark:text-white">{m.name} {m.name === userName && '(You)'}</p>
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight">{m.isHost ? 'Session Host' : 'Member'}</p>
                    </div>
                  </div>
                  {m.isHost && <Shield className="w-4 h-4 text-green-500" />}
                </div>
              ))}
            </div>
          </div>

          {/* Savings Box */}
          <div className="bg-green-600 rounded-[32px] p-8 text-white shadow-lg shadow-green-600/20 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-lg font-black mb-2">Group Savings</h3>
              <div className="text-4xl font-black mb-2">₹{Math.round(basket.totalPrice * 0.15)}</div>
              <p className="text-white/80 text-xs font-bold leading-relaxed uppercase tracking-tight">You've unlocked free delivery & group discount!</p>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full" />
          </div>

          {/* Checkout Info */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-[32px] p-8 border border-gray-100 dark:border-white/5 shadow-soft">
            <div className="flex justify-between items-center mb-6">
              <span className="font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-xs">Total Bill</span>
              <span className="text-2xl font-black text-gray-900 dark:text-white">₹{basket.totalPrice}</span>
            </div>
            <button 
              onClick={initiateCheckout}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-lg shadow-primary/20 flex items-center justify-center gap-2 group transition active:scale-95"
            >
              Proceed to Checkout <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
            </button>
            <button 
              onClick={() => { if(window.confirm('Leave group?')) leaveBasket(); }}
              className="w-full mt-4 text-gray-400 font-bold text-xs uppercase tracking-widest hover:text-red-500 transition"
            >
              Leave Group Session
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 min-w-[320px]"
          >
            <div className="w-8 h-8 bg-primary/20 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-black">{notification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
