import { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext();

const getStoredUser = () => {
  try {
    const userInfo = localStorage.getItem('userInfo');
    const token = localStorage.getItem('token');
    if (token) {
      axiosClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return userInfo ? JSON.parse(userInfo) : null;
  } catch {
    localStorage.removeItem('userInfo');
    localStorage.removeItem('token');
    delete axiosClient.defaults.headers.common['Authorization'];
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser);
  const [loading] = useState(false);
  const syncedUserIdRef = useRef(null);

  const updateUser = useCallback((userData) => {
    setUser((currentUser) => {
      if (!currentUser) return currentUser;
      const updatedUser = { ...currentUser, ...userData };
      localStorage.setItem('userInfo', JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  const storeAuthenticatedUser = (data) => {
    syncedUserIdRef.current = data._id;
    setUser(data);
    localStorage.setItem('userInfo', JSON.stringify(data));
    localStorage.setItem('token', data.token);
    axiosClient.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
  };

  // Ref để track userId hiện tại (tránh stale closure trong async callback)
  const currentUserIdRef = useRef(user?._id ?? null);
  useEffect(() => {
    currentUserIdRef.current = user?._id ?? null;
  }, [user?._id]);

  // Sync tier/totalSpent một lần khi userId thay đổi (login mới hoặc tải trang)
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = user?._id;

    // Chỉ sync khi có token + userId và chưa sync cho userId này
    if (!token || !userId || syncedUserIdRef.current === userId) return;

    syncedUserIdRef.current = userId;

    axiosClient.get('/auth/me').then(({ data }) => {
      // Kiểm tra userId vẫn còn khớp trước khi cập nhật (tránh race condition)
      if (currentUserIdRef.current !== userId) return;
      if (data.totalSpent !== undefined || data.tier !== undefined) {
        updateUser({ totalSpent: data.totalSpent, tier: data.tier });
      }
    }).catch((error) => {
      // Chỉ xóa session khi userId vẫn khớp VÀ lỗi 401 xác thực không thành công
      if (currentUserIdRef.current !== userId) return;
      if (error.response?.status === 401) {
        syncedUserIdRef.current = null;
        setUser(null);
        localStorage.removeItem('userInfo');
        localStorage.removeItem('token');
        delete axiosClient.defaults.headers.common['Authorization'];
      } else {
        console.warn('Không thể đồng bộ dữ liệu người dùng (server local):', error.message);
      }
    });
  // Chỉ phụ thuộc vào user._id – KHÔNG thêm totalSpent/tier để tránh re-run vô tận
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await axiosClient.post('/auth/login', { email, password });
      storeAuthenticatedUser(data);
      toast.success('Đăng nhập thành công!');
      return { success: true, user: data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Đăng nhập thất bại.' };
    }
  }, []);

  const googleLogin = useCallback(async (credential) => {
    try {
      const { data } = await axiosClient.post('/auth/google', { credential });
      storeAuthenticatedUser(data);
      toast.success('Đăng nhập bằng Google thành công!');
      return { success: true, user: data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Đăng nhập Google không thành công.',
      };
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    try {
      const { data } = await axiosClient.post('/auth/register', { name, email, password });
      storeAuthenticatedUser(data);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Đăng ký thất bại.' };
    }
  }, []);

  const logout = useCallback(() => {
    syncedUserIdRef.current = null;
    setUser(null);
    localStorage.removeItem('userInfo');
    localStorage.removeItem('token');
    delete axiosClient.defaults.headers.common['Authorization'];
    toast.success('Đăng xuất thành công!');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, googleLogin, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
