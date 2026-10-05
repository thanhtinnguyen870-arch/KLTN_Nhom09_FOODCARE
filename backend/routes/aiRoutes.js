import express from 'express';
import {
  recommendFood,
  getChatHistory,
  deleteChatEntry,
  clearChatHistory,
  getAIQuestionLogs,
  deleteAIQuestionLog,
  clearAIQuestionLogs,
} from '../controllers/aiController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/recommend').post(protect, recommendFood);
router.route('/history').get(protect, getChatHistory).delete(protect, clearChatHistory);
router.route('/history/:id').delete(protect, deleteChatEntry);
router.route('/logs').get(protect, admin, getAIQuestionLogs).delete(protect, admin, clearAIQuestionLogs);
router.route('/logs/:id').delete(protect, admin, deleteAIQuestionLog);

export default router;

