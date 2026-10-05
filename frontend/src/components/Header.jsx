import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, ShoppingCart, User, X, Heart, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useFavorite } from '../context/FavoriteContext';

const navLinks = [
  { name: 'Trang chủ', path: '/' },
  { name: 'Thực đơn', path: '/foods' },
  { name: 'Ưu đãi', path: '/offers' },
  { name: 'Giới thiệu', path: '/about' },
  { name: 'Liên hệ', path: '/contact' },
];

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { cartItems } = useCart();
  const { favoriteIds } = useFavorite();
  const location = useLocation();
  const navigate = useNavigate();
  const rafRef = useRef(null);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
  }, [logout, navigate]);

  // Throttle scroll với requestAnimationFrame – tránh reflow liên tục
  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 20);
        rafRef.current = null;
      });
    };
    // passive: true – cho phép browser scroll tự do mà không chờ JS
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Đóng mobile menu khi chuyển trang
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setIsMobileMenuOpen(false);
  }

  const cartCount = cartItems.length;
  const favCount = favoriteIds.size;
  const isAdmin = user?.role === 'admin' && user?.email === 'thanhtinnguyen870@gmail.com';

  return (
    <header
      className={`fixed top-0 z-50 w-full border-b border-[#E8EEE9] transition-[background-color,box-shadow,padding] duration-300 ${
        isScrolled
          ? 'bg-white/95 shadow-sm backdrop-blur-md py-3'
          : 'bg-[#F7F9F6]/95 backdrop-blur-sm py-4'
      }`}
      style={{ willChange: 'transform' }}
    >
      <div className="container mx-auto flex items-center justify-between px-6 md:px-12">
        <Link to="/" className="-mt-2 flex items-center gap-4 md:-mt-4">
          <img
            src="/logo.png"
            alt="FoodCare"
            className="h-14 w-auto object-contain transition-transform hover:scale-110 md:h-20"
            width="80"
            height="80"
            fetchPriority="high"
          />
          <span className="text-3xl font-black tracking-tight text-[#17231D] md:text-4xl">FoodCare</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:gap-9 md:flex" aria-label="Main navigation">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.name}
                to={link.path}
                className={`relative px-1 py-1.5 text-[16px] lg:text-[17px] font-bold tracking-tight transition-all duration-200 hover:text-primary ${
                  isActive
                    ? 'text-primary font-extrabold'
                    : 'text-[#17231D] hover:-translate-y-0.5'
                }`}
              >
                {link.name}
                {isActive && (
                  <span className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full bg-primary shadow-sm shadow-primary/40" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-6 md:flex">
          {user && !isAdmin && (
            <>
              <Link to="/favorites" className="relative text-gray-700 transition-colors hover:text-red-500" title="Yêu thích">
                <Heart
                  size={24}
                  fill={favCount > 0 ? 'currentColor' : 'none'}
                  className={favCount > 0 ? 'text-red-500' : ''}
                />
                {favCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                    {favCount}
                  </span>
                )}
              </Link>
              <Link to="/cart" className="relative text-gray-700 transition-colors hover:text-primary">
                <ShoppingCart size={24} />
                {cartCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                    {cartCount}
                  </span>
                )}
              </Link>
            </>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/ai-history"
                title="Lịch sử trò chuyện AI"
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-primary transition-colors"
              >
                <Sparkles size={18} className="text-primary" />
                <span className="hidden lg:inline">Lịch sử AI</span>
              </Link>
              <Link
                to={isAdmin ? '/admin' : '/profile'}
                className="flex items-center gap-2 font-semibold text-gray-700 transition-colors hover:text-primary"
              >
                <img
                  src={user.avatar}
                  alt="avatar"
                  className="h-8 w-8 rounded-full border border-primary object-cover"
                  width="32"
                  height="32"
                  loading="lazy"
                />
                <span>{user.name}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
              >
                <LogOut size={16} /> Đăng xuất
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 rounded-full bg-dark px-5 py-2 font-semibold text-white transition-colors hover:bg-gray-800"
            >
              <User size={18} /> Đăng nhập
            </Link>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="text-dark md:hidden"
          onClick={() => setIsMobileMenuOpen((v) => !v)}
          aria-label={isMobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile menu – animation slide down */}
      <div
        className={`absolute left-0 top-full w-full flex-col gap-2 bg-white p-5 shadow-lg md:hidden overflow-hidden transition-all duration-200 ${
          isMobileMenuOpen ? 'flex max-h-screen opacity-100' : 'hidden max-h-0 opacity-0'
        }`}
      >
        {navLinks.map((link) => (
          <Link
            key={link.name}
            to={link.path}
            className={`text-lg font-semibold hover:text-primary py-1 ${
              location.pathname === link.path ? 'text-primary' : 'text-gray-800'
            }`}
          >
            {link.name}
          </Link>
        ))}
        <div className="mt-3 border-t border-gray-100 pt-3 flex flex-col gap-3">
          {user && !isAdmin && (
            <>
              <Link to="/favorites" className="flex items-center gap-3 font-semibold text-gray-700 hover:text-red-500">
                <Heart size={20} fill={favCount > 0 ? 'currentColor' : 'none'} className={favCount > 0 ? 'text-red-500' : ''} />
                <span>Yêu thích</span>
                {favCount > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">{favCount}</span>
                )}
              </Link>
              <Link to="/cart" className="flex items-center gap-3 font-semibold text-gray-700 hover:text-primary">
                <ShoppingCart size={20} />
                <span>Giỏ hàng</span>
                {cartCount > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">{cartCount}</span>
                )}
              </Link>
            </>
          )}
          {user ? (
            <>
              <Link to="/ai-history" className="flex items-center gap-3 font-semibold text-gray-700 hover:text-primary">
                <Sparkles size={20} className="text-primary" />
                <span>Lịch sử AI</span>
              </Link>
              <Link to={isAdmin ? '/admin' : '/profile'} className="flex items-center gap-3 font-semibold text-gray-700 hover:text-primary">
                <img src={user.avatar} alt="avatar" className="h-7 w-7 rounded-full border border-primary object-cover" width="28" height="28" loading="lazy" />
                <span>{user.name}</span>
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-3 font-semibold text-red-600 hover:text-red-700">
                <LogOut size={20} />
                <span>Đăng xuất</span>
              </button>
            </>
          ) : (
            <Link to="/login" className="flex items-center gap-3 font-semibold text-gray-700 hover:text-primary">
              <User size={20} />
              <span>Đăng nhập</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default memo(Header);
