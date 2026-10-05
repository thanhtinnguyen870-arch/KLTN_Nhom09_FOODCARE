import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Bot,
  Sparkles,
  Trash2,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  ShoppingCart,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

/* ─── helpers ─── */
const formatDateTime = (val) =>
  val
    ? new Date(val).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

const renderResponse = (text = '') => {
  const labelPattern =
    /(Món chính|Món phụ|Đồ uống|Tráng miệng|Bữa sáng|Bữa trưa|Bữa tối|Gợi ý|Lưu ý|Khuyến nghị|Thực đơn|Calories|Protein|Tinh bột|Chất xơ|Giá|Lý do|Khẩu phần gốc|Khẩu phần đề xuất|Thành phần)\s*:/gi;

  return text.split('\n').map((line, li) => (
    <p key={li} className="mb-1 last:mb-0 leading-relaxed">
      {line.split(labelPattern).map((part, idx) =>
        idx % 2 === 1 ? (
          <strong key={idx} className="font-bold text-primary-dark">
            {part}:
          </strong>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </p>
  ));
};

/* ─── Main Page ─── */
const AIChatHistory = () => {
  const { user } = useAuth();
  const { addToCart } = useCart();

  const isAdmin = user?.role === 'admin';
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [deletingId, setDeletingId] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [viewScope, setViewScope] = useState('mine'); // 'mine' | 'all' (Admin only)
  const searchRef = useRef(null);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const url = isAdmin && viewScope === 'all' ? '/ai/history?all=true' : '/ai/history';
      const { data } = await axiosClient.get(url);
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Không thể tải lịch sử trò chuyện.');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, viewScope]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filtered = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.trim().toLowerCase();
    return history.filter(
      (c) =>
        c.message?.toLowerCase().includes(q) ||
        c.response?.toLowerCase().includes(q) ||
        c.user?.name?.toLowerCase().includes(q) ||
        c.user?.email?.toLowerCase().includes(q) ||
        c.recommendedFoods?.some((f) => f.name?.toLowerCase().includes(q))
    );
  }, [history, search]);

  const toggleExpand = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa cuộc trò chuyện này?')) return;
    setDeletingId(id);
    try {
      await axiosClient.delete(`/ai/history/${id}`);
      setHistory((prev) => prev.filter((c) => c._id !== id));
      toast.success('Đã xóa cuộc trò chuyện.');
    } catch {
      toast.error('Không thể xóa. Thử lại sau.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    const confirmMsg =
      isAdmin && viewScope === 'all'
        ? `[ADMIN] Xóa toàn bộ ${history.length} cuộc trò chuyện của TẤT CẢ người dùng? Hành động này không thể hoàn tác.`
        : `Xóa toàn bộ ${history.length} cuộc trò chuyện của bạn? Hành động này không thể hoàn tác.`;
    if (!window.confirm(confirmMsg)) return;

    setClearingAll(true);
    try {
      const url = isAdmin && viewScope === 'all' ? '/ai/history?all=true' : '/ai/history';
      const { data } = await axiosClient.delete(url);
      setHistory([]);
      toast.success(data.message || 'Đã xóa toàn bộ lịch sử trò chuyện.');
    } catch {
      toast.error('Không thể xóa. Thử lại sau.');
    } finally {
      setClearingAll(false);
    }
  };

  if (!user) return <Navigate to="/login" state={{ from: '/ai-history' }} replace />;

  return (
    <div className="container mx-auto max-w-4xl px-4 md:px-8 py-10 min-h-[80vh]">
      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg">
              <Sparkles size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-dark">Lịch sử trò chuyện AI</h1>
              <p className="text-sm text-gray-500">
                {history.length} cuộc trò chuyện •{' '}
                {isAdmin && viewScope === 'all'
                  ? 'Quyền Quản trị viên (Admin): Đang xem toàn bộ câu hỏi trên hệ thống'
                  : 'Dữ liệu cá nhân, chỉ bạn nhìn thấy'}
              </p>
            </div>
          </div>

          {/* Admin Scope Switcher */}
          {isAdmin && (
            <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewScope('mine')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewScope === 'mine'
                    ? 'bg-white text-primary shadow-xs font-extrabold'
                    : 'text-gray-500 hover:text-dark'
                }`}
              >
                Của tôi
              </button>
              <button
                type="button"
                onClick={() => setViewScope('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewScope === 'all'
                    ? 'bg-primary text-white shadow-xs font-extrabold'
                    : 'text-gray-500 hover:text-dark'
                }`}
              >
                Tất cả người dùng (Admin)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo nội dung, câu hỏi, tên món..."
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-9 text-sm outline-none focus:border-primary"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {/* Quick link to AI page */}
        <Link
          to="/ai-recommend"
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-white text-sm font-bold shadow hover:bg-primary-dark transition-all hover:-translate-y-0.5"
        >
          <Bot size={16} /> Chat mới
        </Link>
        {/* Clear all */}
        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearingAll}
            className="flex items-center gap-2 h-11 px-4 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-60"
          >
            <Trash2 size={15} />
            {clearingAll ? 'Đang xóa...' : 'Xóa tất cả'}
          </button>
        )}
      </div>

      {/* ── Search result hint ── */}
      {search && (
        <p className="text-sm text-gray-500 mb-4">
          Tìm thấy <span className="font-bold text-dark">{filtered.length}</span> kết quả cho
          &quot;<span className="text-primary">{search}</span>&quot;
        </p>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm">Đang tải lịch sử...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-gray-400">
          <Bot size={56} className="text-primary/40 mb-4" />
          {search ? (
            <>
              <p className="font-semibold text-dark">Không tìm thấy kết quả</p>
              <p className="text-sm mt-1">Thử từ khóa khác hoặc xóa bộ lọc.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-dark">Chưa có lịch sử trò chuyện</p>
              <p className="text-sm mt-1 max-w-xs">
                Bắt đầu hỏi AI để nhận gợi ý món ăn phù hợp với sức khỏe của bạn!
              </p>
              <Link
                to="/ai-recommend"
                className="mt-5 inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-dark transition-colors"
              >
                <Sparkles size={16} /> Bắt đầu trò chuyện
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((chat, idx) => {
            const isExpanded = !!expanded[chat._id];
            const isDeleting = deletingId === chat._id;

            return (
              <div
                key={chat._id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md"
              >
                {/* ── Card Header ── */}
                <div className="flex items-start gap-3 p-5">
                  {/* Index badge */}
                  <div className="w-8 h-8 rounded-full bg-primary-light/40 border border-primary-light flex-shrink-0 flex items-center justify-center text-xs font-bold text-primary">
                    {history.length - idx}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* User question */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <MessageCircle size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
                        <p className="text-sm font-semibold text-dark leading-snug line-clamp-2">
                          {chat.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <button
                          onClick={() => handleDelete(chat._id)}
                          disabled={isDeleting}
                          title="Xóa cuộc trò chuyện này"
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          onClick={() => toggleExpand(chat._id)}
                          title={isExpanded ? 'Thu gọn' : 'Xem phản hồi'}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary-light/30 transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Metadata row */}
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={11} />
                        {formatDateTime(chat.createdAt)}
                      </span>
                      {isAdmin && chat.user && (
                        <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full border border-slate-200">
                          👤 {chat.user.name || 'Người dùng'} {chat.user.email ? `(${chat.user.email})` : ''}
                        </span>
                      )}
                      {chat.recommendedFoods?.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs bg-primary-light/40 text-primary font-semibold px-2 py-0.5 rounded-full border border-primary-light">
                          <ShoppingCart size={10} />
                          {chat.recommendedFoods.length} món được gợi ý
                        </span>
                      )}
                    </div>

                    {/* Preview (collapsed) */}
                    {!isExpanded && chat.response && (
                      <p className="mt-2 text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {chat.response.replace(/RECOMMENDATIONS:.*/i, '').trim()}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Expanded Content ── */}
                {isExpanded && (
                  <div className="border-t border-gray-50 bg-gray-50/50">
                    {/* AI response bubble */}
                    <div className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark flex-shrink-0 flex items-center justify-center shadow">
                          <Sparkles size={13} className="text-white" />
                        </div>
                        <div className="flex-1 bg-white border border-primary-light rounded-2xl rounded-tl-sm p-4 text-sm text-gray-800 shadow-sm">
                          {renderResponse(chat.response)}

                          {/* Disclaimer */}
                          <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
                            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                            Thông tin chỉ mang tính tham khảo. Hãy hỏi bác sĩ hoặc chuyên gia dinh dưỡng nếu cần.
                          </div>
                        </div>
                      </div>

                      {/* Recommended Food Cards */}
                      {chat.recommendedFoods?.length > 0 && (
                        <div className="mt-5">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                            Món ăn được đề xuất
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {chat.recommendedFoods.map((food) => (
                              <div
                                key={food._id}
                                className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow"
                              >
                                <div className="flex gap-3 p-3">
                                  <img
                                    src={food.images?.[0]}
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src =
                                        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop';
                                    }}
                                    alt={food.name}
                                    className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className="font-bold text-sm line-clamp-2 leading-tight">{food.name}</p>
                                    <p className="text-primary text-sm font-bold mt-1">
                                      {food.price?.toLocaleString()}đ
                                    </p>
                                    {food.nutrition?.calories && (
                                      <p className="text-xs text-gray-400">{food.nutrition.calories} kcal</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex border-t border-gray-50 text-xs font-semibold">
                                  <Link
                                    to={`/food/${food._id}`}
                                    className="flex-1 py-2 text-center text-gray-600 hover:bg-gray-50 transition-colors"
                                  >
                                    Chi tiết
                                  </Link>
                                  <div className="w-px bg-gray-50" />
                                  <button
                                    onClick={() => addToCart(food)}
                                    className="flex-1 py-2 text-center text-primary hover:bg-primary-light/30 transition-colors flex items-center justify-center gap-1"
                                  >
                                    <ShoppingCart size={11} /> Thêm vào giỏ
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AIChatHistory;
