import React, { useEffect, useState } from 'react';
import { Package, User, LogOut, Clock, ShoppingBag } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { getApiBase } from '../config/api';

export default function Profile() {
  const { user, openAuthModal, signOut } = useAuthStore();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/auth/profile/${user.id}`);
        const data = await res.json();
        if (data.history) {
          setHistory(data.history);
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-24 h-24 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
          <User className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">Sign in to view your profile</h2>
        <p className="text-gray-500 max-w-sm mb-8">Access your purchase history, saved locations, and more.</p>
        <button 
          onClick={openAuthModal}
          className="bg-primary text-white font-bold py-3 px-8 rounded-xl hover:bg-primary-hover transition"
        >
          Sign In / Sign Up
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm border border-gray-100 dark:border-white/5 mb-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center text-3xl font-black text-primary">
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-1">{user.name}</h1>
            <p className="text-gray-500 font-medium">{user.email}</p>
          </div>
        </div>
        <button 
          onClick={() => {
            signOut();
            navigate('/');
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 font-bold transition"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Order History */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Package className="w-6 h-6 text-gray-900 dark:text-white" />
          <h2 className="text-xl font-black text-gray-900 dark:text-white">Purchase History</h2>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-100 dark:bg-white/5 rounded-2xl"></div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-10 text-center border border-gray-100 dark:border-white/5">
            <ShoppingBag className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No orders yet</h3>
            <p className="text-gray-500">Your future purchases will appear here.</p>
            <button 
              onClick={() => navigate('/')}
              className="mt-6 text-primary font-bold hover:underline"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((order) => (
              <div key={order.id} className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 border border-gray-100 dark:border-white/5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 dark:border-white/5 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-md">Delivered</span>
                      {order.is_group === 1 && (
                        <span className="text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-1 rounded-md flex items-center gap-1">
                          Group Order
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">Order #{order.id.toString().padStart(6, '0')}</p>
                    {order.shared_with && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-medium">Shared with: {order.shared_with}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Amount</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white">₹{order.total_amount}</p>
                  </div>
                </div>

                <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {order.items.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-xl flex items-center justify-center p-2 mb-2 relative">
                        <img src={item.image || 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png'} alt={item.name} className="max-w-full max-h-full object-contain" />
                        <div className="absolute -top-2 -right-2 w-5 h-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-[10px] font-black flex items-center justify-center">
                          {item.quantity}
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-600 dark:text-gray-400 line-clamp-2 leading-tight">{item.name}</p>
                    </div>
                  ))}
                  {order.items.length > 5 && (
                    <div className="flex items-center justify-center w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-xl">
                      <span className="text-xs font-bold text-gray-500">+{order.items.length - 5} more</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
