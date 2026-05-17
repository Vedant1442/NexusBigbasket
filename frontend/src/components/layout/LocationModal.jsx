import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Navigation, Home, Briefcase, X } from 'lucide-react';
import useLocationStore from '../../store/useLocationStore';
import useSearchStore from '../../store/useSearchStore';

export default function LocationModal() {
  const { isLocationOpen, closeLocation, setLocation } = useLocationStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5`);
        const data = await res.json();
        setResults(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeoutRef.current);
  }, [query]);

  const handleSelect = (title, full) => {
    setLocation(title, full);
    useSearchStore.getState().setLocation(full);
    setQuery('');
  };

  const handleGPS = () => {
    setIsLoading(true);
    // Mocking GPS delay
    setTimeout(() => {
      const title = 'Current Location';
      const full = 'GPS Coordinates 19.07, 72.87';
      setLocation(title, full);
      useSearchStore.getState().setLocation(full);
      setIsLoading(false);
      setQuery('');
    }, 1000);
  };

  return (
    <AnimatePresence>
      {isLocationOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLocation}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:bottom-auto md:top-20 w-full md:w-[450px] bg-white dark:bg-[#0b0b0b] rounded-t-3xl md:rounded-3xl z-[210] overflow-hidden flex flex-col h-[85vh] md:h-[600px] transition-colors duration-300"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between sticky top-0 bg-white dark:bg-[#1a1a1a] z-10">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Select Delivery Location</h2>
              <button onClick={closeLocation} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition">
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 bg-white dark:bg-[#1a1a1a] z-10 shadow-sm relative">
              <div className="relative flex items-center w-full h-12 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 overflow-hidden focus-within:bg-white dark:focus-within:bg-white/10 focus-within:border-primary focus-within:shadow-soft transition-all">
                <div className="pl-4 pr-2 text-gray-400">
                  <Search className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="Search for your area, apartment or street"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full h-full bg-transparent border-none outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 text-sm font-medium"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Detect Location Button */}
              {!query && (
                <div 
                  onClick={handleGPS}
                  className="mx-4 mt-4 p-4 border border-gray-200 dark:border-white/10 rounded-xl flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition"
                >
                  <div className="text-brand-red">
                    <Navigation className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-brand-red text-sm">Detect current location</h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Using GPS & Device Location</p>
                  </div>
                </div>
              )}

              {/* Saved Addresses (Mock) */}
              {!query && (
                <div className="px-4 mt-8 pb-8">
                  <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-4 tracking-wider uppercase">Saved Addresses</h3>
                  
                  <div 
                    onClick={() => handleSelect('Home', 'A-12, Green Park, New Delhi')}
                    className="flex items-start gap-4 py-4 border-b border-gray-100 dark:border-white/5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <div className="bg-gray-100 dark:bg-white/10 p-2.5 rounded-full text-gray-600 dark:text-gray-400">
                      <Home className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">Home</h4>
                      <p className="text-xs text-gray-500 mt-1">A-12, Green Park, New Delhi</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleSelect('Office', 'Cyber Hub, DLF Phase 2, Gurugram')}
                    className="flex items-start gap-4 py-4 border-b border-gray-100 dark:border-white/5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <div className="bg-gray-100 dark:bg-white/10 p-2.5 rounded-full text-gray-600 dark:text-gray-400">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">Office</h4>
                      <p className="text-xs text-gray-500 mt-1">Cyber Hub, DLF Phase 2, Gurugram</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Search Results */}
              {query && (
                <div className="pb-8">
                  {isLoading ? (
                    <div className="p-4 text-sm font-medium text-gray-500 text-center mt-4">
                      Searching across India...
                    </div>
                  ) : results.length > 0 ? (
                    results.map((m, i) => {
                      const parts = m.display_name.split(',');
                      const title = parts[0];
                      const full = parts.slice(1).join(',').trim() || m.display_name;
                      return (
                        <div 
                          key={i}
                          onClick={() => handleSelect(title, full)}
                          className="flex items-start gap-3 py-4 px-4 border-b border-gray-100 dark:border-white/5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition"
                        >
                          <MapPin className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0 mt-0.5" />
                          <div className="overflow-hidden">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h4>
                            <p className="text-xs text-gray-500 mt-1 whitespace-nowrap overflow-hidden text-ellipsis">{full}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div 
                      onClick={() => handleSelect(query, query + ', India')}
                      className="flex items-start gap-3 py-4 px-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition"
                    >
                      <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-primary text-sm">Search "{query}"</h4>
                        <p className="text-xs text-gray-500 mt-1">Tap to use this as custom address</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
