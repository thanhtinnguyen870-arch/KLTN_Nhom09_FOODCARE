# Dockerfile for FoodCare Backend API
FROM node:20-alpine

# Cài đặt thư viện phụ thuộc cho sharp và image processing
RUN apk add --no-cache vips-dev fftw-dev build-base python3

WORKDIR /app

# Copy package files
COPY package*.json ./

# Cài đặt dependencies (bỏ qua devDependencies nếu cần)
RUN npm install --omit=dev

# Copy source code
COPY . .

# Mở cổng 5000
EXPOSE 5000

# Chạy server
CMD ["node", "server.js"]
