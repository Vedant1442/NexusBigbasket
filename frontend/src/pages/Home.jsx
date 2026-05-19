import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, ArrowRight, Loader2 } from 'lucide-react';
import ProductCard from '../components/product/ProductCard';
import { useHomeContent } from '../hooks/useHomeContent';

export default function Home() {
  const navigate = useNavigate();
  const { categories, featuredProducts } = useHomeContent();

  const handleCategoryClick = (cat) => {
    navigate(`/search?q=${encodeURIComponent(cat.query || cat.name)}`, { state: { isCategory: true } });
  };

  return (
    <div className="w-full">
      <div className="mb-8 pt-4">
        <div className="relative w-full rounded-3xl overflow-hidden bg-gradient-to-r from-[#84c225] to-[#6da31d] h-[160px] md:h-[220px] flex items-center px-8 shadow-xl">
          <div className="text-white z-10">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="w-5 h-5 text-yellow-300 fill-yellow-300" />
              <span className="text-xs font-black text-white/90 uppercase tracking-[0.2em]">Hyperlocal Delivery</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tighter">
              BigBasket in <span className="text-yellow-300">60 mins</span>
            </h1>
            <p className="text-white/80 text-sm md:text-base mt-2 font-bold max-w-md">
              Freshness delivered from your nearest hub. No more stale data.
            </p>
          </div>
          <div className="absolute right-0 top-0 w-64 h-64 rounded-full bg-white/10 -mr-20 -mt-20 blur-3xl" />
          <div className="absolute right-20 bottom-0 w-40 h-40 rounded-full bg-yellow-400/10 mb-0 blur-2xl" />
        </div>
      </div>

      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Shop by Category</h2>
        </div>
        
        {categories.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {categories.slice(0, 16).map((cat, i) => (
              <motion.button
                key={i}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleCategoryClick(cat)}
                className="flex flex-col items-center gap-3 p-3 rounded-2xl border border-gray-100 dark:border-white/5 bg-white dark:bg-[#1a1a1a] shadow-sm hover:shadow-md hover:border-primary transition-all group"
              >
                <div className="w-full aspect-square rounded-2xl bg-gray-50 dark:bg-white/5 flex items-center justify-center overflow-hidden">
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-500" />
                </div>
                <span className="text-[10px] font-black text-gray-800 dark:text-gray-200 text-center leading-tight uppercase tracking-wide line-clamp-2">{cat.name}</span>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500 font-bold gap-3 bg-gray-50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-200 dark:border-white/10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            Loading Fresh Categories...
          </div>
        )}
      </div>

      {featuredProducts.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Featured for You</h2>
            <button
              onClick={() => navigate('/search?q=popular')}
              className="text-primary font-black text-sm flex items-center gap-1 hover:underline"
            >
              See all <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
            {featuredProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
