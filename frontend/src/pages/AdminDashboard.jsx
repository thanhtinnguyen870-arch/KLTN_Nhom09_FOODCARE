import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Award,
  Bell,
  Bot,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Flame,
  ImagePlus,
  Inbox,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  Upload,
  User,
  UserCheck,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

// ── DESIGN SYSTEM CONSTANTS ──
const BRAND_COLORS = {
  primary: '#16845B',
  primaryDark: '#116344',
  primaryLight: '#E8F5EE',
  accentOrange: '#F59E0B',
  accentLight: '#FFF4DF',
  background: '#F7F9F6',
  surface: '#FFFFFF',
  textPrimary: '#17231D',
  textSecondary: '#758278',
  border: '#E8EEE9',
};

const statusLabels = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  shipping: 'Đang giao hàng',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

const statusBadgeStyles = {
  pending: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  confirmed: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  preparing: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  shipping: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-800',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
  },
  completed: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-600',
  },
  cancelled: {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
};

const tabs = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'orders', label: 'Đơn hàng', icon: ClipboardList },
  { id: 'foods', label: 'Thực đơn', icon: Package },
  { id: 'customers', label: 'Khách hàng', icon: Users },
  { id: 'revenue', label: 'Doanh thu', icon: TrendingUp },
  { id: 'ai_logs', label: 'Nhật ký AI', icon: Bot },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
  { id: 'profile', label: 'Hồ sơ cá nhân', icon: User },
  { id: 'public_menu', label: 'Xem trang chủ', icon: ExternalLink },
];

const emptyFoodForm = {
  name: '',
  price: '',
  category: '',
  description: '',
  image: '',
  ingredients: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  healthTags: '',
  suitableFor: '',
  warningFor: '',
  isAvailable: true,
  isVegetarian: false,
};

const emptyCategoryForm = {
  name: '',
  description: '',
};

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);

const formatDate = (value) =>
  value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 14) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};

const AdminDashboard = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);

  // Layout & navigation state
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [overviewTimeRange, setOverviewTimeRange] = useState('today');

  // Core data states
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [foods, setFoods] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search & filter states
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [foodSearchTerm, setFoodSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [customerNameFilter, setCustomerNameFilter] = useState('');
  const [notificationFilter, setNotificationFilter] = useState('all');

  // Modal states
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingFood, setEditingFood] = useState(null);
  const [foodForm, setFoodForm] = useState(emptyFoodForm);
  const [foodImageUploading, setFoodImageUploading] = useState(false);
  const foodImageInputRef = useRef(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);

  // Revenue filter states (NO CHARTS - TABLE & KPIS ONLY)
  const now = new Date();
  const currentLocalYear = now.getFullYear().toString();
  const currentLocalMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentLocalDate = `${currentLocalYear}-${currentLocalMonth}-${String(now.getDate()).padStart(2, '0')}`;

  const [revenueFilterType, setRevenueFilterType] = useState('month');
  const [revenueFilterDate, setRevenueFilterDate] = useState(currentLocalDate);
  const [revenueFilterMonth, setRevenueFilterMonth] = useState(`${currentLocalYear}-${currentLocalMonth}`);
  const [revenueFilterYear, setRevenueFilterYear] = useState(currentLocalYear);

  // AI Logs states & handlers
  const [aiLogs, setAiLogs] = useState([]);
  const [aiLogsLoading, setAiLogsLoading] = useState(false);
  const [aiTopicFilter, setAiTopicFilter] = useState('all');
  const [aiSearchTerm, setAiSearchTerm] = useState('');
  const [selectedAILog, setSelectedAILog] = useState(null);
  const [deletingAILogId, setDeletingAILogId] = useState(null);

  const fetchAILogs = useCallback(async () => {
    setAiLogsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '50');
      if (aiTopicFilter && aiTopicFilter !== 'all') params.append('topic', aiTopicFilter);
      if (aiSearchTerm.trim()) params.append('search', aiSearchTerm.trim());

      const { data } = await axiosClient.get(`/ai/logs?${params.toString()}`);
      setAiLogs(data.logs || []);
    } catch {
      toast.error('Không thể tải nhật ký câu hỏi AI.');
    } finally {
      setAiLogsLoading(false);
    }
  }, [aiTopicFilter, aiSearchTerm]);

  useEffect(() => {
    if (activeTab === 'ai_logs') {
      fetchAILogs();
    }
  }, [activeTab, fetchAILogs]);

  const handleDeleteAILog = async (id) => {
    if (!window.confirm('Xóa nhật ký câu hỏi này?')) return;
    setDeletingAILogId(id);
    try {
      await axiosClient.delete(`/ai/logs/${id}`);
      setAiLogs((prev) => prev.filter((l) => l._id !== id));
      if (selectedAILog?._id === id) setSelectedAILog(null);
      toast.success('Đã xóa nhật ký câu hỏi thành công.');
    } catch {
      toast.error('Không thể xóa nhật ký câu hỏi.');
    } finally {
      setDeletingAILogId(null);
    }
  };

  const handleClearAllAILogs = async () => {
    if (!window.confirm('CẢNH BÁO: Xóa TOÀN BỘ nhật ký câu hỏi AI của tất cả người dùng? Hành động này không thể hoàn tác.')) return;
    try {
      await axiosClient.delete('/ai/logs');
      setAiLogs([]);
      setSelectedAILog(null);
      toast.success('Đã xóa toàn bộ nhật ký câu hỏi AI.');
    } catch {
      toast.error('Không thể xóa toàn bộ nhật ký.');
    }
  };

  // Profile & user management states
  const [adminProfileForm, setAdminProfileForm] = useState({ name: user?.name || '' });
  const [adminPasswordForm, setAdminPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', phone: '', address: '' });
  const [userFormError, setUserFormError] = useState('');

  useEffect(() => {
    const syncProfileForm = setTimeout(() => {
      setAdminProfileForm({ name: user?.name || '' });
    }, 0);
    return () => clearTimeout(syncProfileForm);
  }, [user?.name]);

  // Fetch all admin data
  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardRes, ordersRes, foodsRes, usersRes, categoriesRes, notificationsRes] = await Promise.all([
        axiosClient.get('/admin/dashboard'),
        axiosClient.get('/admin/orders'),
        axiosClient.get('/admin/foods'),
        axiosClient.get('/admin/users'),
        axiosClient.get('/categories'),
        axiosClient.get('/admin/notifications'),
      ]);

      setStats(dashboardRes.data);
      setOrders(ordersRes.data);
      setFoods(foodsRes.data);
      setUsers(usersRes.data);
      setCategories(categoriesRes.data);
      setNotifications(notificationsRes.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tải dữ liệu quản trị.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    const loadTimer = setTimeout(() => {
      fetchAdminData();
    }, 0);
    return () => clearTimeout(loadTimer);
  }, [user, fetchAdminData]);

  // Socket.IO real-time sync
  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const baseUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace('/api', '')
      : 'http://localhost:5000';
    const socket = io(baseUrl);

    socket.on('newOrder', (order) => {
      setOrders((prev) => [order, ...prev]);
      setStats((prev) => (prev ? { ...prev, totalOrders: prev.totalOrders + 1 } : prev));
      toast.info(`🔔 Đơn hàng mới: #${order._id?.slice(-6)?.toUpperCase()}`);
    });

    socket.on('newNotification', (notification) => {
      setNotifications((prev) => [notification, ...prev]);
    });

    socket.on('foodAdded', (food) => {
      setFoods((prev) => [food, ...prev]);
    });

    socket.on('foodUpdated', (updatedFood) => {
      setFoods((prev) => prev.map((f) => (f._id === updatedFood._id ? updatedFood : f)));
    });

    socket.on('foodDeleted', (foodId) => {
      setFoods((prev) => prev.filter((f) => f._id !== foodId));
    });

    socket.on('categoryAdded', (category) => {
      setCategories((prev) => [...prev, category]);
    });

    socket.on('orderUpdated', (updatedOrder) => {
      setOrders((prev) => prev.map((o) => (o._id === updatedOrder._id ? updatedOrder : o)));
      setSelectedOrder((current) => (current?._id === updatedOrder._id ? updatedOrder : current));
    });

    socket.on('notificationRead', (notificationId) => {
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const unreadNotifications = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);
  const pendingOrdersCount = useMemo(() => orders.filter((o) => o.orderStatus === 'pending').length, [orders]);

  const handleMarkNotificationAsRead = async (id) => {
    try {
      const { data } = await axiosClient.put(`/admin/notifications/${id}/read`);
      setNotifications((current) => current.map((n) => (n._id === id ? data : n)));
    } catch (error) {
      console.error('Lỗi khi đánh dấu đã đọc:', error);
    }
  };

  const handleMarkAllNotificationsAsRead = async () => {
    try {
      await Promise.all(
        notifications.filter((n) => !n.isRead).map((n) => axiosClient.put(`/admin/notifications/${n._id}/read`))
      );
      setNotifications((current) => current.map((n) => ({ ...n, isRead: true })));
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc');
    } catch {
      toast.error('Không thể cập nhật thông báo.');
    }
  };

  const getNotificationFoodId = (notification) => {
    if (!notification?.food) return '';
    return typeof notification.food === 'string' ? notification.food : notification.food._id || '';
  };

  const handleOpenNotification = async (notification) => {
    if (!notification.isRead) {
      await handleMarkNotificationAsRead(notification._id);
    }
    const foodId = getNotificationFoodId(notification);
    if (foodId) {
      navigate(`/food/${foodId}`);
    }
  };

  // Operational metrics
  const revenueToday = useMemo(() => {
    const today = new Date().toDateString();
    return orders
      .filter(
        (order) =>
          order.paymentStatus === 'paid' &&
          order.orderStatus !== 'cancelled' &&
          new Date(order.createdAt).toDateString() === today
      )
      .reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  }, [orders]);

  const adminMetrics = useMemo(() => {
    const activeOrders = orders.filter((order) => !['completed', 'cancelled'].includes(order.orderStatus)).length;
    const shippingOrders = orders.filter((order) => order.orderStatus === 'shipping').length;
    const hiddenFoods = foods.filter((food) => food.isAvailable === false).length;
    const paidOrders = orders.filter((order) => order.paymentStatus === 'paid').length;
    const averageOrder = paidOrders ? Math.round((stats?.totalRevenue || 0) / paidOrders) : 0;

    return { activeOrders, shippingOrders, hiddenFoods, averageOrder, paidOrders };
  }, [foods, orders, stats]);

  // Revenue grouped calculation (for high-contrast data table breakdown)
  const revenueStats = useMemo(() => {
    const groups = {};
    orders
      .filter((o) => o.paymentStatus === 'paid' && o.orderStatus !== 'cancelled')
      .forEach((order) => {
        const dateObj = new Date(order.createdAt);
        const orderYear = dateObj.getFullYear().toString();
        const monthNum = dateObj.getMonth() + 1;
        const dayNum = dateObj.getDate();
        const orderMonth = `${orderYear}-${String(monthNum).padStart(2, '0')}`;
        const orderDate = `${orderYear}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

        let groupLabel, sortKey;

        if (revenueFilterType === 'year') {
          if (orderYear !== revenueFilterYear) return;
          groupLabel = `Tháng ${monthNum}/${orderYear}`;
          sortKey = orderMonth;
        } else if (revenueFilterType === 'month') {
          if (orderMonth !== revenueFilterMonth) return;
          groupLabel = dateObj.toLocaleDateString('vi-VN');
          sortKey = orderDate;
        } else {
          if (orderDate !== revenueFilterDate) return;
          groupLabel = dateObj.toLocaleDateString('vi-VN');
          sortKey = orderDate;
        }

        if (!groups[sortKey]) groups[sortKey] = { label: groupLabel, sortKey, revenue: 0, orders: 0, orderList: [] };
        groups[sortKey].revenue += order.totalAmount || 0;
        groups[sortKey].orders += 1;
        groups[sortKey].orderList.push(order);
      });
    return Object.values(groups).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [orders, revenueFilterType, revenueFilterDate, revenueFilterMonth, revenueFilterYear]);

  // Detailed list of paid orders in the selected period
  const periodPaidOrders = useMemo(() => {
    return orders
      .filter((o) => o.paymentStatus === 'paid' && o.orderStatus !== 'cancelled')
      .filter((order) => {
        const dateObj = new Date(order.createdAt);
        const orderYear = dateObj.getFullYear().toString();
        const monthNum = dateObj.getMonth() + 1;
        const dayNum = dateObj.getDate();
        const orderMonth = `${orderYear}-${String(monthNum).padStart(2, '0')}`;
        const orderDate = `${orderYear}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

        if (revenueFilterType === 'year') return orderYear === revenueFilterYear;
        if (revenueFilterType === 'month') return orderMonth === revenueFilterMonth;
        return orderDate === revenueFilterDate;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, revenueFilterType, revenueFilterDate, revenueFilterMonth, revenueFilterYear]);

  // Top selling foods
  const topSellingFoods = useMemo(() => {
    const counts = {};
    orders.forEach((order) => {
      if (order.orderStatus !== 'cancelled') {
        order.items?.forEach((item) => {
          counts[item.food] = (counts[item.food] || 0) + (item.quantity || 1);
        });
      }
    });

    return [...foods]
      .map((food) => ({
        ...food,
        computedSoldCount: counts[food._id] || 0,
      }))
      .sort((a, b) => b.computedSoldCount - a.computedSoldCount)
      .slice(0, 5);
  }, [foods, orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    const term = orderSearchTerm.toLowerCase().trim();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.orderStatus === statusFilter;
      const searchable = `${order._id} ${order.user?.name || ''} ${order.email || ''} ${order.phone || ''}`.toLowerCase();
      return matchesStatus && searchable.includes(term);
    });
  }, [orders, orderSearchTerm, statusFilter]);

  // Order counts per status
  const orderStatusCounts = useMemo(() => {
    const counts = { all: orders.length, pending: 0, confirmed: 0, preparing: 0, shipping: 0, completed: 0, cancelled: 0 };
    orders.forEach((o) => {
      if (counts[o.orderStatus] !== undefined) counts[o.orderStatus] += 1;
    });
    return counts;
  }, [orders]);

  // Filtered foods
  const filteredFoods = useMemo(() => {
    const term = foodSearchTerm.toLowerCase().trim();
    return foods.filter((food) => {
      const categoryName = food.category?.name || '';
      const categoryId = food.category?._id || food.category || 'uncategorized';
      const matchesCategory = selectedCategory === 'all' || categoryId === selectedCategory;
      const matchesAvailability =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'hidden' && food.isAvailable === false) ||
        (availabilityFilter === 'active' && food.isAvailable !== false);
      const matchesSearch = `${food.name} ${categoryName} ${food.description || ''}`.toLowerCase().includes(term);
      return matchesCategory && matchesAvailability && matchesSearch;
    });
  }, [foods, foodSearchTerm, selectedCategory, availabilityFilter]);

  // Category summaries
  const categorySummaries = useMemo(() => {
    const uncategorized = { _id: 'uncategorized', name: 'Chưa phân loại', count: 0, active: 0, hidden: 0 };
    const summaries = categories.map((category) => ({
      _id: category._id,
      name: category.name,
      count: 0,
      active: 0,
      hidden: 0,
    }));
    const byId = new Map(summaries.map((category) => [category._id, category]));

    foods.forEach((food) => {
      const categoryId = food.category?._id || food.category || 'uncategorized';
      const summary = byId.get(categoryId) || uncategorized;
      summary.count += 1;
      if (food.isAvailable === false) {
        summary.hidden += 1;
      } else {
        summary.active += 1;
      }
    });

    return [
      {
        _id: 'all',
        name: 'Tất cả',
        count: foods.length,
        active: foods.filter((food) => food.isAvailable !== false).length,
        hidden: foods.filter((food) => food.isAvailable === false).length,
      },
      ...summaries,
      ...(uncategorized.count ? [uncategorized] : []),
    ];
  }, [categories, foods]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const nameTerm = customerNameFilter.toLowerCase().trim();
    return users.filter((item) => {
      const matchesName = (item.name || '').toLowerCase().includes(nameTerm) ||
        (item.email || '').toLowerCase().includes(nameTerm) ||
        (item.phone || '').includes(nameTerm);
      return matchesName;
    });
  }, [users, customerNameFilter]);

  // Modal open/close helpers
  const openFoodForm = (food = null) => {
    setEditingFood(food || {});
    setFoodForm(
      food
        ? {
            name: food.name || '',
            price: food.price ?? '',
            category: food.category?._id || food.category || categories[0]?._id || '',
            description: food.description || '',
            image: food.images?.[0] || '',
            ingredients: (food.ingredients || []).join(', '),
            calories: food.nutrition?.calories ?? '',
            protein: food.nutrition?.protein ?? '',
            carbs: food.nutrition?.carbs ?? '',
            fat: food.nutrition?.fat ?? '',
            healthTags: (food.healthTags || []).join(', '),
            suitableFor: (food.suitableFor || []).join(', '),
            warningFor: (food.warningFor || []).join(', '),
            isAvailable: food.isAvailable !== false,
            isVegetarian: Boolean(food.isVegetarian),
          }
        : { ...emptyFoodForm, category: categories[0]?._id || '' }
    );
  };

  const closeFoodForm = () => {
    setEditingFood(null);
    setFoodForm(emptyFoodForm);
  };

  // Client-side image compression
  const compressImageClient = (file, { maxWidth = 1000, quality = 0.82 } = {}) =>
    new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });

  const handleFoodImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFoodImageUploading(true);
    try {
      const compressed = await compressImageClient(file, { maxWidth: 1000, quality: 0.82 });
      const formData = new FormData();
      formData.append('image', compressed);

      const { data } = await axiosClient.post('/upload/food-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFoodForm((prev) => ({ ...prev, image: data.url }));
      toast.success('Đã tải ảnh lên thành công!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tải ảnh lên.');
    } finally {
      setFoodImageUploading(false);
      event.target.value = '';
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleAdminAvatarChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setAvatarUploading(true);
    try {
      const compressed = await compressImageClient(file, { maxWidth: 400, quality: 0.85 });
      const formData = new FormData();
      formData.append('image', compressed);

      const { data } = await axiosClient.post('/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { data: updatedProfile } = await axiosClient.put('/auth/profile', { avatar: data.url });
      updateUser(updatedProfile);
      toast.success('Đã cập nhật avatar thành công!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể cập nhật avatar.');
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  };

  const handleAdminProfileUpdate = async (event) => {
    event.preventDefault();
    try {
      const { data } = await axiosClient.put('/auth/profile', {
        name: adminProfileForm.name.trim(),
      });
      updateUser(data);
      toast.success('Đã cập nhật hồ sơ cá nhân.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể cập nhật hồ sơ cá nhân.');
    }
  };

  const handleAdminPasswordChange = async (event) => {
    event.preventDefault();
    if (adminPasswordForm.newPassword !== adminPasswordForm.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }

    try {
      const { data } = await axiosClient.put('/auth/change-password', {
        currentPassword: adminPasswordForm.currentPassword,
        newPassword: adminPasswordForm.newPassword,
      });
      setAdminPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success(data.message || 'Đã thay đổi mật khẩu thành công.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể thay đổi mật khẩu.');
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const { data } = await axiosClient.put(`/admin/orders/${id}/status`, { status });
      setOrders((current) => current.map((order) => (order._id === id ? data : order)));
      setSelectedOrder((current) => (current?._id === id ? data : current));
      toast.success(`Đã cập nhật đơn hàng thành: ${statusLabels[status]}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi cập nhật đơn hàng.');
    }
  };

  const handleToggleAvailability = async (food) => {
    try {
      await axiosClient.put(`/foods/${food._id}`, { isAvailable: food.isAvailable === false ? true : false });
      setFoods((current) =>
        current.map((f) => (f._id === food._id ? { ...f, isAvailable: food.isAvailable === false ? true : false } : f))
      );
      toast.success(food.isAvailable !== false ? `Đã tạm ẩn: ${food.name}` : `Đã mở bán lại: ${food.name}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi cập nhật trạng thái món ăn.');
    }
  };

  const handleSaveFood = async (event) => {
    event.preventDefault();
    setSaving(true);

    const splitTags = (str) => str.split(',').map((s) => s.trim()).filter(Boolean);

    const payload = {
      name: foodForm.name.trim(),
      price: Number(foodForm.price) || 0,
      category: foodForm.category,
      description: foodForm.description.trim() || 'Đang cập nhật mô tả món ăn.',
      images: foodForm.image
        ? [foodForm.image.trim()]
        : ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop'],
      ingredients: splitTags(foodForm.ingredients),
      nutrition: {
        calories: foodForm.calories !== '' ? Number(foodForm.calories) : undefined,
        protein: foodForm.protein !== '' ? Number(foodForm.protein) : undefined,
        carbs: foodForm.carbs !== '' ? Number(foodForm.carbs) : undefined,
        fat: foodForm.fat !== '' ? Number(foodForm.fat) : undefined,
      },
      healthTags: splitTags(foodForm.healthTags),
      suitableFor: splitTags(foodForm.suitableFor),
      warningFor: splitTags(foodForm.warningFor),
      isAvailable: foodForm.isAvailable,
      isVegetarian: foodForm.isVegetarian,
    };

    try {
      if (editingFood?._id) {
        await axiosClient.put(`/foods/${editingFood._id}`, payload);
        toast.success('Đã lưu thay đổi món ăn.');
      } else {
        await axiosClient.post('/foods', payload);
        toast.success('Đã thêm món ăn mới.');
      }
      closeFoodForm();
      const { data } = await axiosClient.get('/admin/foods');
      setFoods(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu món ăn.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFood = async (id) => {
    if (!window.confirm('Ẩn món ăn này khỏi thực đơn?')) return;

    try {
      const { data } = await axiosClient.delete(`/foods/${id}`);
      setFoods((current) => current.map((food) => (food._id === id ? data.food : food)));
      toast.success('Đã ẩn món ăn khỏi thực đơn.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể ẩn món ăn.');
    }
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const { data } = await axiosClient.post('/categories', {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
      });
      setCategories((current) => [...current, data]);
      setSelectedCategory(data._id);
      setCategoryForm(emptyCategoryForm);
      setIsCategoryModalOpen(false);
      toast.success('Đã thêm danh mục mới.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể thêm danh mục.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserBlock = async (customer) => {
    const nextBlocked = !customer.isBlocked;
    const actionLabel = nextBlocked ? 'khóa' : 'mở khóa';
    if (!window.confirm(`${actionLabel} tài khoản ${customer.name}?`)) return;

    try {
      const { data } = await axiosClient.put(`/admin/users/${customer._id}/block`, {
        isBlocked: nextBlocked,
      });
      setUsers((current) => current.map((item) => (item._id === customer._id ? { ...item, ...data } : item)));
      toast.success(`Đã ${actionLabel} tài khoản ${customer.name}.`);
    } catch (error) {
      toast.error(error.response?.data?.message || `Không thể ${actionLabel} tài khoản.`);
    }
  };

  const openUserForm = (customer) => {
    setEditingUser(customer);
    setUserForm({ name: customer.name || '', phone: customer.phone || '', address: customer.address || '' });
    setUserFormError('');
  };

  const closeUserForm = () => {
    setEditingUser(null);
    setUserForm({ name: '', phone: '', address: '' });
    setUserFormError('');
  };

  const handleUpdateUserInfo = async (event) => {
    event.preventDefault();
    setUserFormError('');

    const trimmedName = userForm.name.trim();
    const trimmedPhone = userForm.phone.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setUserFormError('Tên người dùng phải có ít nhất 2 ký tự.');
      return;
    }
    if (trimmedPhone && !/^[0-9]{10,11}$/.test(trimmedPhone)) {
      setUserFormError('Số điện thoại không hợp lệ (10-11 số).');
      return;
    }

    setSaving(true);
    try {
      const { data } = await axiosClient.put(`/admin/users/${editingUser._id}`, {
        name: trimmedName,
        phone: trimmedPhone,
        address: userForm.address.trim(),
      });
      setUsers((current) => current.map((item) => (item._id === editingUser._id ? { ...item, ...data } : item)));
      toast.success(`Đã cập nhật thông tin tài khoản ${data.name}.`);
      closeUserForm();
    } catch (error) {
      setUserFormError(error.response?.data?.message || 'Không thể cập nhật thông tin.');
    } finally {
      setSaving(false);
    }
  };

  // Full-screen loading skeleton
  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[#F7F9F6] flex flex-col items-center justify-center p-6 text-[#17231D]">
        <div className="w-full max-w-md rounded-2xl border border-[#E8EEE9] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8F5EE] text-[#16845B]">
            <RefreshCw className="animate-spin" size={26} />
          </div>
          <h2 className="text-lg font-bold text-[#17231D]">Đang khởi tạo hệ thống quản trị...</h2>
          <p className="mt-1 text-xs text-[#758278]">FoodCare AI-Integrated Healthy Food Platform</p>
        </div>
      </div>
    );
  }

  // Admin access guard
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F9F6] p-6 text-[#17231D]">
        <div className="w-full max-w-md rounded-2xl border border-[#E8EEE9] bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <ShieldAlert size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#17231D]">Khu vực Quản trị</h1>
          <p className="mt-2 text-sm text-[#758278]">
            Bạn cần đăng nhập bằng tài khoản Quản trị viên để truy cập bảng điều khiển FoodCare.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => navigate('/login', { state: { from: '/admin' } })}
              className="flex-1 rounded-xl bg-[#16845B] py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#116344] transition-colors"
            >
              Đăng nhập ngay
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 rounded-xl border border-[#E8EEE9] py-2.5 px-4 text-sm font-semibold text-[#17231D] hover:bg-slate-50 transition-colors"
            >
              Về trang chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F6] text-[#17231D] font-sans antialiased flex">
      {/* ── MOBILE SIDEBAR BACKDROP ── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white border-r border-[#E8EEE9] transition-all duration-300 ease-in-out lg:static ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${sidebarCollapsed ? 'w-[76px]' : 'w-[264px]'}`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-[#E8EEE9]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src="/logo.png"
              alt="FoodCare Logo"
              className="h-10 w-10 shrink-0 object-contain drop-shadow-xs transition-transform hover:scale-105 cursor-pointer"
              onClick={() => navigate('/')}
            />
            {!sidebarCollapsed && (
              <div className="min-w-0 transition-opacity duration-200">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black tracking-tight text-[#17231D]">FoodCare</span>
                  <span className="rounded-md bg-[#E8F5EE] px-1.5 py-0.5 text-[10px] font-bold text-[#16845B]">
                    PRO
                  </span>
                </div>
                <p className="text-[11px] font-medium text-[#758278] truncate">Hệ thống quản trị</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-[#758278] hover:bg-[#F7F9F6] hover:text-[#17231D] transition-colors"
            title={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>

          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-[#758278] hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className={`px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#758278] ${sidebarCollapsed ? 'hidden' : 'block'}`}>
            Quản trị chính
          </div>
          {tabs.slice(0, 5).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileSidebarOpen(false);
                }}
                title={sidebarCollapsed ? tab.label : undefined}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#E8F5EE] text-[#116344] font-semibold shadow-xs'
                    : 'text-[#758278] hover:bg-[#F7F9F6] hover:text-[#17231D]'
                } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  size={19}
                  className={`shrink-0 transition-transform ${isActive ? 'text-[#16845B]' : 'text-[#758278] group-hover:text-[#17231D]'}`}
                />
                {!sidebarCollapsed && <span className="truncate">{tab.label}</span>}

                {/* Badge counters */}
                {tab.id === 'orders' && pendingOrdersCount > 0 && (
                  <span
                    className={`flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white shadow-xs ${
                      sidebarCollapsed ? 'absolute top-1 right-1 h-2.5 w-2.5 min-w-0 p-0 ring-2 ring-white' : 'ml-auto'
                    }`}
                  >
                    {!sidebarCollapsed && pendingOrdersCount}
                  </span>
                )}
              </button>
            );
          })}

          <div className={`pt-4 px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#758278] ${sidebarCollapsed ? 'hidden' : 'block'}`}>
            Cài đặt & Tiện ích
          </div>
          {tabs.slice(5).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'public_menu') {
                    navigate('/');
                  } else {
                    setActiveTab(tab.id);
                  }
                  setMobileSidebarOpen(false);
                }}
                title={sidebarCollapsed ? tab.label : undefined}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#E8F5EE] text-[#116344] font-semibold'
                    : 'text-[#758278] hover:bg-[#F7F9F6] hover:text-[#17231D]'
                } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  size={19}
                  className={`shrink-0 transition-transform ${isActive ? 'text-[#16845B]' : 'text-[#758278] group-hover:text-[#17231D]'}`}
                />
                {!sidebarCollapsed && <span className="truncate">{tab.label}</span>}

                {tab.id === 'notifications' && unreadNotifications > 0 && (
                  <span
                    className={`flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-xs ${
                      sidebarCollapsed ? 'absolute top-1 right-1 h-2.5 w-2.5 min-w-0 p-0 ring-2 ring-white' : 'ml-auto'
                    }`}
                  >
                    {!sidebarCollapsed && unreadNotifications}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer: Admin Profile */}
        <div className="p-3 border-t border-[#E8EEE9]">
          <div
            className={`flex items-center gap-3 p-2 rounded-xl bg-[#F7F9F6] border border-[#E8EEE9]/60 ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white bg-slate-200 shadow-xs">
              <img
                src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'}
                alt={user?.name || 'Admin'}
                className="h-full w-full object-cover"
              />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[#17231D]">{user?.name || 'Quản trị viên'}</p>
                <p className="truncate text-[10px] text-[#758278]">admin@foodcare.vn</p>
              </div>
            )}
            {!sidebarCollapsed && (
              <button
                onClick={handleLogout}
                title="Đăng xuất"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#758278] hover:bg-white hover:text-rose-600 transition-colors shadow-2xs"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E8EEE9] bg-white/95 backdrop-blur-md px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-[#E8EEE9] text-[#758278] hover:bg-slate-50"
            >
              <Menu size={18} />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs font-medium text-[#758278]">
              <span className="hidden sm:inline">Hệ thống</span>
              <span className="hidden sm:inline">/</span>
              <span className="text-[#17231D] font-semibold capitalize">
                {tabs.find((t) => t.id === activeTab)?.label || 'Bảng điều khiển'}
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {/* Real-time Indicator */}
            <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600"></span>
              </span>
              <span>Đồng bộ thời gian thực</span>
            </div>

            {/* Refresh Data Button */}
            <button
              onClick={fetchAdminData}
              disabled={loading}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-[#E8EEE9] bg-white px-3 text-xs font-semibold text-[#17231D] hover:bg-[#F7F9F6] active:scale-95 transition-all shadow-2xs"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-[#16845B]' : 'text-[#758278]'} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => setActiveTab('notifications')}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#E8EEE9] bg-white text-[#758278] hover:text-[#17231D] hover:bg-[#F7F9F6] transition-colors shadow-2xs"
              title="Thông báo"
            >
              <Bell size={17} />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                  {unreadNotifications}
                </span>
              )}
            </button>

            {/* Admin Avatar Quick Action */}
            <button
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2 pl-2 border-l border-[#E8EEE9]"
            >
              <div className="h-8 w-8 rounded-lg overflow-hidden border border-[#E8EEE9] bg-slate-100">
                <img
                  src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'}
                  alt={user?.name || 'Admin'}
                  className="h-full w-full object-cover"
                />
              </div>
            </button>
          </div>
        </header>

        {/* Tab Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* ══════════════════════════════════════════════════════════════
              TAB 1: TỔNG QUAN (DASHBOARD TRỌNG TÂM - KHÔNG BIỂU ĐỒ)
              ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 5.1 Welcome Section */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#E8EEE9] bg-white p-5 sm:p-6 shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D]">
                      {getTimeGreeting()}, {user?.name?.split(' ')?.[0] || 'Admin'} 👋
                    </h1>
                  </div>
                  <p className="mt-1 text-sm text-[#758278]">
                    Đây là tình hình hoạt động của hệ thống FoodCare hôm nay.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <div className="inline-flex rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] p-1 text-xs font-semibold text-[#758278]">
                    <button
                      onClick={() => setOverviewTimeRange('today')}
                      className={`rounded-lg px-3 py-1.5 transition-all ${
                        overviewTimeRange === 'today'
                          ? 'bg-white text-[#16845B] shadow-2xs font-bold'
                          : 'hover:text-[#17231D]'
                      }`}
                    >
                      Hôm nay
                    </button>
                    <button
                      onClick={() => setOverviewTimeRange('week')}
                      className={`rounded-lg px-3 py-1.5 transition-all ${
                        overviewTimeRange === 'week'
                          ? 'bg-white text-[#16845B] shadow-2xs font-bold'
                          : 'hover:text-[#17231D]'
                      }`}
                    >
                      7 ngày qua
                    </button>
                    <button
                      onClick={() => setOverviewTimeRange('month')}
                      className={`rounded-lg px-3 py-1.5 transition-all ${
                        overviewTimeRange === 'month'
                          ? 'bg-white text-[#16845B] shadow-2xs font-bold'
                          : 'hover:text-[#17231D]'
                      }`}
                    >
                      Tháng này
                    </button>
                  </div>
                </div>
              </div>

              {/* 5.2 KPI Cards (4 thẻ thống kê đồng bộ) */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label="Tổng doanh thu"
                  value={formatCurrency(stats?.totalRevenue || 0)}
                  subtext={`Hôm nay: ${formatCurrency(revenueToday)}`}
                  icon={DollarSign}
                  badge="Ghi nhận"
                  tone="green"
                />
                <KpiCard
                  label="Tổng đơn hàng"
                  value={(stats?.totalOrders || 0).toLocaleString('vi-VN')}
                  subtext={`${adminMetrics.activeOrders} đơn đang xử lý`}
                  icon={ClipboardList}
                  badge={pendingOrdersCount > 0 ? `${pendingOrdersCount} chờ duyệt` : 'Đang hoạt động'}
                  tone="orange"
                />
                <KpiCard
                  label="Khách hàng"
                  value={(stats?.totalUsers || 0).toLocaleString('vi-VN')}
                  subtext={`${adminMetrics.paidOrders} đơn đã hoàn tất`}
                  icon={Users}
                  badge="Người dùng"
                  tone="blue"
                />
                <KpiCard
                  label="Món trong thực đơn"
                  value={(stats?.totalFoods || 0).toLocaleString('vi-VN')}
                  subtext={`${adminMetrics.hiddenFoods} món đang tạm ẩn`}
                  icon={Package}
                  badge={`${categories.length} danh mục`}
                  tone="purple"
                />
              </div>

              {/* 5.4 Operational Overview (Thay thế hoàn toàn biểu đồ) */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <OperationalTile
                  icon={Clock}
                  label="Đơn chờ xác nhận"
                  value={pendingOrdersCount}
                  unit="đơn"
                  tone="amber"
                  actionText="Xử lý ngay"
                  onClick={() => {
                    setStatusFilter('pending');
                    setActiveTab('orders');
                  }}
                />
                <OperationalTile
                  icon={Truck}
                  label="Đơn đang vận chuyển"
                  value={adminMetrics.shippingOrders}
                  unit="đơn"
                  tone="cyan"
                  actionText="Kiểm tra"
                  onClick={() => {
                    setStatusFilter('shipping');
                    setActiveTab('orders');
                  }}
                />
                <OperationalTile
                  icon={EyeOff}
                  label="Món tạm ngưng bán"
                  value={adminMetrics.hiddenFoods}
                  unit="món"
                  tone="rose"
                  actionText="Quản lý"
                  onClick={() => {
                    setAvailabilityFilter('hidden');
                    setActiveTab('foods');
                  }}
                />
                <OperationalTile
                  icon={DollarSign}
                  label="Giá trị đơn trung bình"
                  value={formatCurrency(adminMetrics.averageOrder)}
                  unit=""
                  tone="emerald"
                  actionText="Chi tiết"
                  onClick={() => setActiveTab('revenue')}
                />
              </div>

              {/* 5.3 Recent Orders & 5.6 Top Selling Foods (Grid Layout) */}
              <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                {/* Đơn hàng mới nhất */}
                <div className="rounded-2xl border border-[#E8EEE9] bg-white shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#E8EEE9] px-6 py-4">
                    <div>
                      <h3 className="font-bold text-base text-[#17231D]">Đơn hàng mới nhất</h3>
                      <p className="text-xs text-[#758278]">Cập nhật theo thời gian thực</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('orders')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#16845B] hover:text-[#116344] transition-colors"
                    >
                      Xem tất cả ({orders.length}) <ChevronRight size={14} />
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-[#E8EEE9] bg-[#F7F9F6] text-[11px] font-bold uppercase tracking-wider text-[#758278]">
                        <tr>
                          <th className="px-5 py-3">Mã đơn</th>
                          <th className="px-5 py-3">Khách hàng</th>
                          <th className="px-5 py-3">Thời gian</th>
                          <th className="px-5 py-3 text-right">Tổng tiền</th>
                          <th className="px-5 py-3 text-center">Trạng thái</th>
                          <th className="px-5 py-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8EEE9]/60">
                        {(stats?.recentOrders || orders.slice(0, 5)).map((order) => (
                          <tr key={order._id} className="hover:bg-[#F7F9F6]/60 transition-colors">
                            <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#17231D]">
                              #{order._id?.slice(-6)?.toUpperCase()}
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-xs text-[#17231D]">{order.user?.name || 'Khách'}</p>
                              <p className="text-[11px] text-[#758278]">{order.phone || '—'}</p>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-[#758278]">
                              {formatDate(order.createdAt)}
                            </td>
                            <td className="px-5 py-3.5 text-right font-bold text-xs text-[#17231D]">
                              {formatCurrency(order.totalAmount)}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <StatusBadge status={order.orderStatus} />
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => setSelectedOrder(order)}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E8EEE9] px-2.5 text-xs font-semibold text-[#17231D] hover:bg-[#E8F5EE] hover:text-[#116344] transition-colors"
                              >
                                <Eye size={13} /> Xem
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top món bán chạy nhất (Clean List - NO CHARTS) */}
                <div className="rounded-2xl border border-[#E8EEE9] bg-white shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#E8EEE9] px-6 py-4">
                    <div>
                      <h3 className="font-bold text-base text-[#17231D]">Món bán chạy</h3>
                      <p className="text-xs text-[#758278]">Xếp hạng theo số lượng đã bán</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('foods')}
                      className="text-xs font-bold text-[#16845B] hover:text-[#116344]"
                    >
                      Thực đơn
                    </button>
                  </div>

                  <div className="divide-y divide-[#E8EEE9]/60 p-2">
                    {topSellingFoods.length > 0 ? (
                      topSellingFoods.map((food, index) => (
                        <div key={food._id} className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-[#F7F9F6] transition-colors">
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                              index === 0
                                ? 'bg-amber-100 text-amber-800'
                                : index === 1
                                ? 'bg-slate-200 text-slate-700'
                                : index === 2
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-[#F7F9F6] text-[#758278]'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <img
                            src={food.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200&auto=format&fit=crop'}
                            alt={food.name}
                            className="h-11 w-11 shrink-0 rounded-xl object-cover border border-[#E8EEE9]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-[#17231D]">{food.name}</p>
                            <p className="text-[11px] text-[#758278]">{food.category?.name || 'Thực đơn'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-[#16845B]">{food.computedSoldCount} phần</p>
                            <p className="text-[10px] text-[#758278]">{formatCurrency(food.price)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="py-8 text-center text-xs text-[#758278]">Chưa có dữ liệu thống kê món bán chạy.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 2: QUẢN LÝ ĐƠN HÀNG
              ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'orders' && (
            <div className="space-y-5">
              {/* Header & Mini Ribbon */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#17231D]">Quản lý đơn hàng</h1>
                  <p className="text-xs text-[#758278]">Theo dõi tiến độ, trạng thái thanh toán và thông tin giao nhận</p>
                </div>
              </div>

              {/* Status Filter Tabs / Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                {[
                  { key: 'all', label: 'Tất cả đơn' },
                  { key: 'pending', label: 'Chờ xác nhận' },
                  { key: 'confirmed', label: 'Đã xác nhận' },
                  { key: 'preparing', label: 'Đang chuẩn bị' },
                  { key: 'shipping', label: 'Đang giao' },
                  { key: 'completed', label: 'Hoàn thành' },
                  { key: 'cancelled', label: 'Đã hủy' },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setStatusFilter(s.key)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 font-semibold transition-all ${
                      statusFilter === s.key
                        ? 'bg-[#16845B] text-white shadow-xs'
                        : 'bg-white border border-[#E8EEE9] text-[#758278] hover:text-[#17231D] hover:bg-[#F7F9F6]'
                    }`}
                  >
                    <span>{s.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        statusFilter === s.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#758278]'
                      }`}
                    >
                      {orderStatusCounts[s.key] || 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search Bar & Order Table */}
              <div className="rounded-2xl border border-[#E8EEE9] bg-white shadow-xs overflow-hidden">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E8EEE9]">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#758278]" size={16} />
                    <input
                      type="text"
                      placeholder="Tìm theo mã đơn (#...), tên khách hàng, SĐT..."
                      value={orderSearchTerm}
                      onChange={(e) => setOrderSearchTerm(e.target.value)}
                      className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] pl-10 pr-4 text-xs font-medium text-[#17231D] outline-none transition focus:border-[#16845B] focus:bg-white"
                    />
                  </div>
                  <div className="text-xs font-medium text-[#758278]">
                    Hiển thị <span className="font-bold text-[#17231D]">{filteredOrders.length}</span> đơn hàng
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[#E8EEE9] bg-[#F7F9F6] text-[11px] font-bold uppercase tracking-wider text-[#758278]">
                      <tr>
                        <th className="px-5 py-3.5">Mã đơn</th>
                        <th className="px-5 py-3.5">Khách hàng</th>
                        <th className="px-5 py-3.5">Liên hệ</th>
                        <th className="px-5 py-3.5">Ngày đặt</th>
                        <th className="px-5 py-3.5">Thanh toán</th>
                        <th className="px-5 py-3.5 text-right">Tổng tiền</th>
                        <th className="px-5 py-3.5">Trạng thái</th>
                        <th className="px-5 py-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8EEE9]/60">
                      {filteredOrders.length > 0 ? (
                        filteredOrders.map((order) => (
                          <tr key={order._id} className="hover:bg-[#F7F9F6]/60 transition-colors">
                            <td className="px-5 py-4 font-mono text-xs font-bold text-[#17231D]">
                              #{order._id?.slice(-8)?.toUpperCase()}
                            </td>
                            <td className="px-5 py-4">
                              <p className="font-bold text-xs text-[#17231D]">{order.user?.name || 'Khách'}</p>
                              <p className="text-[11px] text-[#758278] truncate max-w-[160px]">
                                {order.shippingAddress || 'Nhận tại cửa hàng'}
                              </p>
                            </td>
                            <td className="px-5 py-4 text-xs text-[#758278]">
                              <p className="font-semibold text-[#17231D]">{order.phone || '—'}</p>
                              <p className="text-[11px] text-[#758278] truncate max-w-[140px]">{order.email}</p>
                            </td>
                            <td className="px-5 py-4 text-xs text-[#758278] whitespace-nowrap">
                              {formatDate(order.createdAt)}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                  order.paymentStatus === 'paid'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chờ thanh toán'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right font-bold text-xs text-[#17231D] whitespace-nowrap">
                              {formatCurrency(order.totalAmount)}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              {['completed', 'cancelled'].includes(order.orderStatus) ? (
                                <StatusBadge status={order.orderStatus} />
                              ) : (
                                <select
                                  value={order.orderStatus}
                                  onChange={(e) => handleUpdateStatus(order._id, e.target.value)}
                                  className="h-8 rounded-lg border border-[#E8EEE9] bg-white px-2.5 text-xs font-semibold text-[#17231D] outline-none hover:border-[#16845B] focus:border-[#16845B]"
                                >
                                  {Object.entries(statusLabels).map(([val, label]) => (
                                    <option key={val} value={val}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => setSelectedOrder(order)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E8EEE9] px-3 text-xs font-semibold text-[#17231D] hover:bg-[#E8F5EE] hover:text-[#116344] transition-colors"
                              >
                                <Eye size={13} /> Chi tiết
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="p-12 text-center">
                            <ClipboardList className="mx-auto mb-3 text-[#758278]/40" size={32} />
                            <p className="font-bold text-sm text-[#17231D]">Không tìm thấy đơn hàng nào</p>
                            <p className="mt-1 text-xs text-[#758278]">Thử đổi từ khóa tìm kiếm hoặc bỏ chọn bộ lọc trạng thái.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 3: QUẢN LÝ THỰC ĐƠN
              ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'foods' && (
            <div className="space-y-5">
              {/* Header & Main Actions */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#17231D]">Quản lý thực đơn</h1>
                  <p className="text-xs text-[#758278]">Danh mục, món ăn healthy, giá bán và thành phần dinh dưỡng AI</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E8EEE9] bg-white px-4 text-xs font-semibold text-[#17231D] hover:bg-[#F7F9F6] transition-colors shadow-2xs"
                  >
                    <Plus size={15} /> Danh mục
                  </button>
                  <button
                    onClick={() => openFoodForm()}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#16845B] px-4 text-xs font-semibold text-white hover:bg-[#116344] transition-colors shadow-xs"
                  >
                    <Plus size={15} /> Thêm món mới
                  </button>
                </div>
              </div>

              {/* Category Pills Ribbon */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                {categorySummaries.map((cat) => (
                  <button
                    key={cat._id}
                    onClick={() => setSelectedCategory(cat._id)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 font-semibold transition-all ${
                      selectedCategory === cat._id
                        ? 'bg-[#16845B] text-white shadow-xs'
                        : 'bg-white border border-[#E8EEE9] text-[#758278] hover:text-[#17231D] hover:bg-[#F7F9F6]'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        selectedCategory === cat._id ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#758278]'
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#E8EEE9] bg-white p-4 shadow-xs">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#758278]" size={16} />
                  <input
                    type="text"
                    placeholder="Tìm tên món, nguyên liệu, mô tả..."
                    value={foodSearchTerm}
                    onChange={(e) => setFoodSearchTerm(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] pl-10 pr-4 text-xs font-medium text-[#17231D] outline-none transition focus:border-[#16845B] focus:bg-white"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={availabilityFilter}
                    onChange={(e) => setAvailabilityFilter(e.target.value)}
                    className="h-10 rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3 text-xs font-semibold text-[#17231D] outline-none focus:border-[#16845B]"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="active">Đang bán</option>
                    <option value="hidden">Tạm ngưng bán</option>
                  </select>
                  <span className="text-xs text-[#758278]">
                    Hiển thị <span className="font-bold text-[#17231D]">{filteredFoods.length}</span> món
                  </span>
                </div>
              </div>

              {/* Foods Grid */}
              {filteredFoods.length > 0 ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredFoods.map((food) => (
                    <div
                      key={food._id}
                      className="group rounded-2xl border border-[#E8EEE9] bg-white p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Food Image Container */}
                        <div className="relative h-44 w-full overflow-hidden rounded-xl bg-slate-100 mb-3 border border-[#E8EEE9]/60">
                          <img
                            src={food.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop'}
                            alt={food.name}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-2 left-2 flex items-center gap-1.5">
                            <span className="rounded-lg bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white">
                              {food.category?.name || 'Món ăn'}
                            </span>
                            {food.isVegetarian && (
                              <span className="rounded-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                                🌱 Chay
                              </span>
                            )}
                          </div>
                          <span
                            className={`absolute top-2 right-2 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-xs ${
                              food.isAvailable !== false ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                            }`}
                          >
                            {food.isAvailable !== false ? 'Đang bán' : 'Tạm ẩn'}
                          </span>
                        </div>

                        {/* Title & Price */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h3 className="font-bold text-sm text-[#17231D] line-clamp-1">{food.name}</h3>
                          <span className="shrink-0 font-bold text-sm text-[#16845B]">{formatCurrency(food.price)}</span>
                        </div>

                        <p className="text-xs text-[#758278] line-clamp-2 mb-3">
                          {food.description || 'Chưa có thông tin mô tả chi tiết.'}
                        </p>

                        {/* Nutritional Highlights */}
                        {food.nutrition && (
                          <div className="grid grid-cols-4 gap-1 rounded-xl bg-[#F7F9F6] p-2 text-center text-[10px] font-semibold text-[#758278] mb-4">
                            <div>
                              <p className="text-[#17231D] font-bold">{food.nutrition.calories || '—'}</p>
                              <p className="text-[9px]">Kcal</p>
                            </div>
                            <div>
                              <p className="text-[#17231D] font-bold">{food.nutrition.protein || '—'}g</p>
                              <p className="text-[9px]">Đạm</p>
                            </div>
                            <div>
                              <p className="text-[#17231D] font-bold">{food.nutrition.carbs || '—'}g</p>
                              <p className="text-[9px]">Carb</p>
                            </div>
                            <div>
                              <p className="text-[#17231D] font-bold">{food.nutrition.fat || '—'}g</p>
                              <p className="text-[9px]">Béo</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-3 border-t border-[#E8EEE9]">
                        <button
                          onClick={() => handleToggleAvailability(food)}
                          title={food.isAvailable !== false ? 'Tạm ngưng bán món này' : 'Mở bán lại'}
                          className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                            food.isAvailable !== false
                              ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {food.isAvailable !== false ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <button
                          onClick={() => openFoodForm(food)}
                          className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#E8EEE9] text-xs font-semibold text-[#17231D] hover:bg-[#E8F5EE] hover:text-[#116344] transition-colors"
                        >
                          <Edit3 size={14} /> Chỉnh sửa
                        </button>
                        <button
                          onClick={() => handleDeleteFood(food._id)}
                          title="Ẩn món ăn"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#E8EEE9] bg-white p-12 text-center">
                  <Package className="mx-auto mb-3 text-[#758278]/40" size={36} />
                  <p className="font-bold text-sm text-[#17231D]">Không tìm thấy món ăn nào</p>
                  <p className="mt-1 text-xs text-[#758278]">Thử đổi danh mục lọc hoặc thêm món mới vào thực đơn.</p>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 4: QUẢN LÝ KHÁCH HÀNG
              ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'customers' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#17231D]">Quản lý khách hàng</h1>
                  <p className="text-xs text-[#758278]">Hồ sơ thành viên, tổng chi tiêu và trạng thái tài khoản</p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E8EEE9] bg-white shadow-xs overflow-hidden">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E8EEE9]">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#758278]" size={16} />
                    <input
                      value={customerNameFilter}
                      onChange={(e) => setCustomerNameFilter(e.target.value)}
                      placeholder="Tìm theo tên khách, email, số điện thoại..."
                      className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] pl-10 pr-4 text-xs font-medium text-[#17231D] outline-none transition focus:border-[#16845B] focus:bg-white"
                    />
                  </div>
                  <div className="text-xs font-medium text-[#758278]">
                    Hiển thị <span className="font-bold text-[#17231D]">{filteredUsers.length}</span> người dùng
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[#E8EEE9] bg-[#F7F9F6] text-[11px] font-bold uppercase tracking-wider text-[#758278]">
                      <tr>
                        <th className="px-5 py-3.5">Khách hàng</th>
                        <th className="px-5 py-3.5">Liên hệ</th>
                        <th className="px-5 py-3.5">Hạng thành viên</th>
                        <th className="px-5 py-3.5 text-right">Tổng chi tiêu</th>
                        <th className="px-5 py-3.5">Ngày tham gia</th>
                        <th className="px-5 py-3.5 text-center">Trạng thái</th>
                        <th className="px-5 py-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8EEE9]/60">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((item) => (
                          <tr key={item._id} className="hover:bg-[#F7F9F6]/60 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E8F5EE] text-xs font-bold text-[#16845B]">
                                  {item.name?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                <div>
                                  <p className="font-bold text-xs text-[#17231D]">{item.name}</p>
                                  <p className="text-[11px] text-[#758278]">{item.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-xs text-[#758278]">
                              <p className="font-medium text-[#17231D]">{item.email}</p>
                              <p className="text-[11px]">{item.phone || 'Chưa cập nhật SĐT'}</p>
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                  item.tier === 'Kim Cương'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : item.tier === 'Vàng'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                <Award size={12} /> {item.tier || 'Thành viên'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right font-bold text-xs text-[#17231D]">
                              {formatCurrency(item.totalSpent || 0)}
                            </td>
                            <td className="px-5 py-4 text-xs text-[#758278] whitespace-nowrap">
                              {formatDate(item.createdAt)}
                            </td>
                            <td className="px-5 py-4 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                  item.isBlocked
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {item.isBlocked ? <X size={12} /> : <Check size={12} />}
                                {item.isBlocked ? 'Đã khóa' : 'Hoạt động'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openUserForm(item)}
                                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E8EEE9] px-2.5 text-xs font-semibold text-[#17231D] hover:bg-[#E8F5EE] hover:text-[#116344] transition-colors"
                                >
                                  <Edit3 size={13} /> Sửa
                                </button>
                                <button
                                  onClick={() => handleToggleUserBlock(item)}
                                  className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                                    item.isBlocked
                                      ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                      : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                                  }`}
                                >
                                  {item.isBlocked ? 'Mở khóa' : 'Khóa'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="p-12 text-center">
                            <Users className="mx-auto mb-3 text-[#758278]/40" size={32} />
                            <p className="font-bold text-sm text-[#17231D]">Không tìm thấy khách hàng nào</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 5: BÁO CÁO DOANH THU (KHÔNG BIỂU ĐỒ - BẢNG SỐ LIỆU CAO CẤP)
              ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'revenue' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#17231D]">Báo cáo doanh thu</h1>
                  <p className="text-xs text-[#758278]">
                    Tổng hợp số liệu kinh doanh minh bạch theo ngày, tháng, năm (Không sử dụng biểu đồ)
                  </p>
                </div>
                {/* Period Controls */}
                <div className="flex items-center gap-2 rounded-xl border border-[#E8EEE9] bg-white p-1 text-xs font-semibold shadow-2xs">
                  <select
                    value={revenueFilterType}
                    onChange={(e) => setRevenueFilterType(e.target.value)}
                    className="rounded-lg bg-[#F7F9F6] px-3 py-1.5 text-xs font-bold text-[#17231D] outline-none"
                  >
                    <option value="day">Theo ngày</option>
                    <option value="month">Theo tháng</option>
                    <option value="year">Theo năm</option>
                  </select>

                  {revenueFilterType === 'day' && (
                    <input
                      type="date"
                      value={revenueFilterDate}
                      onChange={(e) => setRevenueFilterDate(e.target.value)}
                      className="rounded-lg bg-[#E8F5EE] px-3 py-1 text-xs font-bold text-[#116344] outline-none"
                    />
                  )}

                  {revenueFilterType === 'month' && (
                    <div className="flex items-center gap-1 rounded-lg bg-[#E8F5EE] px-2.5 py-1 text-xs font-bold text-[#116344]">
                      <select
                        value={parseInt(revenueFilterMonth.split('-')[1] || '1', 10)}
                        onChange={(e) => {
                          const year = revenueFilterMonth.split('-')[0] || new Date().getFullYear();
                          const month = String(e.target.value).padStart(2, '0');
                          setRevenueFilterMonth(`${year}-${month}`);
                        }}
                        className="bg-transparent outline-none cursor-pointer font-bold text-[#116344]"
                      >
                        {Array.from({ length: 12 }).map((_, i) => (
                          <option key={i + 1} value={i + 1} className="text-[#17231D]">
                            Tháng {i + 1}
                          </option>
                        ))}
                      </select>
                      <span>/</span>
                      <select
                        value={revenueFilterMonth.split('-')[0]}
                        onChange={(e) => {
                          const month = revenueFilterMonth.split('-')[1] || '01';
                          setRevenueFilterMonth(`${e.target.value}-${month}`);
                        }}
                        className="bg-transparent outline-none cursor-pointer font-bold text-[#116344]"
                      >
                        {Array.from({ length: 5 }).map((_, i) => {
                          const y = new Date().getFullYear() - i;
                          return (
                            <option key={y} value={y.toString()} className="text-[#17231D]">
                              {y}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {revenueFilterType === 'year' && (
                    <select
                      value={revenueFilterYear}
                      onChange={(e) => setRevenueFilterYear(e.target.value)}
                      className="rounded-lg bg-[#E8F5EE] px-3 py-1 text-xs font-bold text-[#116344] outline-none"
                    >
                      {Array.from({ length: 5 }).map((_, i) => {
                        const y = new Date().getFullYear() - i;
                        return (
                          <option key={y} value={y.toString()} className="text-[#17231D]">
                            Năm {y}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              </div>

              {/* Revenue KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#E8EEE9] bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#758278]">Doanh thu kỳ lọc</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8F5EE] text-[#16845B]">
                      <DollarSign size={18} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-[#17231D]">
                    {formatCurrency(revenueStats.reduce((s, r) => s + r.revenue, 0))}
                  </p>
                  <p className="mt-1 text-xs text-[#758278]">
                    {revenueFilterType === 'day'
                      ? `Ngày ${new Date(revenueFilterDate).toLocaleDateString('vi-VN')}`
                      : revenueFilterType === 'month'
                      ? `Tháng ${parseInt(revenueFilterMonth.split('-')[1] || '1', 10)}/${revenueFilterMonth.split('-')[0]}`
                      : `Năm ${revenueFilterYear}`}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E8EEE9] bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#758278]">Đơn hoàn thành</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF4DF] text-amber-700">
                      <ClipboardList size={18} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-[#17231D]">
                    {revenueStats.reduce((s, r) => s + r.orders, 0).toLocaleString('vi-VN')} đơn
                  </p>
                  <p className="mt-1 text-xs text-[#758278]">Đã thanh toán thành công</p>
                </div>

                <div className="rounded-2xl border border-[#E8EEE9] bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#758278]">Giá trị trung bình</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <TrendingUp size={18} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-[#17231D]">
                    {(() => {
                      const totalOrders = revenueStats.reduce((s, r) => s + r.orders, 0);
                      const totalRev = revenueStats.reduce((s, r) => s + r.revenue, 0);
                      return totalOrders ? formatCurrency(Math.round(totalRev / totalOrders)) : '—';
                    })()}
                  </p>
                  <p className="mt-1 text-xs text-[#758278]">Trung bình mỗi đơn hàng</p>
                </div>
              </div>

              {/* Data Table: Breakdown by time period (NO CHARTS) */}
              <div className="rounded-2xl border border-[#E8EEE9] bg-white shadow-xs overflow-hidden">
                <div className="border-b border-[#E8EEE9] px-6 py-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-base text-[#17231D]">Bảng phân rã chi tiết doanh thu</h3>
                    <p className="text-xs text-[#758278]">Gom nhóm theo ngày/tháng kèm danh sách mã đơn hàng</p>
                  </div>
                  <span className="text-xs text-[#758278]">
                    Tổng cộng <span className="font-bold text-[#16845B]">{revenueStats.reduce((s, r) => s + r.orders, 0)}</span> đơn đã thanh toán
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[#E8EEE9] bg-[#F7F9F6] text-[11px] font-bold uppercase tracking-wider text-[#758278]">
                      <tr>
                        <th className="px-6 py-3.5">Mốc thời gian</th>
                        <th className="px-6 py-3.5 text-center">Số đơn</th>
                        <th className="px-6 py-3.5">Mã đơn hàng liên quan</th>
                        <th className="px-6 py-3.5 text-right">Doanh thu ghi nhận</th>
                        <th className="px-6 py-3.5 text-right">Tỷ trọng (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8EEE9]/60">
                      {revenueStats.length > 0 ? (
                        (() => {
                          const totalRevenue = revenueStats.reduce((s, r) => s + r.revenue, 0) || 1;
                          return revenueStats.map((item) => (
                            <tr key={item.sortKey} className="hover:bg-[#F7F9F6]/60 transition-colors">
                              <td className="px-6 py-4 font-semibold text-xs text-[#17231D] whitespace-nowrap">{item.label}</td>
                              <td className="px-6 py-4 text-center font-bold text-xs text-[#17231D]">
                                {item.orders}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap items-center gap-1.5 max-w-[340px]">
                                  {item.orderList?.map((o) => (
                                    <button
                                      key={o._id}
                                      onClick={() => setSelectedOrder(o)}
                                      className="inline-flex items-center gap-1 rounded-md border border-[#E8EEE9] bg-[#F7F9F6] px-2 py-0.5 font-mono text-[11px] font-bold text-[#16845B] hover:bg-[#E8F5EE] hover:border-[#16845B]/40 transition-colors shadow-2xs cursor-pointer"
                                      title={`Xem chi tiết đơn #${o._id?.toUpperCase()} - ${o.user?.name || 'Khách'} (${formatCurrency(o.totalAmount)})`}
                                    >
                                      #{o._id?.slice(-6)?.toUpperCase()}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-xs text-[#16845B] whitespace-nowrap">
                                {formatCurrency(item.revenue)}
                              </td>
                              <td className="px-6 py-4 text-right text-xs text-[#758278] font-mono whitespace-nowrap">
                                {((item.revenue / totalRevenue) * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ));
                        })()
                      ) : (
                        <tr>
                          <td colSpan="5" className="p-10 text-center text-xs text-[#758278]">
                            Chưa có dữ liệu thanh toán trong kỳ lọc này.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {revenueStats.length > 0 && (
                      <tfoot className="border-t-2 border-[#E8EEE9] bg-[#F7F9F6] font-bold text-xs text-[#17231D]">
                        <tr>
                          <td className="px-6 py-4">TỔNG CỘNG KỲ LỌC</td>
                          <td className="px-6 py-4 text-center">
                            {revenueStats.reduce((s, r) => s + r.orders, 0)} đơn
                          </td>
                          <td className="px-6 py-4 text-xs text-[#758278] font-normal">
                            (Bấm vào từng mã đơn để xem chi tiết)
                          </td>
                          <td className="px-6 py-4 text-right text-[#16845B] text-sm whitespace-nowrap">
                            {formatCurrency(revenueStats.reduce((s, r) => s + r.revenue, 0))}
                          </td>
                          <td className="px-6 py-4 text-right font-mono whitespace-nowrap">100.0%</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Detailed Transactions Ledger */}
              <div className="rounded-2xl border border-[#E8EEE9] bg-white shadow-xs overflow-hidden">
                <div className="border-b border-[#E8EEE9] px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-[#17231D]">Danh sách giao dịch chi tiết trong kỳ</h3>
                    <p className="text-xs text-[#758278]">
                      Chi tiết từng đơn đã thanh toán kèm mã vận đơn, tên khách hàng và tổng tiền
                    </p>
                  </div>
                  <span className="rounded-lg bg-[#E8F5EE] px-2.5 py-1 text-xs font-bold text-[#16845B]">
                    {periodPaidOrders.length} đơn hàng
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[#E8EEE9] bg-[#F7F9F6] text-[11px] font-bold uppercase tracking-wider text-[#758278]">
                      <tr>
                        <th className="px-6 py-3.5">Mã đơn</th>
                        <th className="px-6 py-3.5">Khách hàng</th>
                        <th className="px-6 py-3.5">Thời gian đặt</th>
                        <th className="px-6 py-3.5">Phương thức</th>
                        <th className="px-6 py-3.5 text-right">Tổng thanh toán</th>
                        <th className="px-6 py-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8EEE9]/60">
                      {periodPaidOrders.length > 0 ? (
                        periodPaidOrders.map((order) => (
                          <tr key={order._id} className="hover:bg-[#F7F9F6]/60 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs font-bold text-[#16845B] whitespace-nowrap">
                              #{order._id?.slice(-8)?.toUpperCase()}
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-bold text-xs text-[#17231D]">{order.user?.name || 'Khách'}</p>
                              <p className="text-[11px] text-[#758278]">{order.phone || '—'}</p>
                            </td>
                            <td className="px-6 py-4 text-xs text-[#758278] whitespace-nowrap">
                              {formatDate(order.createdAt)}
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-[#17231D] whitespace-nowrap">
                              <span className="rounded-md border border-[#E8EEE9] bg-[#F7F9F6] px-2.5 py-1 text-[11px] font-semibold">
                                {order.paymentMethod || 'Tiền mặt'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-xs text-[#17231D] whitespace-nowrap">
                              {formatCurrency(order.totalAmount)}
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => setSelectedOrder(order)}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E8EEE9] px-2.5 text-xs font-semibold text-[#17231D] hover:bg-[#E8F5EE] hover:text-[#116344] transition-colors"
                              >
                                <Eye size={13} /> Chi tiết
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-xs text-[#758278]">
                            Chưa có đơn hàng nào trong kỳ lọc này.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 6: THÔNG BÁO HỆ THỐNG
              ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'notifications' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#17231D]">Trung tâm thông báo</h1>
                  <p className="text-xs text-[#758278]">Cảnh báo tồn kho, đánh giá người dùng và đơn hàng mới</p>
                </div>
                {unreadNotifications > 0 && (
                  <button
                    onClick={handleMarkAllNotificationsAsRead}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E8EEE9] bg-white px-3.5 text-xs font-semibold text-[#16845B] hover:bg-[#E8F5EE] transition-colors shadow-2xs"
                  >
                    <Check size={14} /> Đánh dấu tất cả đã đọc
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-[#E8EEE9] bg-white shadow-xs overflow-hidden">
                <div className="flex items-center gap-2 border-b border-[#E8EEE9] px-6 py-3 bg-[#F7F9F6] text-xs">
                  <button
                    onClick={() => setNotificationFilter('all')}
                    className={`rounded-lg px-3 py-1 font-semibold transition ${
                      notificationFilter === 'all' ? 'bg-white text-[#16845B] shadow-2xs' : 'text-[#758278]'
                    }`}
                  >
                    Tất cả ({notifications.length})
                  </button>
                  <button
                    onClick={() => setNotificationFilter('unread')}
                    className={`rounded-lg px-3 py-1 font-semibold transition ${
                      notificationFilter === 'unread' ? 'bg-white text-[#16845B] shadow-2xs' : 'text-[#758278]'
                    }`}
                  >
                    Chưa đọc ({unreadNotifications})
                  </button>
                </div>

                <div className="divide-y divide-[#E8EEE9]/60">
                  {notifications
                    .filter((n) => (notificationFilter === 'unread' ? !n.isRead : true))
                    .map((notif) => (
                      <div
                        key={notif._id}
                        onClick={() => handleOpenNotification(notif)}
                        className={`flex items-start gap-4 p-5 transition-colors cursor-pointer ${
                          !notif.isRead ? 'bg-[#E8F5EE]/40 hover:bg-[#E8F5EE]/70' : 'hover:bg-[#F7F9F6]'
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            !notif.isRead ? 'bg-[#16845B] text-white shadow-xs' : 'bg-slate-100 text-[#758278]'
                          }`}
                        >
                          <Bell size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs ${!notif.isRead ? 'font-bold text-[#17231D]' : 'font-medium text-[#758278]'}`}>
                              {notif.message}
                            </p>
                            <span className="shrink-0 text-[11px] text-[#758278]">{formatDate(notif.createdAt)}</span>
                          </div>
                          {getNotificationFoodId(notif) && (
                            <p className="mt-1 text-[11px] font-semibold text-[#16845B] hover:underline">
                              Xem món ăn liên quan →
                            </p>
                          )}
                        </div>
                        {!notif.isRead && (
                          <span className="h-2 w-2 rounded-full bg-[#16845B] mt-2 shrink-0" />
                        )}
                      </div>
                    ))}
                  {notifications.length === 0 && (
                    <div className="p-12 text-center">
                      <Bell className="mx-auto mb-3 text-[#758278]/40" size={32} />
                      <p className="font-bold text-sm text-[#17231D]">Chưa có thông báo nào</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB: QUẢN LÝ NHẬT KÝ AI (DÀNH CHO ADMIN)
              ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'ai_logs' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#17231D] flex items-center gap-2">
                    <Bot className="text-[#16845B]" size={26} /> Quản lý nhật ký AI
                  </h1>
                  <p className="text-xs text-[#758278]">
                    Tra cứu và kiểm soát toàn bộ câu hỏi tư vấn sức khỏe, dinh dưỡng của người dùng trên toàn hệ thống
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchAILogs}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E8EEE9] bg-white px-3.5 text-xs font-semibold text-[#17231D] hover:bg-[#F7F9F6] transition-colors shadow-2xs"
                  >
                    <RefreshCw size={14} className={aiLogsLoading ? 'animate-spin' : ''} /> Làm mới
                  </button>
                  {aiLogs.length > 0 && (
                    <button
                      onClick={handleClearAllAILogs}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/60 px-3.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors shadow-2xs"
                    >
                      <Trash2 size={14} /> Xóa tất cả
                    </button>
                  )}
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#E8EEE9] bg-white p-4 shadow-xs">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#758278]" size={16} />
                  <input
                    type="text"
                    placeholder="Tìm theo nội dung câu hỏi, tên khách hàng, email..."
                    value={aiSearchTerm}
                    onChange={(e) => setAiSearchTerm(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] pl-10 pr-4 text-xs font-medium text-[#17231D] outline-none transition focus:border-[#16845B] focus:bg-white"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={aiTopicFilter}
                    onChange={(e) => setAiTopicFilter(e.target.value)}
                    className="h-10 rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3 text-xs font-semibold text-[#17231D] outline-none focus:border-[#16845B]"
                  >
                    <option value="all">Tất cả chủ đề</option>
                    <option value="Tiểu đường">Tiểu đường</option>
                    <option value="Giảm cân / Eat Clean">Giảm cân / Eat Clean</option>
                    <option value="Tăng cơ / Gym">Tăng cơ / Gym</option>
                    <option value="Ăn chay">Ăn chay</option>
                    <option value="Tim mạch / Huyết áp">Tim mạch / Huyết áp</option>
                    <option value="Dạ dày / Tiêu hóa">Dạ dày / Tiêu hóa</option>
                    <option value="Chào hỏi / Xã giao">Chào hỏi / Xã giao</option>
                    <option value="Tư vấn món ăn">Tư vấn món ăn</option>
                  </select>
                  <span className="text-xs text-[#758278]">
                    Tổng cộng <span className="font-bold text-[#17231D]">{aiLogs.length}</span> câu hỏi
                  </span>
                </div>
              </div>

              {/* Table list */}
              <div className="rounded-2xl border border-[#E8EEE9] bg-white shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F9F6] text-[#758278] border-b border-[#E8EEE9]">
                      <tr>
                        <th className="py-3 px-4 font-bold">Khách hàng</th>
                        <th className="py-3 px-4 font-bold">Nội dung câu hỏi & Chủ đề</th>
                        <th className="py-3 px-4 font-bold">Phản hồi của AI</th>
                        <th className="py-3 px-4 font-bold whitespace-nowrap">Thời gian</th>
                        <th className="py-3 px-4 font-bold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8EEE9]">
                      {aiLogsLoading ? (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-xs text-[#758278]">
                            <div className="flex items-center justify-center gap-2">
                              <RefreshCw size={16} className="animate-spin text-[#16845B]" />
                              Đang tải dữ liệu nhật ký AI...
                            </div>
                          </td>
                        </tr>
                      ) : aiLogs.length > 0 ? (
                        aiLogs.map((log) => (
                          <tr key={log._id} className="hover:bg-[#F7F9F6]/60 transition-colors">
                            <td className="py-3.5 px-4 align-top">
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-full bg-[#E8F5EE] text-[#16845B] font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden">
                                  {log.user?.avatar ? (
                                    <img src={log.user.avatar} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    (log.userName || log.user?.name || 'K')[0].toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-[#17231D] truncate max-w-[120px]">
                                    {log.userName || log.user?.name || 'Khách hàng'}
                                  </p>
                                  <p className="text-[10px] text-[#758278] truncate max-w-[120px]">
                                    {log.userEmail || log.user?.email || '—'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 align-top max-w-xs">
                              <p className="font-semibold text-[#17231D] line-clamp-2 leading-relaxed">
                                {log.question}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {log.topics?.map((topic, tIdx) => (
                                  <span
                                    key={tIdx}
                                    className="rounded-md bg-[#E8F5EE] px-1.5 py-0.5 text-[10px] font-bold text-[#16845B]"
                                  >
                                    {topic}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 align-top max-w-sm">
                              <p className="text-[#758278] line-clamp-2 leading-relaxed">
                                {log.aiResponse?.replace(/RECOMMENDATIONS:.*/i, '').trim()}
                              </p>
                              {log.recommendedFoods?.length > 0 && (
                                <p className="mt-1 text-[11px] font-bold text-[#16845B]">
                                  🍴 {log.recommendedFoods.length} món ăn được đề xuất
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-4 align-top whitespace-nowrap text-[11px] text-[#758278]">
                              {formatDate(log.createdAt)}
                            </td>
                            <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedAILog(log)}
                                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#E8EEE9] px-2 text-[11px] font-semibold text-[#17231D] hover:bg-[#E8F5EE] hover:text-[#16845B] transition-colors"
                                >
                                  <Eye size={12} /> Xem
                                </button>
                                <button
                                  onClick={() => handleDeleteAILog(log._id)}
                                  disabled={deletingAILogId === log._id}
                                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-red-200 px-2 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                >
                                  <Trash2 size={12} /> Xóa
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="p-12 text-center text-xs text-[#758278]">
                            <Bot className="mx-auto mb-2 text-[#758278]/40" size={32} />
                            Không có nhật ký câu hỏi AI nào phù hợp.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 7: HỒ SƠ QUẢN TRỊ VIÊN
              ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#17231D]">Hồ sơ quản trị viên</h1>
                <p className="text-xs text-[#758278]">Quản lý thông tin định danh và bảo mật tài khoản quản trị</p>
              </div>

              <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
                {/* Profile Card & Avatar */}
                <div className="rounded-2xl border border-[#E8EEE9] bg-white p-6 shadow-xs text-center flex flex-col items-center">
                  <div className="relative mb-4 h-28 w-28 overflow-hidden rounded-2xl border-2 border-[#16845B]/30 bg-slate-100 shadow-sm">
                    <img
                      src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'}
                      alt={user?.name || 'Admin'}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity hover:opacity-100"
                    >
                      {avatarUploading ? <RefreshCw className="animate-spin" size={22} /> : <Camera size={22} />}
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAdminAvatarChange}
                      className="hidden"
                    />
                  </div>

                  <h3 className="font-bold text-base text-[#17231D]">{user?.name}</h3>
                  <p className="text-xs text-[#758278]">{user?.email}</p>
                  <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[#E8F5EE] px-3 py-0.5 text-[11px] font-bold text-[#16845B]">
                    <ShieldCheck size={13} /> Quản trị viên cấp cao
                  </span>

                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="mt-5 w-full rounded-xl border border-[#E8EEE9] py-2 text-xs font-semibold text-[#17231D] hover:bg-[#F7F9F6] transition-colors"
                  >
                    Đổi ảnh đại diện
                  </button>
                </div>

                {/* Edit forms */}
                <div className="space-y-6">
                  {/* General Info */}
                  <div className="rounded-2xl border border-[#E8EEE9] bg-white p-6 shadow-xs">
                    <h3 className="font-bold text-base text-[#17231D] mb-4">Thông tin cơ bản</h3>
                    <form onSubmit={handleAdminProfileUpdate} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-[#17231D] mb-1.5">Tên hiển thị</label>
                        <input
                          value={adminProfileForm.name}
                          onChange={(e) => setAdminProfileForm({ ...adminProfileForm, name: e.target.value })}
                          required
                          className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3.5 text-xs font-medium text-[#17231D] outline-none transition focus:border-[#16845B] focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#17231D] mb-1.5">Địa chỉ Email</label>
                        <input
                          value={user?.email || ''}
                          disabled
                          className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-slate-100 px-3.5 text-xs text-[#758278] cursor-not-allowed"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="rounded-xl bg-[#16845B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#116344] transition-colors shadow-xs"
                        >
                          Lưu thay đổi
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Password Form */}
                  <div className="rounded-2xl border border-[#E8EEE9] bg-white p-6 shadow-xs">
                    <h3 className="font-bold text-base text-[#17231D] mb-4">Đổi mật khẩu</h3>
                    <form onSubmit={handleAdminPasswordChange} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <label className="block text-xs font-bold text-[#17231D] mb-1.5">Mật khẩu hiện tại</label>
                          <input
                            type="password"
                            value={adminPasswordForm.currentPassword}
                            onChange={(e) =>
                              setAdminPasswordForm({ ...adminPasswordForm, currentPassword: e.target.value })
                            }
                            required
                            className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3.5 text-xs font-medium text-[#17231D] outline-none transition focus:border-[#16845B] focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#17231D] mb-1.5">Mật khẩu mới</label>
                          <input
                            type="password"
                            value={adminPasswordForm.newPassword}
                            onChange={(e) =>
                              setAdminPasswordForm({ ...adminPasswordForm, newPassword: e.target.value })
                            }
                            required
                            className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3.5 text-xs font-medium text-[#17231D] outline-none transition focus:border-[#16845B] focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#17231D] mb-1.5">Xác nhận mật khẩu</label>
                          <input
                            type="password"
                            value={adminPasswordForm.confirmPassword}
                            onChange={(e) =>
                              setAdminPasswordForm({ ...adminPasswordForm, confirmPassword: e.target.value })
                            }
                            required
                            className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3.5 text-xs font-medium text-[#17231D] outline-none transition focus:border-[#16845B] focus:bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-4 py-2 text-xs font-semibold text-[#17231D] hover:bg-[#16845B] hover:text-white transition-colors"
                        >
                          Cập nhật mật khẩu
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: CHI TIẾT NHẬT KÝ CÂU HỎI AI
          ══════════════════════════════════════════════════════════════ */}
      {selectedAILog && (
        <Modal title="Chi tiết câu hỏi & phản hồi AI" onClose={() => setSelectedAILog(null)}>
          <div className="space-y-5 text-xs">
            {/* Header info */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F9F6] border border-[#E8EEE9]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#E8F5EE] text-[#16845B] font-bold flex items-center justify-center text-sm shrink-0 overflow-hidden">
                  {selectedAILog.user?.avatar ? (
                    <img src={selectedAILog.user.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (selectedAILog.userName || selectedAILog.user?.name || 'K')[0].toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-bold text-[#17231D] text-sm">{selectedAILog.userName || selectedAILog.user?.name || 'Khách hàng'}</p>
                  <p className="text-[#758278] text-[11px]">{selectedAILog.userEmail || selectedAILog.user?.email || 'Chưa có email'}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#758278] block">Thời gian hỏi:</span>
                <span className="font-semibold text-[#17231D]">{formatDate(selectedAILog.createdAt)}</span>
              </div>
            </div>

            {/* Question */}
            <div className="p-4 rounded-xl border border-[#E8EEE9] bg-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#758278] block mb-1.5">
                Câu hỏi của người dùng:
              </span>
              <p className="text-sm font-semibold text-[#17231D] leading-relaxed">
                {selectedAILog.question}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {selectedAILog.topics?.map((topic, idx) => (
                  <span key={idx} className="rounded-md bg-[#E8F5EE] px-2 py-0.5 text-[10px] font-bold text-[#16845B]">
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            {/* AI Response */}
            <div className="p-4 rounded-xl border border-[#16845B]/20 bg-[#E8F5EE]/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#16845B] block mb-1.5 flex items-center gap-1.5">
                <Bot size={14} /> Phản hồi từ trợ lý FoodCare AI:
              </span>
              <div className="text-[#17231D] text-xs leading-relaxed whitespace-pre-line space-y-1">
                {selectedAILog.aiResponse?.replace(/RECOMMENDATIONS:.*/i, '').trim()}
              </div>
            </div>

            {/* Recommended Foods */}
            {selectedAILog.recommendedFoods?.length > 0 && (
              <div className="p-4 rounded-xl border border-[#E8EEE9] bg-white">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#758278] block mb-2.5">
                  Món ăn được gợi ý kèm theo ({selectedAILog.recommendedFoods.length})
                </span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedAILog.recommendedFoods.map((food) => (
                    <div key={food._id} className="flex items-center gap-2.5 p-2 rounded-lg bg-[#F7F9F6] border border-[#E8EEE9]">
                      {food.images?.[0] && (
                        <img src={food.images[0]} alt="" className="h-10 w-10 rounded-md object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[#17231D] truncate">{food.name}</p>
                        <p className="text-[#16845B] font-semibold">{formatCurrency(food.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8EEE9]">
              <button
                type="button"
                onClick={() => handleDeleteAILog(selectedAILog._id)}
                className="h-8 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold transition-colors"
              >
                Xóa câu hỏi này
              </button>
              <button
                type="button"
                onClick={() => setSelectedAILog(null)}
                className="h-8 px-4 rounded-lg bg-[#16845B] text-white font-semibold hover:bg-[#116344] transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: CHI TIẾT ĐƠN HÀNG
          ══════════════════════════════════════════════════════════════ */}
      {selectedOrder && (
        <Modal title={`Chi tiết đơn hàng #${selectedOrder._id?.slice(-8)?.toUpperCase()}`} onClose={() => setSelectedOrder(null)}>
          <div className="space-y-6">
            {/* Status Stepper Preview */}
            <div className="rounded-xl bg-[#F7F9F6] p-4 border border-[#E8EEE9]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#758278]">Trạng thái hiện tại:</span>
                <StatusBadge status={selectedOrder.orderStatus} />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                <div>
                  <span className="text-[10px] text-[#758278]">Mã đơn:</span>
                  <p className="font-mono font-bold text-[#17231D]">#{selectedOrder._id?.toUpperCase()}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#758278]">Ngày đặt:</span>
                  <p className="font-semibold text-[#17231D]">{formatDate(selectedOrder.createdAt)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#758278]">Thanh toán:</span>
                  <p className="font-semibold text-[#17231D]">{selectedOrder.paymentMethod} ({selectedOrder.paymentStatus === 'paid' ? 'Đã trả' : 'Chưa trả'})</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#758278]">Tổng cộng:</span>
                  <p className="font-bold text-sm text-[#16845B]">{formatCurrency(selectedOrder.totalAmount)}</p>
                </div>
              </div>
            </div>

            {/* Customer & Shipping Details */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#E8EEE9] p-4 bg-white">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#758278] mb-2">Thông tin khách hàng</h4>
                <p className="font-bold text-sm text-[#17231D]">{selectedOrder.user?.name || 'Khách vãng lai'}</p>
                <p className="text-xs text-[#758278] mt-1">SĐT: {selectedOrder.phone || '—'}</p>
                <p className="text-xs text-[#758278]">Email: {selectedOrder.email || '—'}</p>
              </div>
              <div className="rounded-xl border border-[#E8EEE9] p-4 bg-white">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#758278] mb-2">Địa chỉ nhận hàng</h4>
                <p className="text-xs font-semibold text-[#17231D]">{selectedOrder.shippingAddress || 'Nhận tại cửa hàng'}</p>
                <p className="text-xs text-[#758278] mt-2">Ghi chú: {selectedOrder.note || 'Không có ghi chú'}</p>
              </div>
            </div>

            {/* Ordered Items Table */}
            <div className="rounded-xl border border-[#E8EEE9] overflow-hidden">
              <div className="bg-[#F7F9F6] px-4 py-2.5 border-b border-[#E8EEE9] text-xs font-bold text-[#17231D]">
                Danh sách món ăn ({selectedOrder.items?.length || 0})
              </div>
              <div className="divide-y divide-[#E8EEE9]">
                {selectedOrder.items?.map((item) => (
                  <div key={`${item.food}-${item.name}`} className="flex items-center justify-between p-3.5">
                    <div className="flex items-center gap-3">
                      {item.image && (
                        <img src={item.image} alt={item.name} className="h-11 w-11 rounded-lg object-cover border border-[#E8EEE9]" />
                      )}
                      <div>
                        <p className="font-semibold text-xs text-[#17231D]">{item.name}</p>
                        <p className="text-[11px] text-[#758278]">
                          {formatCurrency(item.price)} × {item.quantity}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-xs text-[#17231D]">
                      {formatCurrency((item.price || 0) * (item.quantity || 1))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Update status directly from modal */}
            {!['completed', 'cancelled'].includes(selectedOrder.orderStatus) && (
              <div className="flex items-center justify-between rounded-xl bg-amber-50/60 p-4 border border-amber-200/60">
                <span className="text-xs font-semibold text-amber-900">Cập nhật nhanh trạng thái:</span>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedOrder.orderStatus}
                    onChange={(e) => handleUpdateStatus(selectedOrder._id, e.target.value)}
                    className="h-8 rounded-lg border border-amber-300 bg-white px-2.5 text-xs font-bold text-amber-900 outline-none"
                  >
                    {Object.entries(statusLabels).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: THÊM / CẬP NHẬT MÓN ĂN
          ══════════════════════════════════════════════════════════════ */}
      {editingFood !== null && (
        <Modal
          title={editingFood?._id ? `Cập nhật món: ${editingFood.name}` : 'Thêm món ăn mới vào thực đơn'}
          onClose={closeFoodForm}
        >
          <form onSubmit={handleSaveFood} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#16845B]">1. Thông tin cơ bản</span>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-[#17231D] mb-1.5">Tên món ăn *</label>
                  <input
                    value={foodForm.name}
                    onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                    required
                    placeholder="Ví dụ: Salad ức gà sốt mè rang"
                    className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3.5 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#17231D] mb-1.5">Danh mục *</label>
                  <select
                    value={foodForm.category}
                    onChange={(e) => setFoodForm({ ...foodForm, category: e.target.value })}
                    required
                    className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3.5 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
                  >
                    <option value="">Chọn danh mục</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#17231D] mb-1.5">Giá bán (VNĐ) *</label>
                  <input
                    type="number"
                    min="0"
                    value={foodForm.price}
                    onChange={(e) => setFoodForm({ ...foodForm, price: e.target.value })}
                    required
                    placeholder="45000"
                    className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3.5 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
                  />
                </div>
                <div className="flex items-center gap-6 pt-5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#17231D] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={foodForm.isAvailable}
                      onChange={(e) => setFoodForm({ ...foodForm, isAvailable: e.target.checked })}
                      className="h-4 w-4 rounded accent-[#16845B]"
                    />
                    Đang mở bán
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#17231D] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={foodForm.isVegetarian}
                      onChange={(e) => setFoodForm({ ...foodForm, isVegetarian: e.target.checked })}
                      className="h-4 w-4 rounded accent-[#16845B]"
                    />
                    Món chay 🌱
                  </label>
                </div>
              </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#16845B]">2. Hình ảnh món ăn</span>
              <div className="flex gap-4 items-start">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[#E8EEE9] bg-slate-50 flex items-center justify-center">
                  {foodForm.image ? (
                    <img src={foodForm.image} alt="preview" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus size={24} className="text-slate-300" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    ref={foodImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFoodImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => foodImageInputRef.current?.click()}
                    disabled={foodImageUploading}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3 py-2 text-xs font-semibold text-[#17231D] hover:bg-slate-100 transition-colors"
                  >
                    <Upload size={14} />
                    {foodImageUploading ? 'Đang nén & tải ảnh...' : 'Chọn ảnh từ máy (Tự động tối ưu)'}
                  </button>
                  <input
                    value={foodForm.image}
                    onChange={(e) => setFoodForm({ ...foodForm, image: e.target.value })}
                    placeholder="Hoặc nhập link URL ảnh (https://...)"
                    className="h-9 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Description & Ingredients */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#16845B]">3. Mô tả & Thành phần</span>
              <div>
                <label className="block text-xs font-bold text-[#17231D] mb-1.5">Giới thiệu món</label>
                <textarea
                  rows="2"
                  value={foodForm.description}
                  onChange={(e) => setFoodForm({ ...foodForm, description: e.target.value })}
                  placeholder="Mô tả hương vị, nguồn gốc nguyên liệu sạch..."
                  className="w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] p-3 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#17231D] mb-1.5">Nguyên liệu (cách nhau bằng dấu phẩy)</label>
                <input
                  value={foodForm.ingredients}
                  onChange={(e) => setFoodForm({ ...foodForm, ingredients: e.target.value })}
                  placeholder="Ức gà, Xà lách lolo, Cà chua bi, Sốt mè rang"
                  className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3.5 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
                />
              </div>
            </div>

            {/* Nutrition facts */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#16845B]">4. Thành phần dinh dưỡng</span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#17231D] mb-1">🔥 Calo (kcal)</label>
                  <input
                    type="number"
                    min="0"
                    value={foodForm.calories}
                    onChange={(e) => setFoodForm({ ...foodForm, calories: e.target.value })}
                    placeholder="350"
                    className="h-9 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#17231D] mb-1">🥩 Protein (g)</label>
                  <input
                    type="number"
                    min="0"
                    value={foodForm.protein}
                    onChange={(e) => setFoodForm({ ...foodForm, protein: e.target.value })}
                    placeholder="28"
                    className="h-9 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#17231D] mb-1">🌾 Carbs (g)</label>
                  <input
                    type="number"
                    min="0"
                    value={foodForm.carbs}
                    onChange={(e) => setFoodForm({ ...foodForm, carbs: e.target.value })}
                    placeholder="15"
                    className="h-9 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#17231D] mb-1">💧 Fat (g)</label>
                  <input
                    type="number"
                    min="0"
                    value={foodForm.fat}
                    onChange={(e) => setFoodForm({ ...foodForm, fat: e.target.value })}
                    placeholder="8"
                    className="h-9 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Health Tags */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#16845B]">5. Tags sức khỏe & Cảnh báo</span>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#17231D] mb-1">Tags (Ít đường, Giàu đạm...)</label>
                  <input
                    value={foodForm.healthTags}
                    onChange={(e) => setFoodForm({ ...foodForm, healthTags: e.target.value })}
                    placeholder="Giàu protein, Không gluten"
                    className="h-9 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#17231D] mb-1">Cảnh báo dị ứng (nếu có)</label>
                  <input
                    value={foodForm.warningFor}
                    onChange={(e) => setFoodForm({ ...foodForm, warningFor: e.target.value })}
                    placeholder="Đậu phộng, Hải sản"
                    className="h-9 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E8EEE9]">
              <button
                type="button"
                onClick={closeFoodForm}
                className="rounded-xl border border-[#E8EEE9] px-4 py-2 text-xs font-semibold text-[#758278] hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#16845B] px-5 py-2 text-xs font-semibold text-white hover:bg-[#116344] transition-colors disabled:opacity-60 shadow-xs"
              >
                {saving ? 'Đang lưu...' : 'Lưu món ăn'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: THÊM DANH MỤC
          ══════════════════════════════════════════════════════════════ */}
      {isCategoryModalOpen && (
        <Modal title="Thêm danh mục thực đơn mới" onClose={() => setIsCategoryModalOpen(false)}>
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#17231D] mb-1.5">Tên danh mục *</label>
              <input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                required
                placeholder="Ví dụ: Salad giảm cân, Cơm gạo lứt, Nước ép detox"
                className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3.5 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#17231D] mb-1.5">Mô tả ngắn</label>
              <textarea
                rows="3"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Mô tả tiêu chuẩn và tính chất của các món trong nhóm này..."
                className="w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] p-3 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="rounded-xl border border-[#E8EEE9] px-4 py-2 text-xs font-semibold text-[#758278] hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#16845B] px-5 py-2 text-xs font-semibold text-white hover:bg-[#116344] transition-colors disabled:opacity-60 shadow-xs"
              >
                {saving ? 'Đang lưu...' : 'Tạo danh mục'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: CHỈNH SỬA THÔNG TIN KHÁCH HÀNG
          ══════════════════════════════════════════════════════════════ */}
      {editingUser && (
        <Modal title={`Chỉnh sửa thông tin: ${editingUser.name}`} onClose={closeUserForm}>
          <div className="mb-4 grid gap-2.5 sm:grid-cols-2 rounded-xl bg-[#F7F9F6] p-3 text-xs border border-[#E8EEE9]">
            <div>
              <span className="text-[10px] text-[#758278]">Email tài khoản:</span>
              <p className="font-semibold text-[#17231D]">{editingUser.email}</p>
            </div>
            <div>
              <span className="text-[10px] text-[#758278]">Hạng thành viên:</span>
              <p className="font-semibold text-[#16845B]">{editingUser.tier || 'Thành viên'}</p>
            </div>
            <div>
              <span className="text-[10px] text-[#758278]">Tổng chi tiêu:</span>
              <p className="font-bold text-[#17231D]">{formatCurrency(editingUser.totalSpent || 0)}</p>
            </div>
            <div>
              <span className="text-[10px] text-[#758278]">Ngày đăng ký:</span>
              <p className="font-semibold text-[#17231D]">{formatDate(editingUser.createdAt)}</p>
            </div>
          </div>

          <form onSubmit={handleUpdateUserInfo} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#17231D] mb-1.5">Họ và tên *</label>
              <input
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                required
                className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3.5 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-[#17231D] mb-1.5">Số điện thoại</label>
                <input
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  placeholder="0987654321"
                  className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3.5 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#17231D] mb-1.5">Địa chỉ giao hàng</label>
                <input
                  value={userForm.address}
                  onChange={(e) => setUserForm({ ...userForm, address: e.target.value })}
                  placeholder="Số nhà, đường, phường..."
                  className="h-10 w-full rounded-xl border border-[#E8EEE9] bg-[#F7F9F6] px-3.5 text-xs text-[#17231D] outline-none focus:border-[#16845B] focus:bg-white"
                />
              </div>
            </div>

            {userFormError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertCircle size={15} /> {userFormError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeUserForm}
                className="rounded-xl border border-[#E8EEE9] px-4 py-2 text-xs font-semibold text-[#758278] hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#16845B] px-5 py-2 text-xs font-semibold text-white hover:bg-[#116344] transition-colors disabled:opacity-60 shadow-xs"
              >
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

// ── REUSABLE DESIGN SYSTEM ATOMS ──

const KpiCard = ({ label, value, subtext, icon: Icon, badge, tone = 'green' }) => {
  const tones = {
    green: {
      bg: 'bg-[#E8F5EE]',
      text: 'text-[#16845B]',
    },
    orange: {
      bg: 'bg-[#FFF4DF]',
      text: 'text-[#D97706]',
    },
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
    },
  };

  const currentTone = tones[tone] || tones.green;

  return (
    <div className="rounded-2xl border border-[#E8EEE9] bg-white p-5 shadow-xs hover:border-[#16845B]/40 hover:shadow-sm transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${currentTone.bg} ${currentTone.text}`}>
            <Icon size={20} />
          </div>
          <span className="rounded-md bg-[#F7F9F6] border border-[#E8EEE9] px-2 py-0.5 text-[10px] font-bold text-[#758278]">
            {badge}
          </span>
        </div>
        <p className="text-xs font-medium text-[#758278]">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-[#17231D]">{value}</p>
      </div>
      <p className="mt-3 text-xs text-[#758278] border-t border-[#E8EEE9]/60 pt-2.5 truncate">{subtext}</p>
    </div>
  );
};

const OperationalTile = ({ icon: Icon, label, value, unit, tone = 'amber', actionText, onClick }) => {
  const tones = {
    amber: {
      border: 'border-amber-200/80',
      bg: 'bg-amber-50/50',
      badgeBg: 'bg-amber-100',
      text: 'text-amber-800',
    },
    cyan: {
      border: 'border-cyan-200/80',
      bg: 'bg-cyan-50/50',
      badgeBg: 'bg-cyan-100',
      text: 'text-cyan-800',
    },
    rose: {
      border: 'border-rose-200/80',
      bg: 'bg-rose-50/50',
      badgeBg: 'bg-rose-100',
      text: 'text-rose-800',
    },
    emerald: {
      border: 'border-emerald-200/80',
      bg: 'bg-emerald-50/50',
      badgeBg: 'bg-emerald-100',
      text: 'text-emerald-800',
    },
  };

  const t = tones[tone] || tones.amber;

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border ${t.border} ${t.bg} p-4 transition-all hover:scale-[1.01] cursor-pointer flex items-center justify-between`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.badgeBg} ${t.text}`}>
          <Icon size={19} />
        </div>
        <div>
          <p className="text-xs font-medium text-[#758278]">{label}</p>
          <p className="text-lg font-bold text-[#17231D]">
            {value} <span className="text-xs font-medium text-[#758278]">{unit}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center text-xs font-bold text-[#16845B]">
        <span>{actionText}</span>
        <ChevronRight size={14} />
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const style = statusBadgeStyles[status] || {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border ${style.border} ${style.bg} px-2.5 py-1 text-xs font-bold ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {statusLabels[status] || status}
    </span>
  );
};

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl border border-[#E8EEE9]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8EEE9] bg-white px-6 py-4">
        <h3 className="text-base font-bold text-[#17231D]">{title}</h3>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-[#758278] hover:bg-slate-100 hover:text-[#17231D] transition-colors"
        >
          <X size={18} />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

export default AdminDashboard;
