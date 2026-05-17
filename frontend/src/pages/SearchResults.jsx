import { useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Search, RefreshCw } from 'lucide-react';
import ProductCard from '../components/product/ProductCard';
import useSearchStore from '../store/useSearchStore';


const SOURCE_CONFIG = {
  blinkit: {
    label: 'Blinkit',
    color: 'bg-[#0c831f]',
    textColor: 'text-[#0c831f]',
    borderColor: 'border-green-100 dark:border-green-500/10',
    bgLight: 'bg-green-50 dark:bg-green-500/5',
    dot: 'bg-[#0c831f]',
    time: '8 mins',
  }
};

function SkeletonCard() {
  return (
    <div className="w-[160px] md:w-[180px] rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/5 overflow-hidden animate-pulse flex-shrink-0">
      <div className="h-[130px] bg-gray-100 dark:bg-white/5" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-100 dark:bg-white/5 rounded w-2/3" />
        <div className="h-4 bg-gray-100 dark:bg-white/5 rounded" />
        <div className="flex justify-between items-center pt-1">
          <div className="h-5 bg-gray-100 dark:bg-white/5 rounded w-12" />
          <div className="h-8 bg-gray-100 dark:bg-white/5 rounded-lg w-16" />
        </div>
      </div>
    </div>
  );
}

function SourceSection({ source, products, isLoading }) {
  const cfg = SOURCE_CONFIG[source];
  const showSkeletons = isLoading && products.length === 0;

  if (!isLoading && products.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
      <div className={`flex items-center gap-3 mb-4 px-4 py-2.5 rounded-xl ${cfg.bgLight} border ${cfg.borderColor}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
        <span className={`text-sm font-black ${cfg.textColor} tracking-wide`}>{cfg.label}</span>
        <span className="ml-1 text-xs font-bold opacity-60 flex items-center gap-1">
          <Zap className="w-3 h-3" /> {cfg.time} delivery
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {showSkeletons
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </motion.div>
  );
}

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const query = searchParams.get('q') || '';
  const { search, isSearching, isLiveScanning, scanMessage, statusMessage, products, isConnected } = useSearchStore();

  useEffect(() => {
    if (query && isConnected) {
      const isCategory = location.state?.isCategory || false;
      search(query, isCategory);
    }
  }, [query, isConnected, search, location.state?.isCategory]);

  const hasAnyResults = (products.blinkit || []).length > 0;

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center pt-32 gap-4 text-center px-4">
        <div className="w-10 h-10 border-4 border-[#0c831f] border-t-transparent rounded-full animate-spin" />
        <h2 className="text-xl font-black text-gray-800 dark:text-gray-100">Connecting to Warp Pool...</h2>
      </div>
    );
  }



  return (
    <div className="w-full pb-16">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <span className="text-gray-400 dark:text-gray-500 text-sm font-medium">Results for</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">"{query}"</h1>
        <p className="text-gray-400 dark:text-gray-500 text-sm font-medium mt-1">{isSearching ? statusMessage : `${(products.blinkit || []).length} items found`}</p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {isLiveScanning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="px-4 py-3 bg-[#0c831f]/10 dark:bg-[#0c831f]/20 border border-[#0c831f]/20 rounded-xl flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-[#0c831f] animate-spin" />
                <p className="text-sm font-bold text-[#0c831f] tracking-wide">{scanMessage || 'Scanning live inventory...'}</p>
              </div>
            </motion.div>
          )}
          
          <SourceSection
            source="blinkit"
            products={products.blinkit || []}
            isLoading={isSearching}
          />
          {!isSearching && !hasAnyResults && (
            <div className="flex flex-col items-center justify-center pt-16 gap-4 text-center">
              <div className="text-5xl">🔍</div>
              <h2 className="text-xl font-black text-gray-800 dark:text-white">No results found</h2>
              <p className="text-gray-400 dark:text-gray-500 text-sm">Try searching for something else like "milk" or "chips".</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
