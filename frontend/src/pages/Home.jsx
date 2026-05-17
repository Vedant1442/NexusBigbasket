import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, Loader2 } from 'lucide-react';
import ProductCard from '../components/product/ProductCard';
import { useHomeContent } from '../hooks/useHomeContent';

// ── Category definitions ──────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'Dairy & Eggs',      emoji: '🥛', query: 'milk',   color: 'bg-blue-50',    border: 'border-blue-100' },
  { name: 'Fruits & Veg',      emoji: '🥦', query: 'fruits', color: 'bg-green-50', border: 'border-green-100' },
  { name: 'Snacks',            emoji: '🍟', query: 'chips', color: 'bg-yellow-50', border: 'border-yellow-100' },
  { name: 'Cold Drinks',       emoji: '🥤', query: 'soft drink', color: 'bg-cyan-50',  border: 'border-cyan-100' },
  { name: 'Bakery',            emoji: '🍞', query: 'bread',   color: 'bg-orange-50',  border: 'border-orange-100' },
  { name: 'Atta, Rice & Dal',  emoji: '🌾', query: 'rice', color: 'bg-amber-50',  border: 'border-amber-100' },
  { name: 'Meat & Fish',       emoji: '🍗', query: 'maggie', color: 'bg-red-50',     border: 'border-red-100' },
  { name: 'Personal Care',     emoji: '🧴', query: 'soap', color: 'bg-pink-50', border: 'border-pink-100' },
  { name: 'Cleaning',          emoji: '🧹', query: 'soap', color: 'bg-indigo-50', border: 'border-indigo-100' },
  { name: 'Ice Cream',         emoji: '🍦', query: 'ice cream', color: 'bg-purple-50', border: 'border-purple-100' },
  { name: 'Noodles & Pasta',   emoji: '🍜', query: 'maggie', color: 'bg-rose-50',   border: 'border-rose-100' },
  { name: 'Tea & Coffee',      emoji: '☕', query: 'biscuits',          color: 'bg-stone-50',   border: 'border-stone-100' },
];

// ── Curated catalog products (images from blinkit_v2.db / Cloudinary) ─────────
const CATALOG = {
  dairy: [
    { id: 2581, name: 'Amul Gold Full Cream Milk',  price: 72,  mrp: 72,  discount: 0,  quantity: '1 ltr', image: 'https://res.cloudinary.com/dxxcxqdsj/image/upload/v1778982585/blinkit_store/bndu7ysrlyh61c355dkn.webp', source: 'blinkit', productUrl: '#', deliveryTime: '8 mins' },
    { id: 2582, name: 'Amul Taaza Toned Milk',       price: 30,  mrp: 30,  discount: 0,  quantity: '500 ml', image: 'https://res.cloudinary.com/dxxcxqdsj/image/upload/v1778982587/blinkit_store/u0aeqjljs5qqlhyn3lrh.webp', source: 'blinkit', productUrl: '#', deliveryTime: '8 mins' },
    { id: 2583, name: 'Mother Dairy Toned Milk',     price: 29,  mrp: 29,  discount: 0,  quantity: '500 ml', image: 'https://res.cloudinary.com/dxxcxqdsj/image/upload/v1778982589/blinkit_store/ejyylsxwlwqxamiulfmw.webp', source: 'blinkit', productUrl: '#', deliveryTime: '8 mins' },
    { id: 2918, name: 'Britannia Good Day Cashew Biscuit', price: 40, mrp: 40, discount: 0, quantity: '200 g', image: 'https://res.cloudinary.com/dxxcxqdsj/image/upload/v1778983140/blinkit_store/r0e5q2iwuj82s2drz7k0.webp', source: 'blinkit', productUrl: '#', deliveryTime: '8 mins' },
  ],
  snacks: [
    { id: 2724, name: 'Too Yumm Grilled Cheese & Chilli Chips', price: 49, mrp: 49, discount: 0, quantity: '60 g', image: 'https://res.cloudinary.com/dxxcxqdsj/image/upload/v1778982778/blinkit_store/kdwmrljcjoytkrcnap77.webp', source: 'blinkit', productUrl: '#', deliveryTime: '8 mins' },
    { id: 2725, name: 'Uncle Chipps Spicy Treat',   price: 20, mrp: 20, discount: 0, quantity: '53 g', image: 'https://res.cloudinary.com/dxxcxqdsj/image/upload/v1778982779/blinkit_store/t40wnjcgxixcl0kip6pg.webp', source: 'blinkit', productUrl: '#', deliveryTime: '8 mins' },
    { id: 2726, name: "Lay's India's Magic Masala", price: 25, mrp: 25, discount: 0, quantity: '58 g', image: 'https://res.cloudinary.com/dxxcxqdsj/image/upload/v1778982781/blinkit_store/jsl5cy6uxkgnwt0i8tmc.webp', source: 'blinkit', productUrl: '#', deliveryTime: '8 mins' },
    { id: 2790, name: 'Doritos Cheese Nachos',       price: 50, mrp: 50, discount: 0, quantity: '60 g', image: 'https://res.cloudinary.com/dxxcxqdsj/image/upload/v1778982917/blinkit_store/ooqvrled2krtrca29bc9.webp', source: 'blinkit', productUrl: '#', deliveryTime: '8 mins' },
  ],
  fruits: [
    { id: 3587, name: 'Banana',                     price: 38, mrp: 42, discount: 10, quantity: '3 pcs', image: 'https://res.cloudinary.com/dxxcxqdsj/image/upload/v1778984324/blinkit_store/drele8y7t6z9pcbrafp8.webp', source: 'blinkit', productUrl: '#', deliveryTime: '8 mins' },
    { id: 3588, name: 'Madhu Muskmelon (Kharabooja)',price: 58, mrp: 65, discount: 11, quantity: '400 g', image: 'https://res.cloudinary.com/dxxcxqdsj/image/upload/v1778984326/blinkit_store/ksyxvdw9xuwl68esl8nd.webp', source: 'blinkit', productUrl: '#', deliveryTime: '8 mins' },
    { id: 3589, name: 'Peeled Pomegranate Snack',   price: 76, mrp: 85, discount: 11, quantity: '80 g',  image: 'https://res.cloudinary.com/dxxcxqdsj/image/upload/v1778984328/blinkit_store/upoavnzbzmcz6panpfgu.webp', source: 'blinkit', productUrl: '#', deliveryTime: '8 mins' },
    { id: 3586, name: 'Yu Lychee Juice with Chia',  price: 150, mrp: 150, discount: 0, quantity: '3×225ml', image: 'https://res.cloudinary.com/dxxcxqdsj/image/upload/v1778984321/blinkit_store/fnwmtxeiaevbzx905kfv.webp', source: 'blinkit', productUrl: '#', deliveryTime: '8 mins' },
  ],
};

function ProductRail({ title, products, query }) {
  const navigate = useNavigate();
  return (
    <div className="mb-12 px-1">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight">{title}</h2>
        <button
          onClick={() => navigate(`/search?q=${encodeURIComponent(query)}`)}
          className="text-primary font-bold text-sm flex items-center gap-1 hover:underline"
        >
          See all <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { categories, featuredProducts } = useHomeContent();

  const handleCategoryClick = (cat) => {
    navigate(`/search?q=${encodeURIComponent(cat.query || cat.name)}`);
  };

  return (
    <div className="w-full">
      <div className="mb-8 pt-4">
        <div className="relative w-full rounded-3xl overflow-hidden bg-gradient-to-r from-[#0c831f] to-[#14b82c] h-[160px] md:h-[220px] flex items-center px-8 shadow-xl">
          <div className="text-white z-10">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300 animate-pulse" />
              <span className="text-xs font-black text-white/90 uppercase tracking-[0.2em]">Live Warp Speed</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tighter">
              Blinkit in <span className="text-yellow-300">8 mins</span>
            </h1>
            <p className="text-white/80 text-sm md:text-base mt-2 font-bold max-w-md">
              Real-time prices from the Warp Pool. No more stale data.
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
                className="flex flex-col items-center gap-3 p-3 rounded-2xl border border-gray-100 dark:border-white/5 bg-white dark:bg-[#1a1a1a] shadow-sm hover:shadow-md hover:border-nexus-green transition-all group"
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
            Warping Categories...
          </div>
        )}
      </div>

      {featuredProducts.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Warp Featured</h2>
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

      {/* Fallback Rails */}
      <ProductRail title="🥛 Dairy, Bread & Eggs" products={CATALOG.dairy} query="dairy" />
      <ProductRail title="🍟 Snacks & Munchies" products={CATALOG.snacks} query="snacks" />
      <ProductRail title="🥦 Fruits & Vegetables" products={CATALOG.fruits} query="fruits" />
    </div>
  );
}
