import { lazy, Suspense } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import { useAuth } from './context/AuthContext';

// Lazy load tất cả pages – chỉ tải khi cần, giảm bundle ban đầu đáng kể
const Home          = lazy(() => import('./pages/Home'));
const Foods         = lazy(() => import('./pages/Foods'));
const FoodDetail    = lazy(() => import('./pages/FoodDetail'));
const Login         = lazy(() => import('./pages/Login'));
const Register      = lazy(() => import('./pages/Register'));
const About         = lazy(() => import('./pages/About'));
const Offers        = lazy(() => import('./pages/Offers'));
const Contact       = lazy(() => import('./pages/Contact'));
const Cart          = lazy(() => import('./pages/Cart'));
const Checkout      = lazy(() => import('./pages/Checkout'));
const MomoReturn    = lazy(() => import('./pages/MomoReturn'));
const Profile       = lazy(() => import('./pages/Profile'));
const Favorites     = lazy(() => import('./pages/Favorites'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AIRecommend   = lazy(() => import('./pages/AIRecommend'));
const AIChatHistory = lazy(() => import('./pages/AIChatHistory'));
const NotFound      = lazy(() => import('./pages/NotFound'));
const AIChatbot     = lazy(() => import('./components/AIChatbot'));

// Skeleton loading – hiển thị trong khi lazy chunk đang tải
const PageSkeleton = () => (
  <div className="min-h-screen flex items-center justify-center bg-light">
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <p className="text-sm text-gray-400 font-medium">Đang tải...</p>
    </div>
  </div>
);

// Route guard: chỉ duy nhất tài khoản admin (thanhtinnguyen870@gmail.com) mới được vào
const AdminRoute = ({ children }) => {
  const { user } = useAuth();

  // Đọc dự phòng từ localStorage nếu vừa đăng nhập xong mà React Context chưa kịp hoàn tất commit
  const currentUser = user || (() => {
    try {
      const stored = localStorage.getItem('userInfo');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  if (!currentUser) return <Navigate to="/login" state={{ from: '/admin' }} replace />;
  if (currentUser.role !== 'admin' || currentUser.email !== 'thanhtinnguyen870@gmail.com') return <Navigate to="/" replace />;
  return children;
};

function AppShell() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <>
      <ScrollToTop />
      {!isAdminRoute && <Header />}
      <main className={`min-h-screen ${isAdminRoute ? '' : 'pt-20'}`}>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/"                      element={<Home />} />
            <Route path="/foods"                 element={<Foods />} />
            <Route path="/food/:id"              element={<FoodDetail />} />
            <Route path="/login"                 element={<Login />} />
            <Route path="/register"              element={<Register />} />
            <Route path="/offers"                element={<Offers />} />
            <Route path="/about"                 element={<About />} />
            <Route path="/contact"               element={<Contact />} />
            <Route path="/cart"                  element={<Cart />} />
            <Route path="/checkout"              element={<Checkout />} />
            <Route path="/payment/momo-return"   element={<MomoReturn />} />
            <Route path="/my-orders"             element={<Navigate to="/profile?tab=tracking" replace />} />
            <Route path="/profile"               element={<Profile />} />
            <Route path="/favorites"             element={<Favorites />} />
            <Route path="/admin"                 element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/ai-recommend"          element={<AIRecommend />} />
            <Route path="/ai-history"            element={<AIChatHistory />} />
            <Route path="*"                      element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!isAdminRoute && (
        <Suspense fallback={null}>
          <AIChatbot />
        </Suspense>
      )}
      {!isAdminRoute && <Footer />}
      <ToastContainer
        position="top-right"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss={false}
        draggable={false}
        pauseOnHover
      />
    </>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
