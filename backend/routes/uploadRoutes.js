import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const avatarUploadDirectory = path.resolve(__dirname, '../uploads/avatars');
const reviewUploadDirectory = path.resolve(__dirname, '../uploads/reviews');
const foodUploadDirectory = path.resolve(__dirname, '../uploads/foods');

// Tạo thư mục nếu chưa có
[avatarUploadDirectory, reviewUploadDirectory, foodUploadDirectory].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const allowedVideoTypes = new Map([
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
  ['video/quicktime', '.mov'],
]);

// Multer dùng memory storage – sharp xử lý và nén trước khi ghi disk
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB raw max
  fileFilter(req, file, cb) {
    if (allowedImageTypes.has(file.mimetype)) return cb(null, true);
    cb(new Error('Chỉ chấp nhận file hình ảnh (jpg/png/webp/gif)!'));
  },
});

// Helper: nén ảnh qua sharp → lưu ra disk → trả về filename
async function compressAndSave(buffer, destDir, filenameBase, { width = 900, quality = 82 } = {}) {
  const filename = `${filenameBase}-${Date.now()}.webp`;
  const destPath = path.join(destDir, filename);
  await sharp(buffer)
    .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toFile(destPath);
  return filename;
}

// ── Avatar upload ──
// @route   POST /api/upload/avatar
// @access  Private
router.post('/avatar', protect, memoryUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có ảnh nào được tải lên.' });
  try {
    const filename = await compressAndSave(
      req.file.buffer,
      avatarUploadDirectory,
      `avatar-${req.user._id}`,
      { width: 300, quality: 80 }
    );
    const url = `${req.protocol}://${req.get('host')}/uploads/avatars/${filename}`;
    res.json({ url });
  } catch (err) {
    console.error('Avatar compress error:', err);
    res.status(500).json({ message: 'Lỗi xử lý ảnh.' });
  }
});

// ── Food image upload (Admin) ──
// @route   POST /api/upload/food-image
// @access  Private
router.post('/food-image', protect, memoryUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có ảnh nào được tải lên.' });
  try {
    const filename = await compressAndSave(
      req.file.buffer,
      foodUploadDirectory,
      'food',
      { width: 900, quality: 82 }
    );
    const url = `${req.protocol}://${req.get('host')}/uploads/foods/${filename}`;
    res.json({ url });
  } catch (err) {
    console.error('Food image compress error:', err);
    res.status(500).json({ message: 'Lỗi xử lý ảnh.' });
  }
});

// ── Review media upload (ảnh + video) ──
const uploadReviewMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (allowedImageTypes.has(file.mimetype) || allowedVideoTypes.has(file.mimetype)) return cb(null, true);
    cb(new Error('Chỉ chấp nhận ảnh (jpg/png/webp/gif) hoặc video (mp4/webm/mov).'));
  },
});

// @route   POST /api/upload/review-media
// @access  Private
router.post('/review-media', protect, uploadReviewMedia.array('media', 5), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'Không có file nào được tải lên.' });
  }
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  try {
    const files = await Promise.all(
      req.files.map(async (f) => {
        const isVideo = allowedVideoTypes.has(f.mimetype);
        if (isVideo) {
          // Video: lưu trực tiếp (không nén qua sharp)
          const ext = allowedVideoTypes.get(f.mimetype);
          const filename = `review-${req.user._id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;
          const destPath = path.join(reviewUploadDirectory, filename);
          fs.writeFileSync(destPath, f.buffer);
          return { url: `${baseUrl}/uploads/reviews/${filename}`, type: 'video', name: f.originalname, size: f.size };
        } else {
          // Ảnh: nén + convert sang WebP qua sharp
          const filename = `review-${req.user._id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`;
          const destPath = path.join(reviewUploadDirectory, filename);
          await sharp(f.buffer)
            .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(destPath);
          return { url: `${baseUrl}/uploads/reviews/${filename}`, type: 'image', name: f.originalname, size: f.size };
        }
      })
    );
    res.json({ files });
  } catch (err) {
    console.error('Review media compress error:', err);
    res.status(500).json({ message: 'Lỗi xử lý file.' });
  }
});

export default router;
