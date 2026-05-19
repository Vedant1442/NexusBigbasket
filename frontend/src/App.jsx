import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import CartDrawer from './components/layout/CartDrawer';
import LocationModal from './components/layout/LocationModal';
import AuthModal from './components/layout/AuthModal';
import Home from './pages/Home';
import SearchResults from './pages/SearchResults';
import GroupCart from './pages/GroupCart';
import Profile from './pages/Profile';
import useSearchStore from './store/useSearchStore';

function App() {
  const { connect } = useSearchStore();

  useEffect(() => {
    connect();
  }, [connect]);

  return (
    <Router>
      <div className="min-h-screen pb-20 md:pb-0 font-sans">
        <Navbar />
        <main className="max-w-7xl mx-auto md:px-4 lg:px-8 mt-20">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/group-cart" element={<GroupCart />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>
        <CartDrawer />
        <LocationModal />
        <AuthModal />
      </div>
    </Router>
  );
}

export default App;
