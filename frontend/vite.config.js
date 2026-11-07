import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Tối ưu chunk splitting để giảm bundle size
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react') || id.includes('react-toastify')) {
              return 'vendor-ui';
            }
            if (id.includes('axios') || id.includes('socket.io-client')) {
              return 'vendor-network';
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: { overlay: true },
    headers: {
      // Cho phép cửa sổ Google Sign-In popup giao tiếp với window cha mà không bị chặn postMessage
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    // Proxy API requests qua Vite dev server → backend
    // Giải quyết triệt để: CORS, IPv4/IPv6 mismatch, ERR_CONNECTION_REFUSED khi dùng localhost trực tiếp
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        timeout: 60000,
        proxyTimeout: 60000,
        // Tự động xử lý khi backend chưa sẵn sàng
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.warn('[Vite Proxy] Backend chưa sẵn sàng hoặc timeout:', err.message);
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ message: 'Máy chủ backend đang bận hoặc đang khởi động, vui lòng thử lại sau giây lát.' }));
            }
          });
        },
      },
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
