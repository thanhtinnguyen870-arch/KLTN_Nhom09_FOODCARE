import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { Search, ShoppingCart, X, Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useFavorite } from '../context/FavoriteContext';

const Foods = () => {
  const { user } = useAuth();
  const { addFavorite, isFavorited } = useFavorite();
  const { addToCart } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();

  const categorySlugParam = searchParams.get('category') || '';
  const keywordParam = searchParams.get('keyword') || '';

  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState(keywordParam);
  const [prevKeyword, setPrevKeyword] = useState(keywordParam);
  const [loading, setLoading] = useState(true);
  const [isSwitchingCategory, setIsSwitchingCategory] = useState(false);

  // Đồng bộ giá trị input khi keyword trên URL thay đổi (theo chuẩn React)
  if (keywordParam !== prevKeyword) {
    setPrevKeyword(keywordParam);
    setSearchTerm(keywordParam);
  }

  // Đường dẫn quay lại khi bấm từ chi tiết món
  const returnToFoodsQuery = searchParams.toString();
  const returnToFoods = returnToFoodsQuery ? `/foods?${returnToFoodsQuery}` : '/foods';

  // 1. Tải danh mục một lần khi mount
  useEffect(() => {
    let isMounted = true;
    axiosClient.get('/categories')
      .then(({ data }) => {
        if (isMounted) setCategories(data);
      })
      .catch((err) => console.error('Lỗi khi tải danh mục:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Debounce cập nhật từ khóa lên URL khi người dùng gõ tìm kiếm
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const trimmed = searchTerm.trim();
      if (trimmed !== keywordParam) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (trimmed) {
            next.set('keyword', trimmed);
          } else {
            next.delete('keyword');
          }
          return next;
        }, { replace: true });
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, keywordParam, setSearchParams]);

  // 4. Tải danh sách món ăn khi danh mục hoặc từ khóa thay đổi (Cập nhật phản hồi tức thì, không cần load lại trang)
  useEffect(() => {
    let cancelled = false;

    const fetchFoods = async () => {
      setLoading(foods.length === 0);
      setIsSwitchingCategory(foods.length > 0);

      try {
        const params = new URLSearchParams();
        if (categorySlugParam) params.set('category', categorySlugParam);
        if (keywordParam) params.set('keyword', keywordParam);

        const query = params.toString();
        const { data } = await axiosClient.get(query ? `/foods?${query}` : '/foods');

        if (!cancelled) {
          setFoods(data);
        }
      } catch (error) {
        if (!cancelled) console.error('Lỗi khi tải món ăn:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setIsSwitchingCategory(false);
        }
      }
    };

    fetchFoods();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlugParam, keywordParam]);

  // Xử lý khi bấm nút chọn danh mục
  const handleCategorySelect = (slug) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (slug) {
        next.set('category', slug);
      } else {
        next.delete('category');
      }
      return next;
    });
  };

  // Kiểm tra xem danh mục có đang được chọn hay không (hỗ trợ cả slug, id, name hoặc slug có dấu cách)
  const isCategorySelected = (cat) => {
    if (!categorySlugParam) return false;
    const cleanParam = categorySlugParam.toLowerCase().trim();
    return (
      cat.slug === cleanParam ||
      cat._id === cleanParam ||
      cat.name.toLowerCase() === cleanParam ||
      cat.slug === cleanParam.replace(/\s+/g, '-')
    );
  };

  return (
    <div className="container mx-auto px-4 md:px-12 py-10">
      <h1 className="text-4xl font-bold mb-8 text-center">
        Khám Phá <span className="text-primary">Thực Đơn</span>
      </h1>

      {/* Thanh tìm kiếm */}
      <div className="mx-auto mb-8 max-w-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm món ăn dinh dưỡng..."
            className="h-13 w-full rounded-full border border-[#E8EEE9] bg-white pl-12 pr-12 text-base font-medium text-dark shadow-sm outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete('keyword');
                  return next;
                });
              }}
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-primary-light hover:text-primary"
              aria-label="Xóa tìm kiếm"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Bộ lọc danh mục */}
      <div className="flex flex-wrap justify-center gap-3 mb-12">
        <button
          type="button"
          onClick={() => handleCategorySelect('')}
          className={`px-5 py-2.5 rounded-full font-bold text-sm shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95 ${
            !categorySlugParam
              ? 'bg-primary text-white shadow-float scale-105'
              : 'bg-white text-gray-700 border border-[#E8EEE9] hover:bg-[#F0F8F3] hover:text-primary hover:border-primary/30'
          }`}
        >
          Tất cả
        </button>
        {categories.map((cat) => {
          const active = isCategorySelected(cat);
          return (
            <button
              key={cat._id}
              type="button"
              onClick={() => handleCategorySelect(cat.slug)}
              className={`px-5 py-2.5 rounded-full font-bold text-sm shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95 ${
                active
                  ? 'bg-primary text-white shadow-float scale-105'
                  : 'bg-white text-gray-700 border border-[#E8EEE9] hover:bg-[#F0F8F3] hover:text-primary hover:border-primary/30'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Danh sách món ăn */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="relative min-h-[520px]">
          {isSwitchingCategory && (
            <div className="absolute right-0 top-0 z-10 rounded-full border border-[#E8EEE9] bg-white/95 px-4 py-2 text-sm font-semibold text-primary shadow-sm backdrop-blur">
              Đang cập nhật...
            </div>
          )}

          <div
            key={categorySlugParam || 'all'}
            className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 transition-all duration-300 ease-out ${
              isSwitchingCategory ? 'opacity-55 scale-[0.99]' : 'opacity-100 scale-100 animate-menu-fade'
            }`}
          >
            {foods.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-dashed border-gray-200 p-8 shadow-sm">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary-light flex items-center justify-center text-4xl shadow-inner">
                  🥗
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Không tìm thấy món ăn nào</h3>
                <p className="text-gray-500 max-w-md mx-auto mb-6 text-sm">
                  {keywordParam
                    ? `Không có món ăn nào phù hợp với từ khóa "${keywordParam}" trong danh mục này.`
                    : 'Hiện tại chưa có món ăn nào trong danh mục đã chọn.'}
                </p>
                <div className="flex justify-center gap-3">
                  {keywordParam && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setSearchParams((prev) => {
                          const next = new URLSearchParams(prev);
                          next.delete('keyword');
                          return next;
                        });
                      }}
                      className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-full font-bold text-sm hover:bg-gray-200 transition-all"
                    >
                      Xóa từ khóa tìm kiếm
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setSearchParams({});
                    }}
                    className="bg-primary text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-primary-dark transition-all shadow-md"
                  >
                    Xem tất cả món ăn
                  </button>
                </div>
              </div>
            ) : (
              foods.map((food, index) => (
                <div
                  key={food._id}
                  className="bg-white rounded-3xl overflow-hidden shadow-lg card-3d border border-gray-50 flex flex-col animate-menu-card"
                  style={{ animationDelay: `${Math.min(index * 35, 210)}ms` }}
                >
                  <Link to={`/food/${food._id}`} state={{ from: returnToFoods }} className="block relative h-56 overflow-hidden">
                    <img
                      src={food.images[0]}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop';
                      }}
                      alt={food.name}
                      loading="lazy"
                      decoding="async"
                      className={`w-full h-full object-cover transition-transform duration-700 hover:scale-110 ${
                        !food.isAvailable ? 'opacity-40 grayscale' : ''
                      }`}
                    />
                    {/* Overlay Tạm hết */}
                    {!food.isAvailable && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 backdrop-blur-[1px]">
                        <span className="bg-gray-900/80 text-white text-sm font-bold px-4 py-1.5 rounded-full tracking-wide shadow-lg border border-white/20">
                          🚫 Tạm hết
                        </span>
                      </div>
                    )}
                    {food.isAvailable && food.healthTags && food.healthTags.length > 0 && (
                      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-healthy shadow-sm">
                        {food.healthTags[0]}
                      </div>
                    )}
                  </Link>

                  <div className={`p-5 flex flex-col flex-1 ${!food.isAvailable ? 'opacity-60' : ''}`}>
                    <Link to={`/food/${food._id}`} state={{ from: returnToFoods }}>
                      <h3 className="font-bold text-xl mb-1 hover:text-primary transition-colors line-clamp-1">{food.name}</h3>
                    </Link>
                    <p className="text-gray-500 text-sm mb-2 line-clamp-2 flex-1">{food.description}</p>

                    {/* Điểm đánh giá */}
                    {food.ratingAverage > 0 && (
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              className={`w-3.5 h-3.5 ${star <= Math.round(food.ratingAverage) ? 'text-amber-400' : 'text-gray-200'}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                          {food.ratingAverage.toFixed(1)} ({food.ratingCount || 0})
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-auto">
                      <span className={`font-extrabold text-lg ${food.isAvailable ? 'text-primary' : 'text-gray-400 line-through'}`}>
                        {food.price.toLocaleString()}đ
                      </span>
                      <div className="flex items-center gap-2">
                        {user && user.role !== 'admin' && food.isAvailable && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              addFavorite(food);
                            }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border ${
                              isFavorited(food._id)
                                ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100'
                                : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-400 hover:border-red-200'
                            }`}
                            title={isFavorited(food._id) ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}
                          >
                            <Heart size={17} fill={isFavorited(food._id) ? 'currentColor' : 'none'} />
                          </button>
                        )}
                        {user?.role !== 'admin' && food.isAvailable && (
                          <button
                            onClick={() => addToCart(food)}
                            className="w-10 h-10 bg-dark text-white rounded-full flex items-center justify-center hover:bg-primary transition-colors"
                          >
                            <ShoppingCart size={18} />
                          </button>
                        )}
                        {!food.isAvailable && (
                          <span className="text-xs font-semibold text-gray-400 italic">Không khả dụng</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Foods;
