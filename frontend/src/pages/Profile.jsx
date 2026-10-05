import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  Camera,
  CheckCircle2,
  Clock,
  Edit3,
  History,
  Package,
  ReceiptText,
  Save,
  Truck,
  User,
  XCircle,
  Gift,
  Crown,
  Diamond,
  Search,
  RotateCcw,
  ShoppingCart,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import axiosClient from '../api/axiosClient';
import { toast } from 'react-toastify';
import NutritionTargetCard from '../components/NutritionTargetCard';
import { ACTIVITY_LEVELS, GOALS, COMMON_ALLERGIES } from '../utils/nutritionCalculator';

const orderSteps = [
  { key: 'pending', label: 'Chờ xác nhận', icon: Clock },
  { key: 'confirmed', label: 'Đã xác nhận', icon: CheckCircle2 },
  { key: 'preparing', label: 'Đang chuẩn bị', icon: Package },
  { key: 'shipping', label: 'Đang giao', icon: Truck },
  { key: 'completed', label: 'Hoàn thành', icon: CheckCircle2 },
];

const statusLabels = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  shipping: 'Đang giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

const statusClasses = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  preparing: 'bg-purple-50 text-purple-700 border-purple-200',
  shipping: 'bg-orange-50 text-orange-700 border-orange-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

const formatCurrency = (value = 0) => `${Number(value).toLocaleString('vi-VN')}đ`;
const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '-';

const getOrderUserId = (order) => {
  if (!order?.user) return '';
  return typeof order.user === 'string' ? order.user : order.user._id || order.user.id || '';
};

const Profile = () => {
  const { user, updateUser } = useAuth();
  const { reorder } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef(null);
  const initialTab = ['info', 'health', 'offers', 'tracking', 'history'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'health';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [trackingSearch, setTrackingSearch] = useState('');
  const setMessage = (msg) => toast.info(msg);
  const [healthData, setHealthData] = useState({
    age: user?.healthProfile?.age || '',
    gender: user?.healthProfile?.gender || 'male',
    weight: user?.healthProfile?.weight || '',
    height: user?.healthProfile?.height || '',
    activityLevel: user?.healthProfile?.activityLevel || 'sedentary',
    goal: user?.healthProfile?.goal || 'maintain',
    dietType: user?.healthProfile?.dietType || 'Bình thường',
    allergies: user?.healthProfile?.allergies?.join(', ') || '',
    conditions: user?.healthProfile?.conditions?.join(', ') || '',
  });
  const [infoData, setInfoData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const syncHealthData = setTimeout(() => {
      setHealthData({
        age: user?.healthProfile?.age || '',
        gender: user?.healthProfile?.gender || 'male',
        weight: user?.healthProfile?.weight || '',
        height: user?.healthProfile?.height || '',
        activityLevel: user?.healthProfile?.activityLevel || 'sedentary',
        goal: user?.healthProfile?.goal || 'maintain',
        dietType: user?.healthProfile?.dietType || 'Bình thường',
        allergies: user?.healthProfile?.allergies?.join(', ') || '',
        conditions: user?.healthProfile?.conditions?.join(', ') || '',
      });
    }, 0);

    return () => clearTimeout(syncHealthData);
  }, [user?.healthProfile]);

  // Đồng bộ thông tin cá nhân khi user thay đổi (sau khi lưu hoặc quay lại trang)
  useEffect(() => {
    const syncInfoData = setTimeout(() => {
      setInfoData({
        name: user?.name || '',
        phone: user?.phone || '',
        address: user?.address || '',
      });
    }, 0);

    return () => clearTimeout(syncInfoData);
  }, [user?.name, user?.phone, user?.address]);

  useEffect(() => {
    if (!user) return;

    let ignoreRequest = false;

    const fetchOrders = async () => {
      try {
        const { data } = await axiosClient.get('/orders/my-orders');
        if (!ignoreRequest) setOrders(data);
      } catch (error) {
        if (!ignoreRequest) setMessage(error.response?.data?.message || 'Không thể tải đơn hàng.');
      } finally {
        if (!ignoreRequest) setOrdersLoading(false);
      }
    };

    const fetchUserData = async () => {
      try {
        const { data } = await axiosClient.get('/auth/me');
        if (!ignoreRequest && (data.totalSpent !== user.totalSpent || data.tier !== user.tier)) {
          updateUser({ totalSpent: data.totalSpent, tier: data.tier });
        }
      } catch (error) {
        if (!ignoreRequest) console.error("Lỗi khi cập nhật thông tin thành viên:", error);
      }
    };

    fetchOrders();
    fetchUserData();

    return () => {
      ignoreRequest = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  useEffect(() => {
    if (!user?._id) return;

    const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';
    const socket = io(baseUrl);

    const upsertOwnOrder = (incomingOrder) => {
      if (getOrderUserId(incomingOrder) !== user._id) return;

      setOrders((current) => {
        const exists = current.some((order) => order._id === incomingOrder._id);
        if (exists) {
          return current.map((order) => (order._id === incomingOrder._id ? incomingOrder : order));
        }
        return [incomingOrder, ...current];
      });
    };

    socket.on('newOrder', upsertOwnOrder);
    socket.on('orderUpdated', upsertOwnOrder);

    return () => {
      socket.disconnect();
    };
  }, [user?._id]);

  const trackingOrders = useMemo(
    () => orders.filter((order) => ['pending', 'confirmed', 'preparing', 'shipping'].includes(order.orderStatus)),
    [orders]
  );

  const cleanTrackingSearchQuery = useMemo(
    () => trackingSearch.trim().toLowerCase().replace(/^#/, ''),
    [trackingSearch]
  );

  const filteredTrackingOrders = useMemo(() => {
    if (!cleanTrackingSearchQuery) return trackingOrders;
    return trackingOrders.filter(
      (order) =>
        order._id.toLowerCase().includes(cleanTrackingSearchQuery) ||
        order._id.slice(-8).toLowerCase().includes(cleanTrackingSearchQuery) ||
        order.items.some((item) => item.name.toLowerCase().includes(cleanTrackingSearchQuery))
    );
  }, [trackingOrders, cleanTrackingSearchQuery]);

  const cleanSearchQuery = useMemo(
    () => historySearch.trim().toLowerCase().replace(/^#/, ''),
    [historySearch]
  );

  const historyOrders = useMemo(() => {
    const finished = orders.filter((order) => ['completed', 'cancelled'].includes(order.orderStatus));
    const filtered = historyFilter === 'all' ? finished : finished.filter((order) => order.orderStatus === historyFilter);
    if (!cleanSearchQuery) return filtered;
    return filtered.filter(
      (order) =>
        order._id.toLowerCase().includes(cleanSearchQuery) ||
        order._id.slice(-8).toLowerCase().includes(cleanSearchQuery) ||
        order.items.some((item) => item.name.toLowerCase().includes(cleanSearchQuery))
    );
  }, [orders, historyFilter, cleanSearchQuery]);

  const matchedInTracking = useMemo(() => {
    if (!cleanSearchQuery) return null;
    return trackingOrders.find(
      (order) =>
        order._id.toLowerCase().includes(cleanSearchQuery) ||
        order._id.slice(-8).toLowerCase().includes(cleanSearchQuery) ||
        order.items.some((item) => item.name.toLowerCase().includes(cleanSearchQuery))
    );
  }, [trackingOrders, cleanSearchQuery]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleUpdate = async (event) => {
    event.preventDefault();

    if (!healthData.age || !healthData.weight || !healthData.height) {
      setMessage('Vui lòng nhập tuổi, cân nặng và chiều cao.');
      return;
    }

    try {
      const conditions = healthData.conditions
        ? healthData.conditions.split(',').map((item) => item.trim()).filter(Boolean)
        : [];
      const allergies = healthData.allergies
        ? healthData.allergies.split(',').map((item) => item.trim()).filter(Boolean)
        : [];

      const payload = {
        ...healthData,
        conditions,
        allergies,
      };

      const { data } = await axiosClient.put('/auth/health-profile', payload);
      updateUser({ healthProfile: data });
      setMessage('Đã cập nhật hồ sơ sức khỏe và tự động tính toán lại chỉ số dinh dưỡng.');
      setEditing(false);
    } catch {
      setMessage('Cập nhật hồ sơ sức khỏe thất bại.');
    }
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setUploading(true);
    try {
      const { data } = await axiosClient.post('/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await axiosClient.put('/auth/profile', { avatar: data.url });
      updateUser({ avatar: data.url });
      setMessage('Đã cập nhật ảnh đại diện.');
    } catch {
      setMessage('Không thể tải ảnh đại diện.');
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage('Mật khẩu xác nhận không khớp.');
      return;
    }

    try {
      const { data } = await axiosClient.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage(data.message || 'Đã thay đổi mật khẩu thành công.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Không thể thay đổi mật khẩu.');
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Bạn muốn hủy đơn hàng này?')) return;

    try {
      const { data } = await axiosClient.put(`/orders/${orderId}/cancel`);
      setOrders((current) => current.map((order) => (order._id === orderId ? data : order)));
      setMessage('Đã hủy đơn hàng.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Không thể hủy đơn hàng.');
    }
  };

  const handleReorder = (orderItems) => {
    reorder(orderItems);
    navigate('/cart');
  };

  const handleUpdateInfo = async (event) => {
    event.preventDefault();
    try {
      const { data } = await axiosClient.put('/auth/profile', infoData);
      updateUser(data);
      setMessage('Đã cập nhật thông tin cá nhân.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Không thể cập nhật thông tin cá nhân.');
    }
  };

  const tabs = [
    { id: 'info', label: 'Thông tin cá nhân', icon: User },
    { id: 'health', label: 'Hồ sơ sức khỏe', icon: Activity },
    { id: 'offers', label: 'Ưu đãi của tôi', icon: Gift },
    { id: 'tracking', label: 'Theo dõi đơn hàng', icon: Truck, count: trackingOrders.length },
    { id: 'history', label: 'Lịch sử mua hàng', icon: History, count: orders.filter((order) => ['completed', 'cancelled'].includes(order.orderStatus)).length },
  ];

  return (
    <div className="container mx-auto min-h-[70vh] px-4 py-10 md:px-12">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-5">
          <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-3d">
            <div className="group relative mx-auto mb-4 h-32 w-32 rounded-full border-4 border-primary/20 p-1">
              <img src={user?.avatar || 'https://via.placeholder.com/150'} alt="Avatar" className="h-full w-full rounded-full object-cover" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`absolute inset-1 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 ${uploading ? 'opacity-100' : ''}`}
              >
                {uploading ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Camera size={28} />}
              </button>
              <input ref={fileInputRef} type="file" onChange={handleAvatarChange} accept="image/*" className="hidden" />
            </div>
            <h2 className="text-2xl font-bold">{user?.name}</h2>
            <p className="mb-6 text-gray-500">{user?.email}</p>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-light/50 px-4 py-2 text-sm font-semibold text-primary">
              <User size={16} />
              {user?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-3 shadow-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left font-bold transition ${
                    isActive ? 'bg-dark text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-dark'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={18} />
                    {tab.label}
                  </span>
                  {typeof tab.count === 'number' && (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? 'bg-white text-dark' : 'bg-gray-100 text-gray-600'}`}>{tab.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="space-y-5">

          {activeTab === 'info' && (
            <>
              <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-3d">
                <div className="mb-6 flex items-center justify-between border-b pb-4">
                  <h3 className="flex items-center gap-2 text-2xl font-bold text-dark">
                    <User className="text-primary" />
                    Thông tin cá nhân
                  </h3>
                </div>
                <form onSubmit={handleUpdateInfo} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <HealthInput label="Họ và tên" value={infoData.name} onChange={(value) => setInfoData({ ...infoData, name: value })} required />
                    <HealthInput label="Số điện thoại" value={infoData.phone} onChange={(value) => setInfoData({ ...infoData, phone: value })} />
                    <div className="md:col-span-2">
                      <HealthInput label="Địa chỉ" value={infoData.address} onChange={(value) => setInfoData({ ...infoData, address: value })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-gray-700">Email (Không thể thay đổi)</span>
                        <input
                          type="email"
                          value={user?.email}
                          disabled
                          className="w-full rounded-xl border bg-gray-50 px-4 py-2 text-gray-500 outline-none cursor-not-allowed"
                        />
                      </label>
                    </div>
                  </div>
                  <button type="submit" className="rounded-xl bg-primary px-6 py-2 font-bold text-white transition-colors hover:bg-primary-dark shadow-md shadow-primary-light">
                    Lưu thông tin
                  </button>
                </form>
              </section>
              <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-3d">
                <h3 className="mb-6 border-b pb-4 text-2xl font-bold text-dark">Thay đổi mật khẩu</h3>
                <form onSubmit={handleChangePassword} className="grid gap-4 md:grid-cols-3">
                  <HealthInput label="Mật khẩu hiện tại" type="password" value={passwordForm.currentPassword} onChange={(value) => setPasswordForm({ ...passwordForm, currentPassword: value })} required />
                  <HealthInput label="Mật khẩu mới" type="password" value={passwordForm.newPassword} onChange={(value) => setPasswordForm({ ...passwordForm, newPassword: value })} required />
                  <HealthInput label="Xác nhận mật khẩu" type="password" value={passwordForm.confirmPassword} onChange={(value) => setPasswordForm({ ...passwordForm, confirmPassword: value })} required />
                  <div className="md:col-span-3">
                    <button type="submit" className="rounded-xl bg-dark px-6 py-2 font-bold text-white transition-colors hover:bg-slate-700">
                      Cập nhật mật khẩu
                    </button>
                  </div>
                </form>
              </section>
            </>
          )}

          {activeTab === 'health' && (
            <div className="space-y-6">
              {/* Card Dinh dưỡng TDEE / BMR & Macro Targets */}
              <NutritionTargetCard healthProfile={user?.healthProfile} />

              {/* Form / Chi tiết Hồ sơ sức khỏe */}
              <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-3d">
                <div className="mb-6 flex items-center justify-between border-b pb-4">
                  <div>
                    <h3 className="flex items-center gap-2 text-2xl font-bold text-dark">
                      <Activity className="text-primary" />
                      Thông Số Thể Trạng & Hồ Sơ Dinh Dưỡng
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Dữ liệu được bảo mật và dùng để cá nhân hóa thực đơn & cảnh báo an toàn</p>
                  </div>
                  <button
                    onClick={() => setEditing(!editing)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 transition-colors hover:border-primary hover:text-primary"
                  >
                    {editing ? <><Save size={16} /> Đang sửa</> : <><Edit3 size={16} /> Cập nhật hồ sơ</>}
                  </button>
                </div>

                {editing ? (
                  <form onSubmit={handleUpdate} className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <HealthInput
                        label="Tuổi"
                        value={healthData.age}
                        onChange={(value) => setHealthData({ ...healthData, age: value })}
                        required
                        type="number"
                      />
                      <HealthInput
                        label="Cân nặng (kg)"
                        value={healthData.weight}
                        onChange={(value) => setHealthData({ ...healthData, weight: value })}
                        required
                        type="number"
                      />
                      <HealthInput
                        label="Chiều cao (cm)"
                        value={healthData.height}
                        onChange={(value) => setHealthData({ ...healthData, height: value })}
                        required
                        type="number"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-gray-700">Giới tính sinh học</span>
                        <select
                          value={healthData.gender}
                          onChange={(e) => setHealthData({ ...healthData, gender: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        >
                          <option value="male">Nam (Male)</option>
                          <option value="female">Nữ (Female)</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-gray-700">Mức độ vận động thể chất</span>
                        <select
                          value={healthData.activityLevel}
                          onChange={(e) => setHealthData({ ...healthData, activityLevel: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        >
                          {ACTIVITY_LEVELS.map((act) => (
                            <option key={act.value} value={act.value}>
                              {act.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-gray-700">Mục tiêu dinh dưỡng</span>
                        <select
                          value={healthData.goal}
                          onChange={(e) => setHealthData({ ...healthData, goal: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        >
                          {GOALS.map((g) => (
                            <option key={g.value} value={g.value}>
                              {g.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-gray-700">Chế độ ăn ưa thích</span>
                        <select
                          value={healthData.dietType}
                          onChange={(e) => setHealthData({ ...healthData, dietType: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        >
                          <option value="Bình thường">Bình thường (Đa dạng)</option>
                          <option value="Ăn chay">Ăn chay (Vegetarian)</option>
                          <option value="Eat clean">Eat Clean / Healthy</option>
                          <option value="Low carb / Keto">Low Carb / Keto</option>
                          <option value="Tiểu đường">Thực đơn cho người tiểu đường</option>
                        </select>
                      </label>
                    </div>

                    {/* Dị ứng thực phẩm */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="block text-sm font-semibold text-gray-700">
                          Dị ứng thực phẩm (Hệ thống sẽ tự động cảnh báo khi thêm món vào giỏ)
                        </span>
                        <span className="text-xs text-rose-500 font-medium flex items-center gap-1">
                          <ShieldAlert size={14} /> Tự động cảnh báo
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="Nhập dị ứng (phân tách bằng dấu phẩy, ví dụ: Tôm, Đậu phộng...)"
                        className="w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        value={healthData.allergies}
                        onChange={(e) => setHealthData({ ...healthData, allergies: e.target.value })}
                      />
                      {/* Gợi ý bấm nhanh */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-gray-400">Chọn nhanh:</span>
                        {COMMON_ALLERGIES.map((item) => {
                          const isSelected = healthData.allergies.toLowerCase().includes(item.toLowerCase().split(' ')[0]);
                          return (
                            <button
                              type="button"
                              key={item}
                              onClick={() => {
                                const current = healthData.allergies ? healthData.allergies.split(',').map((s) => s.trim()).filter(Boolean) : [];
                                if (!current.includes(item)) {
                                  setHealthData({ ...healthData, allergies: [...current, item].join(', ') });
                                }
                              }}
                              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                                isSelected
                                  ? 'bg-rose-500 text-white border-rose-500 font-semibold'
                                  : 'bg-gray-50 hover:bg-rose-50 text-gray-600 border-gray-200'
                              }`}
                            >
                              + {item}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bệnh lý hoặc lưu ý dinh dưỡng */}
                    <label className="block">
                      <span className="mb-1 block text-sm font-semibold text-gray-700">Bệnh lý nền hoặc lưu ý y tế</span>
                      <textarea
                        rows="2"
                        placeholder="Ví dụ: Tiểu đường type 2, cao huyết áp, đau dạ dày, gout..."
                        className="w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        value={healthData.conditions}
                        onChange={(event) => setHealthData({ ...healthData, conditions: event.target.value })}
                      />
                    </label>

                    <div className="pt-2 flex gap-3">
                      <button
                        type="submit"
                        className="rounded-xl bg-primary px-6 py-2.5 font-bold text-white transition-colors hover:bg-primary-dark shadow-md shadow-primary-light"
                      >
                        Lưu và Tính toán lại chỉ số
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="rounded-xl border border-gray-200 px-5 py-2.5 font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Hủy
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      <ProfileInfo
                        label="Tuổi & Giới tính"
                        value={healthData.age ? `${healthData.age} tuổi (${healthData.gender === 'female' ? 'Nữ' : 'Nam'})` : 'Chưa cập nhật'}
                      />
                      <ProfileInfo
                        label="Chỉ số cơ thể"
                        value={healthData.weight && healthData.height ? `${healthData.weight}kg / ${healthData.height}cm` : 'Chưa cập nhật'}
                      />
                      <ProfileInfo
                        label="Mức độ vận động"
                        value={ACTIVITY_LEVELS.find((a) => a.value === healthData.activityLevel)?.label || 'Ít vận động'}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <ProfileInfo
                        label="Mục tiêu sức khỏe"
                        value={GOALS.find((g) => g.value === healthData.goal)?.label || healthData.goal || 'Duy trì cân nặng'}
                      />
                      <ProfileInfo
                        label="Chế độ ăn ưa chuộng"
                        value={healthData.dietType || 'Bình thường'}
                      />
                    </div>

                    {/* Dị ứng */}
                    <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80">
                      <div className="flex items-center gap-2 text-rose-700 font-bold text-sm mb-2">
                        <ShieldAlert size={18} />
                        Dị ứng thực phẩm đăng ký:
                      </div>
                      {user?.healthProfile?.allergies?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {user.healthProfile.allergies.map((alg, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 rounded-full text-xs font-bold bg-white text-rose-700 border border-rose-200 shadow-sm"
                            >
                              ⚠️ {alg}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-rose-600">Bạn chưa đăng ký danh mục dị ứng nào. Nhấn "Cập nhật hồ sơ" để thêm.</p>
                      )}
                    </div>

                    {/* Bệnh lý */}
                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                      <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Bệnh lý nền / Lưu ý dinh dưỡng:</p>
                      <p className="text-sm font-medium text-amber-900">
                        {user?.healthProfile?.conditions?.length
                          ? user.healthProfile.conditions.join(', ')
                          : 'Không có lưu ý đặc biệt'}
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'offers' && (
            <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-3d">
              <div className="mb-6 border-b pb-4">
                <h3 className="flex items-center gap-2 text-2xl font-bold text-dark">
                  <Gift className="text-primary" />
                  Ưu đãi của tôi
                </h3>
              </div>
              
              <div className="flex flex-col md:flex-row gap-6 mb-8">
                <div className={`flex-1 rounded-3xl p-6 relative overflow-hidden ${
                  user?.tier === 'Kim Cương' ? 'bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200' :
                  user?.tier === 'Vàng' ? 'bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200' :
                  'bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200'
                }`}>
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-500 mb-1">Hạng hiện tại</p>
                      <h4 className={`text-3xl font-black ${
                        user?.tier === 'Kim Cương' ? 'text-violet-700' :
                        user?.tier === 'Vàng' ? 'text-amber-600' :
                        'text-emerald-700'
                      }`}>{user?.tier || 'Thành viên'}</h4>
                    </div>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      user?.tier === 'Kim Cương' ? 'bg-violet-200 text-violet-600' :
                      user?.tier === 'Vàng' ? 'bg-amber-200 text-amber-600' :
                      'bg-emerald-200 text-emerald-600'
                    }`}>
                      {user?.tier === 'Kim Cương' ? <Diamond size={32} /> : user?.tier === 'Vàng' ? <Crown size={32} /> : <User size={32} />}
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 rounded-3xl p-6 bg-gray-50 border border-gray-100 flex flex-col justify-center">
                  <p className="text-sm font-bold text-gray-500 mb-2">Tổng chi tiêu tích luỹ</p>
                  <p className="text-3xl font-black text-dark mb-3">{formatCurrency(user?.totalSpent || 0)}</p>
                  
                  {user?.tier === 'Kim Cương' ? (
                    <div className="text-sm font-semibold text-violet-600">Bạn đã đạt hạng cao nhất!</div>
                  ) : (
                    <div>
                      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${user?.tier === 'Vàng' ? 'bg-violet-500' : 'bg-amber-500'}`} 
                          style={{ width: `${Math.min(100, ((user?.totalSpent || 0) / (user?.tier === 'Vàng' ? 20000000 : 5000000)) * 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Còn {formatCurrency((user?.tier === 'Vàng' ? 20000000 : 5000000) - (user?.totalSpent || 0))} nữa để lên hạng {user?.tier === 'Vàng' ? 'Kim Cương' : 'Vàng'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <h4 className="text-xl font-bold text-dark mb-4">Quyền lợi của bạn</h4>
              <ul className="space-y-3">
                <li className="flex gap-3 text-sm text-gray-700">
                  <CheckCircle2 className="mt-0.5 flex-none text-emerald-500" size={17} />
                  <span>Theo dõi lịch sử đơn hàng, tích luỹ chi tiêu.</span>
                </li>
                {user?.tier === 'Vàng' && (
                  <li className="flex gap-3 text-sm text-gray-700 font-semibold">
                    <CheckCircle2 className="mt-0.5 flex-none text-amber-500" size={17} />
                    <span>Giảm 5% cho tất cả đơn hàng thanh toán.</span>
                  </li>
                )}
                {user?.tier === 'Kim Cương' && (
                  <li className="flex gap-3 text-sm text-gray-700 font-semibold">
                    <CheckCircle2 className="mt-0.5 flex-none text-violet-500" size={17} />
                    <span>Giảm 10% cho tất cả đơn hàng thanh toán.</span>
                  </li>
                )}
              </ul>
              
              <div className="mt-8 text-center">
                <Link to="/offers" className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-2 font-bold text-gray-700 transition hover:bg-gray-200">
                  Xem chi tiết hạng mức
                </Link>
              </div>
            </section>
          )}

          {activeTab === 'tracking' && (
            <section className="space-y-4">
              <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-dark">Theo dõi đơn hàng</h3>
                  <p className="text-sm text-gray-500">Các đơn đang chờ xác nhận, đang chuẩn bị hoặc đang giao.</p>
                </div>
                {/* Thanh tìm kiếm đơn đang giao */}
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={trackingSearch}
                    onChange={(e) => setTrackingSearch(e.target.value)}
                    placeholder="Tìm mã đơn hoặc tên món..."
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-9 text-sm outline-none focus:border-primary sm:w-60"
                  />
                  {trackingSearch && (
                    <button
                      onClick={() => setTrackingSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <XCircle size={15} />
                    </button>
                  )}
                </div>
              </div>

              {trackingSearch && (
                <p className="text-sm text-gray-500 px-2">
                  Tìm thấy <span className="font-bold text-dark">{filteredTrackingOrders.length}</span> đơn hàng đang xử lý cho &quot;<span className="text-primary">{trackingSearch}</span>&quot;
                </p>
              )}

              <OrdersSection
                title=""
                loading={ordersLoading}
                orders={filteredTrackingOrders}
                emptyTitle={trackingSearch ? 'Không tìm thấy đơn hàng đang xử lý' : 'Bạn chưa có đơn hàng đang xử lý'}
                emptyDescription={trackingSearch ? 'Thử tìm bằng tên món ăn hoặc 8 ký tự cuối mã đơn.' : 'Các đơn chờ xác nhận, đang chuẩn bị hoặc đang giao sẽ xuất hiện tại đây.'}
                onCancelOrder={handleCancelOrder}
              />
            </section>
          )}

          {activeTab === 'history' && (
            <section className="space-y-4">
              {/* Header + bộ lọc */}
              <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-dark">Lịch sử mua hàng</h3>
                    <p className="text-sm text-gray-500">Xem lại các đơn đã hoàn thành hoặc đã hủy.</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {/* Thanh tìm kiếm */}
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder="Tìm mã đơn hoặc tên món..."
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-9 text-sm outline-none focus:border-primary sm:w-60"
                      />
                      {historySearch && (
                        <button
                          onClick={() => setHistorySearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <XCircle size={15} />
                        </button>
                      )}
                    </div>
                    {/* Filter trạng thái */}
                    <select
                      value={historyFilter}
                      onChange={(event) => setHistoryFilter(event.target.value)}
                      className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold outline-none focus:border-primary"
                    >
                      <option value="all">Tất cả lịch sử</option>
                      <option value="completed">Đơn hoàn thành</option>
                      <option value="cancelled">Đơn đã hủy</option>
                    </select>
                  </div>
                </div>
                {/* Kết quả tìm kiếm */}
                {historySearch && (
                  <p className="mt-3 text-sm text-gray-500">
                    Tìm thấy <span className="font-bold text-dark">{historyOrders.length}</span> đơn hàng cho &quot;<span className="text-primary">{historySearch}</span>&quot;
                  </p>
                )}
              </div>

              {/* Gợi ý thông minh nếu đơn hàng đang ở mục Theo dõi đơn hàng */}
              {matchedInTracking && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                      <Truck size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-amber-900">
                        Tìm thấy đơn hàng #{matchedInTracking._id.slice(-8).toUpperCase()} trong mục &quot;Theo dõi đơn hàng&quot;
                      </p>
                      <p className="text-amber-700 text-xs mt-0.5">
                        Đơn này đang ở trạng thái: <span className="font-bold text-amber-800">{statusLabels[matchedInTracking.orderStatus]}</span> (chưa hoàn tất nên không nằm trong Lịch sử mua hàng).
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('tracking')}
                    className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition shrink-0 shadow-sm"
                  >
                    Xem đơn hàng này ngay
                  </button>
                </div>
              )}

              <OrdersSection
                title=""
                loading={ordersLoading}
                orders={historyOrders}
                emptyTitle={historySearch ? 'Không tìm thấy đơn hàng' : 'Chưa có lịch sử mua hàng'}
                emptyDescription={historySearch ? 'Thử tìm bằng tên món ăn hoặc 8 ký tự cuối mã đơn.' : 'Khi đơn hoàn thành hoặc bị hủy, hệ thống sẽ lưu lại tại đây.'}
                onCancelOrder={handleCancelOrder}
                onReorder={handleReorder}
              />
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

const HealthInput = ({ label, value, onChange, required = false, type = 'text' }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-semibold text-gray-700">
      {label} {required && <span className="text-red-500">*</span>}
    </span>
    <input
      type={type}
      required={required}
      className="w-full rounded-xl border px-4 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

const ProfileInfo = ({ label, value, tone = 'gray' }) => {
  const tones = tone === 'red' ? 'border-red-100 bg-red-50 text-red-700' : 'bg-gray-50 text-dark';
  return (
    <div className={`rounded-2xl p-4 ${tones}`}>
      <p className="mb-1 text-sm text-gray-500">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
};

const OrdersSection = ({ title, loading, orders, emptyTitle, emptyDescription, onCancelOrder, onReorder }) => (
  <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-3d">
    {title && <h3 className="mb-5 text-2xl font-bold text-dark">{title}</h3>}
    {loading ? (
      <div className="py-16 text-center text-gray-500">Đang tải đơn hàng...</div>
    ) : orders.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
        <ReceiptText className="mx-auto mb-3 text-gray-400" size={34} />
        <p className="font-bold text-dark">{emptyTitle}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{emptyDescription}</p>
        <Link to="/foods" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-2 font-bold text-white hover:bg-primary-dark transition-colors shadow-md shadow-primary-light">
          Xem thực đơn
        </Link>
      </div>
    ) : (
      <div className="space-y-5">
        {orders.map((order) => (
          <OrderCard key={order._id} order={order} onCancelOrder={onCancelOrder} onReorder={onReorder} />
        ))}
      </div>
    )}
  </section>
);

const OrderCard = ({ order, onCancelOrder, onReorder }) => {
  const currentStepIndex = Math.max(0, orderSteps.findIndex((step) => step.key === order.orderStatus));
  const isCancelled = order.orderStatus === 'cancelled';
  const isCompleted = order.orderStatus === 'completed';
  const isHistory = isCancelled || isCompleted;

  return (
    <div className={`rounded-2xl border p-5 shadow-sm transition-all ${isCancelled ? 'border-rose-100 bg-rose-50/70' : 'border-gray-100 bg-white'}`}>
      <div className="flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-start">
        <div>
          <p className="text-sm text-gray-500">
            Mã đơn: <span className="font-mono font-bold text-dark">#{order._id.slice(-8).toUpperCase()}</span>
          </p>
          <p className="mt-1 text-sm text-gray-500">Ngày đặt: {formatDateTime(order.createdAt)}</p>
          <p className="mt-1 text-sm text-gray-500">Giao tới: {order.shippingAddress}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <StatusBadge status={order.orderStatus} />
          {order.orderStatus === 'pending' && (
            order.paymentStatus === 'paid' ? (
              <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700" title="Đơn đã thanh toán online. Vui lòng liên hệ hotline để hỗ trợ hủy & hoàn tiền.">
                Đã thanh toán (Liên hệ hủy)
              </span>
            ) : (
              <button onClick={() => onCancelOrder(order._id)} className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
                Hủy đơn
              </button>
            )
          )}
          {/* Nút Mua lại – chỉ hiện cho đơn lịch sử */}
          {isHistory && onReorder && (
            <button
              onClick={() => onReorder(order.items)}
              title="Thêm tất cả món vào giỏ hàng và chuyển sang trang giỏ"
              className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-light/40 px-3 py-1 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-white hover:shadow-md active:scale-95"
            >
              <RotateCcw size={12} />
              Mua lại
            </button>
          )}
        </div>
      </div>

      {!isCancelled && order.orderStatus !== 'completed' && (
        <div className="my-5 grid gap-3 md:grid-cols-5">
          {orderSteps.map((step, index) => {
            const Icon = step.icon;
            const done = index <= currentStepIndex;
            return (
              <div key={step.key} className={`rounded-2xl border p-3 text-center ${done ? 'border-primary/30 bg-primary-light/50 text-primary' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>
                <Icon className="mx-auto mb-2" size={18} />
                <p className="text-xs font-bold">{step.label}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {order.items.map((item, index) => (
          <div key={`${order._id}-${index}`} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop'}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop';
                }}
                alt={item.name}
                className="h-12 w-12 rounded-xl object-cover"
              />
              <div className="min-w-0">
                <p className="truncate font-bold">{item.name}</p>
                <p className="text-gray-500">Số lượng: {item.quantity}</p>
              </div>
            </div>
            <span className="shrink-0 font-bold text-gray-700">{formatCurrency(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>

      <div className={`mt-5 rounded-2xl p-4 text-sm ${isCancelled ? 'bg-rose-100/70' : 'bg-gray-50'}`}>
        <div className="grid gap-3 md:grid-cols-3">
          <OrderMeta label="Thanh toán" value={order.paymentMethod} />
          <OrderMeta label="Trạng thái phí" value={order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'} />
          <div className="flex items-center justify-between md:block md:text-right">
            <p className="text-gray-500">Tổng tiền</p>
            <p className="text-xl font-extrabold text-primary">{formatCurrency(order.totalAmount)}</p>
          </div>
        </div>
        {/* Nút Mua lại lớn ở cuối card – chỉ cho đơn hoàn thành */}
        {isCompleted && onReorder && (
          <button
            onClick={() => onReorder(order.items)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-white py-2.5 text-sm font-bold text-primary transition-all hover:bg-primary hover:text-white hover:shadow-lg active:scale-[0.98]"
          >
            <ShoppingCart size={16} />
            Đặt lại đơn hàng này
          </button>
        )}
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${statusClasses[status] || 'border-gray-200 bg-gray-50 text-gray-600'}`}>
    {statusLabels[status] || status}
  </span>
);

const OrderMeta = ({ label, value }) => (
  <div className="flex items-center justify-between md:block">
    <p className="text-gray-500">{label}</p>
    <p className="font-bold text-dark">{value}</p>
  </div>
);

export default Profile;
