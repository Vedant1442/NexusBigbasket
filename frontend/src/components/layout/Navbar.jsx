import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, ShoppingCart, Users, ChevronDown, Sun, Moon } from 'lucide-react';
import useCartStore from '../../store/useCartStore';
import useLocationStore from '../../store/useLocationStore';
import useSearchStore from '../../store/useSearchStore';
import useAuthStore from '../../store/useAuthStore';
import { useTheme } from '../../hooks/useTheme';

export default function Navbar() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState('');
  const { openCart, getCartCount } = useCartStore();
  const { locationTitle, locationFull, openLocation } = useLocationStore();
  const { isConnected } = useSearchStore();
  const { user, openAuthModal } = useAuthStore();
  const { isDark, toggleTheme } = useTheme();

  const totalItems = getCartCount();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-white dark:bg-[#0b0b0b]/80 dark:backdrop-blur-md border-b border-gray-100 dark:border-white/5 z-50 shadow-sm transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-[70px] gap-4 md:gap-8">

          {/* Logo */}
          <div className="flex items-center gap-1 cursor-pointer flex-shrink-0">
           <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-[#84c225] rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-200/50 group-hover:scale-105 transition-transform">
              <ShoppingCart className="w-6 h-6 fill-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">BigBasket</span>
              <span className="text-[10px] font-bold text-[#ed1c24] tracking-widest uppercase opacity-70">Hyperlocal Hub</span>
            </div>
          </Link>  {/* WS status dot */}
            <span className={`w-2 h-2 rounded-full ml-1 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} title={isConnected ? 'Scraper connected' : 'Scraper offline'} />
          </div>

          {/* Location Picker */}
          <div
            onClick={openLocation}
            className="hidden md:flex flex-col cursor-pointer max-w-[200px] hover:bg-gray-50 dark:hover:bg-white/5 px-3 py-1.5 rounded-xl transition overflow-hidden border border-transparent hover:border-gray-200 dark:hover:border-white/10"
          >
            <div className="flex items-center gap-1 text-xs font-extrabold text-gray-900 dark:text-gray-100 truncate uppercase tracking-wide">
              <span className="text-primary text-lg">📍</span>
              <span className="truncate">{locationTitle}</span>
              <ChevronDown className="w-3.5 h-3.5 ml-0.5 shrink-0 text-gray-400" />
            </div>
            <div className="text-[11px] text-gray-400 truncate pl-6 font-medium">{locationFull}</div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-2xl">
            <div className="relative flex items-center w-full h-11 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 overflow-hidden focus-within:bg-white dark:focus-within:bg-white/10 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
              <div className="pl-4 pr-2 text-gray-400 flex-shrink-0">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="main-search-input"
                type="text"
                placeholder='Search "milk", "chips", "eggs"...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-full bg-transparent border-none outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 text-sm font-medium"
              />
              {searchQuery && (
                <button
                  type="submit"
                  className="mr-2 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary-hover transition flex-shrink-0"
                >
                  Search
                </button>
              )}
            </div>
          </form>

          {/* Right actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition group"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">{isDark ? 'Light' : 'Dark'}</span>
            </button>

            {/* Group Cart */}
            <button
              onClick={() => navigate('/group-cart')}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/5 text-primary font-bold text-sm border border-primary/15 hover:bg-primary/10 transition"
            >
              <Users className="w-4 h-4" />
              <span className="hidden lg:inline">Group Cart</span>
            </button>

            {/* Profile / Sign In */}
            <button
              onClick={() => user ? navigate('/profile') : openAuthModal()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-bold text-sm border border-transparent hover:bg-gray-200 dark:hover:bg-white/10 transition"
            >
              {user ? (
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              ) : (
                <span className="hidden sm:inline">Sign In</span>
              )}
            </button>

            {/* Cart button */}
            <button
              onClick={openCart}
              className={`flex items-center gap-2 px-4 h-[44px] rounded-xl font-bold transition shadow-sm ${
                totalItems > 0
                  ? 'bg-primary text-white hover:bg-primary-hover'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              {totalItems > 0 ? (
                <span className="text-sm font-extrabold">{totalItems} item{totalItems > 1 ? 's' : ''}</span>
              ) : (
                <span className="text-sm hidden sm:inline">Cart</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
