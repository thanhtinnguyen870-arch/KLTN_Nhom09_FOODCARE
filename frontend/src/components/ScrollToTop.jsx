import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Cuộn lên đầu trang mỗi khi route thay đổi
// Dùng { top: 0, behavior: 'instant' } để tránh giật khi chuyển trang
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // instant thay vì smooth để tránh người dùng thấy trang cũ trước khi lên đầu
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
