import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Tự động retry tối đa 2 lần cho các lỗi kết nối mạng / server chưa kịp sẵn sàng khi mới mở app
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const isNetworkOrTimeout = !error.response || ['ERR_NETWORK', 'ECONNABORTED', 'ECONNREFUSED'].includes(error.code);
    const isServerWakingUp = [502, 503, 504].includes(error.response?.status);

    if (config && (isNetworkOrTimeout || isServerWakingUp)) {
      config.__retryCount = config.__retryCount || 0;
      if (config.__retryCount < 2) {
        config.__retryCount += 1;
        const delay = config.__retryCount * 600;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return axiosClient(config);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;

