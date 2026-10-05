import http from 'k6/http';
import { check, sleep } from 'k6';

// Cấu hình kịch bản đo tải (Load Testing Scenario)
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Tăng dần lên 20 concurrent users trong 30 giây
    { duration: '1m', target: 50 },   // Duy trì 50 concurrent users trong 1 phút
    { duration: '30s', target: 100 }, // Đẩy tải lên 100 concurrent users
    { duration: '30s', target: 0 },   // Hạ tải về 0
  ],
  thresholds: {
    // 95% số request phải hoàn thành dưới 500ms
    http_req_duration: ['p(95)<500'],
    // Tỷ lệ lỗi cho phép dưới 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:5000/api';

export default function () {
  // 1. Kiểm tra API lấy danh sách món ăn
  const foodsRes = http.get(`${BASE_URL}/foods`);
  check(foodsRes, {
    'GET /foods status is 200': (r) => r.status === 200,
    'GET /foods duration < 300ms': (r) => r.timings.duration < 300,
  });

  // 2. Kiểm tra API lấy danh mục
  const catRes = http.get(`${BASE_URL}/categories`);
  check(catRes, {
    'GET /categories status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
