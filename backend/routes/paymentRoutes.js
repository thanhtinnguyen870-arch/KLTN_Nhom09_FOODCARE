import express from 'express';
import {
  confirmMomoPaymentForDev,
  createMomoPayment,
  handleMomoIpn,
  createVnpayPayment,
  verifyVnpayPayment,
} from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// MoMo routes
router.route('/momo/create').post(protect, createMomoPayment);
router.route('/momo/ipn').post(handleMomoIpn);
router.route('/momo/dev-confirm').post(protect, confirmMomoPaymentForDev);

// VNPay Sandbox routes
router.route('/vnpay/create').post(protect, createVnpayPayment);
router.route('/vnpay/verify').post(verifyVnpayPayment);

export default router;
