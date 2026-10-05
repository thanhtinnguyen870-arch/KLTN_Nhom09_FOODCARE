import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Bot, ShoppingCart, Maximize2, Minimize2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

/* ─── Hằng số tĩnh ngoài component để tránh tái cấp phát bộ nhớ ─── */
const QUICK_CHIPS = [
  'Tôi bị tiểu đường',
  'Tôi đang giảm cân',
  'Tôi tập gym',
  'Tôi muốn ăn chay',
  'Cao huyết áp',
  'Gợi ý bữa tối nhẹ',
];

const FALLBACK_FOOD_IMAGE =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop';

const LABEL_PATTERN =
  /(Món chính|Món phụ|Đồ uống|Tráng miệng|Bữa sáng|Bữa trưa|Bữa tối|Gợi ý|Lưu ý|Khuyến nghị|Thực đơn|Calories|Protein|Tinh bột|Chất béo|Chất xơ|Giá|Lý do)\s*:/gi;

/* ─── Bộ phân tích nội dung phản hồi của AI hỗ trợ Markdown nhẹ ─── */
const FormattedResponse = memo(({ text = '' }) => {
  const renderedContent = useMemo(() => {
    return text.split('\n').map((rawLine, lineIndex) => {
      const line = rawLine.trim();
      if (!line) return <div key={lineIndex} className="h-2" />;

      const isBullet = line.startsWith('- ') || line.startsWith('* ');
      const cleanLine = isBullet ? line.substring(2) : line;

      // Xử lý markdown in đậm **text** kết hợp với nhãn y tế / dinh dưỡng
      const parts = cleanLine.split(/(\*\*.*?\*\*)/g);

      const content = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={pIdx} className="font-bold text-gray-900">
              {part.slice(2, -2)}
            </strong>
          );
        }

        // Đánh dấu các nhãn danh mục thực đơn
        return part.split(LABEL_PATTERN).map((subPart, sIdx) => {
          if (sIdx % 2 === 1) {
            return (
              <span key={`${pIdx}-${sIdx}`} className="font-extrabold text-primary-dark">
                {subPart}:
              </span>
            );
          }
          return subPart;
        });
      });

      return (
        <p key={lineIndex} className={`mb-1.5 last:mb-0 leading-relaxed ${isBullet ? 'pl-3.5 relative before:content-["•"] before:absolute before:left-0 before:text-primary before:font-bold' : ''}`}>
          {content}
        </p>
      );
    });
  }, [text]);

  return <div className="space-y-0.5 text-[14px] md:text-[15px]">{renderedContent}</div>;
});

FormattedResponse.displayName = 'FormattedResponse';

/* ─── Thẻ món ăn đề xuất được bọc Memo tránh re-render thừa ─── */
const RecommendedFoodCard = memo(({ food, onSelectFood, onAddToCart }) => {
  const calories = food.nutrition?.calories;
  const priceFormatted = Number(food.price || 0).toLocaleString('vi-VN');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:border-primary-light transition-colors">
      <div className="flex p-2.5 gap-2.5 items-center">
        <img
          src={food.images?.[0] || FALLBACK_FOOD_IMAGE}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = FALLBACK_FOOD_IMAGE;
          }}
          alt={food.name}
          className="w-14 h-14 object-cover rounded-xl border border-gray-100 shrink-0"
          loading="lazy"
        />
        <div className="flex-1 min-w-0">
          <h5 className="font-bold text-xs text-gray-900 truncate" title={food.name}>
            {food.name}
          </h5>
          <p className="text-primary text-xs font-bold mt-0.5">{priceFormatted}đ</p>
          {calories ? (
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
              🔥 {calories} kcal
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex border-t border-gray-50 text-xs divide-x divide-gray-50 bg-gray-50/60">
        <Link
          to={`/food/${food._id}`}
          onClick={onSelectFood}
          className="flex-1 py-2 text-center text-gray-600 font-semibold hover:bg-white hover:text-primary transition-colors"
        >
          Chi tiết
        </Link>
        <button
          type="button"
          onClick={() => onAddToCart(food)}
          className="flex-1 py-2 text-center text-primary font-bold hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-1"
        >
          <ShoppingCart size={12} /> Thêm vào giỏ
        </button>
      </div>
    </div>
  );
});

RecommendedFoodCard.displayName = 'RecommendedFoodCard';

/* ─── Component Chính AIChatbot ─── */
const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  // Reset cuộc trò chuyện khi đổi tài khoản
  const [prevUserId, setPrevUserId] = useState(user?._id);
  if (prevUserId !== user?._id) {
    setPrevUserId(user?._id);
    setChatHistory([]);
    setMessage('');
  }

  // Cuộn trang mượt mà qua requestAnimationFrame đảm bảo DOM render xong
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const animId = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(animId);
  }, [chatHistory, loading, isOpen, scrollToBottom]);

  // Tự động focus ô nhập liệu khi mở chat và phím tắt Escape
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          if (isFullscreen) {
            setIsFullscreen(false);
          } else {
            setIsOpen(false);
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isFullscreen]);

  const handleSendMessage = useCallback(async (msgText) => {
    const trimmed = (msgText || '').trim();
    if (!trimmed || loading || !user) return;

    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newMsg = {
      _id: tempId,
      message: trimmed,
      response: '',
      isTemporary: true,
    };

    setChatHistory((prev) => [...prev, newMsg]);
    setMessage('');
    setLoading(true);

    try {
      const { data } = await axiosClient.post('/ai/recommend', { message: trimmed });
      setChatHistory((prev) => prev.map((c) => (c._id === tempId ? data : c)));
    } catch (error) {
      let errorMessage = 'Xin lỗi, máy chủ AI đang bận hoặc phản hồi chậm. Vui lòng thử lại sau giây lát.';
      if (error.response?.status === 401) {
        errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục tư vấn.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'Yêu cầu vượt quá thời gian chờ (timeout). Vui lòng thử lại với câu hỏi ngắn hơn.';
      } else if (!error.response) {
        errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.';
      }
      setChatHistory((prev) =>
        prev.map((c) => (c._id === tempId ? { ...c, response: errorMessage, isTemporary: false } : c))
      );
    } finally {
      setLoading(false);
    }
  }, [loading, user]);


  const closeChat = useCallback(() => setIsOpen(false), []);

  return (
    <>
      {/* Floating Action Button - Sử dụng CSS ring pulse thuần cho 60fps mượt mà, không tốn CPU */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Mở Trợ Lý Tư Vấn Dinh Dưỡng"
        className="fixed bottom-6 right-6 z-[60] w-16 h-16 rounded-full bg-gradient-to-tr from-primary to-secondary text-white shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 ring-4 ring-orange-400/30 animate-pulse hover:animate-none"
      >
        {isOpen ? <X size={28} /> : <Sparkles size={28} className="animate-spin-slow" />}
      </button>

      {/* Cửa sổ Chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 35, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.95, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={`fixed z-[60] glassmorphism shadow-2xl border border-white/60 flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl ${
              isFullscreen
                ? 'inset-3 md:inset-8 rounded-3xl'
                : 'bottom-24 right-4 md:right-6 w-[calc(100vw-32px)] sm:w-[390px] h-[580px] max-h-[78vh] rounded-3xl'
            }`}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary via-orange-500 to-amber-500 p-4 text-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm md:text-base flex items-center gap-1.5 leading-tight">
                    Chuyên Viên Dinh Dưỡng AI
                  </h3>
                  <p className="text-[11px] text-white/85 mt-0.5">Tư vấn món ăn & sức khỏe thông minh</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {user && (
                  <Link
                    to="/ai-history"
                    onClick={closeChat}
                    title="Xem lịch sử trò chuyện"
                    className="text-xs text-white/80 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    Lịch sử
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  title={isFullscreen ? 'Thu nhỏ' : 'Phóng to'}
                >
                  {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                </button>
                <button
                  type="button"
                  onClick={closeChat}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  title="Đóng chat"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Chat Messages Area */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 bg-slate-50/60 space-y-4">
              {chatHistory.length === 0 && !loading && user && (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-primary-light flex items-center justify-center text-primary mb-3 shadow-inner">
                    <Bot size={34} />
                  </div>
                  <h4 className="font-bold text-gray-800 text-sm">Xin chào {user.name || 'bạn'}!</h4>
                  <p className="text-xs text-gray-500 max-w-[260px] mt-1 leading-relaxed">
                    Tôi là trợ lý dinh dưỡng FoodCare. Bạn có thể hỏi thực đơn theo thể trạng, calo hoặc chế độ bệnh lý.
                  </p>
                </div>
              )}

              {chatHistory.map((chat) => (
                <div key={chat._id} className="space-y-3">
                  {/* Tin nhắn từ người dùng */}
                  <div className="flex justify-end">
                    <div className="bg-primary text-white px-4 py-2.5 rounded-2xl rounded-tr-xs max-w-[85%] shadow-sm text-sm font-medium leading-relaxed">
                      {chat.message}
                    </div>
                  </div>

                  {/* Phản hồi từ AI */}
                  <div className="flex justify-start gap-2.5 items-start">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-primary to-primary-dark shrink-0 flex items-center justify-center text-white shadow-sm mt-0.5">
                      <Sparkles size={13} />
                    </div>

                    <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-xs max-w-[90%] shadow-sm text-slate-800">
                      {chat.isTemporary && !chat.response ? (
                        <div className="flex space-x-1.5 items-center h-5 py-1">
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      ) : (
                        <FormattedResponse text={chat.response} />
                      )}

                      {/* Danh sách món ăn gợi ý đính kèm */}
                      {chat.recommendedFoods?.length > 0 && (
                        <div className="mt-3.5 space-y-2 border-t border-gray-100 pt-3">
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Món ăn phù hợp gợi ý:
                          </p>
                          {chat.recommendedFoods.map((food) => (
                            <RecommendedFoodCard
                              key={food._id}
                              food={food}
                              onSelectFood={closeChat}
                              onAddToCart={addToCart}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input & Quick Chips */}
            <div className="bg-white border-t border-gray-100">
              {user ? (
                <>
                  {/* Quick Chips Câu hỏi nhanh */}
                  <div className="px-3 py-2 flex gap-1.5 overflow-x-auto no-scrollbar border-b border-gray-50 bg-gray-50/50">
                    {QUICK_CHIPS.map((chip, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleSendMessage(chip)}
                        disabled={loading}
                        className="whitespace-nowrap px-3 py-1 bg-white border border-gray-200/80 rounded-full text-[11px] font-medium text-gray-700 hover:border-primary hover:text-primary hover:bg-primary-light/40 transition-colors disabled:opacity-50"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  {/* Form Gửi tin nhắn */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage(message);
                    }}
                    className="p-3 flex items-center gap-2"
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      className="flex-1 bg-gray-100/80 rounded-full px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:bg-white focus:ring-1 focus:ring-primary border border-transparent focus:border-primary transition-all"
                      placeholder="Hỏi món ăn, bệnh lý, calo..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="submit"
                      disabled={loading || !message.trim()}
                      className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shrink-0 hover:bg-primary-dark disabled:opacity-40 transition-all shadow-md shadow-primary-light hover:scale-105 active:scale-95"
                      title="Gửi câu hỏi"
                    >
                      <Send size={16} className="-ml-0.5" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="p-6 text-center bg-gray-50/50">
                  <p className="text-xs text-gray-500 mb-3">Vui lòng đăng nhập để được tư vấn món ăn cá nhân hóa.</p>
                  <button
                    type="button"
                    onClick={() => {
                      closeChat();
                      navigate('/login');
                    }}
                    className="bg-primary text-white text-xs px-6 py-2.5 rounded-full font-bold shadow-md shadow-primary/20 hover:bg-primary-dark transition-colors"
                  >
                    Đăng nhập ngay
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIChatbot;
