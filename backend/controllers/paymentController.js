import crypto from 'crypto';
import Order from '../models/Order.js';

const momoConfig = {
  partnerCode: process.env.MOMO_PARTNER_CODE,
  accessKey: process.env.MOMO_ACCESS_KEY,
  secretKey: process.env.MOMO_SECRET_KEY,
  endpoint: process.env.MOMO_ENDPOINT,
  redirectUrl: process.env.MOMO_REDIRECT_URL,
  ipnUrl: process.env.MOMO_IPN_URL,
};

const createMomoSignature = (payload) => {
  const rawSignature = [
    `accessKey=${momoConfig.accessKey}`,
    `amount=${payload.amount}`,
    `extraData=${payload.extraData}`,
    `ipnUrl=${payload.ipnUrl}`,
    `orderId=${payload.orderId}`,
    `orderInfo=${payload.orderInfo}`,
    `partnerCode=${payload.partnerCode}`,
    `redirectUrl=${payload.redirectUrl}`,
    `requestId=${payload.requestId}`,
    `requestType=${payload.requestType}`,
  ].join('&');

  return crypto
    .createHmac('sha256', momoConfig.secretKey)
    .update(rawSignature)
    .digest('hex');
};

const verifyMomoSignature = (payload) => {
  if (!payload.signature) return false;

  const rawSignature = [
    `accessKey=${momoConfig.accessKey}`,
    `amount=${payload.amount}`,
    `extraData=${payload.extraData || ''}`,
    `message=${payload.message}`,
    `orderId=${payload.orderId}`,
    `orderInfo=${payload.orderInfo}`,
    `orderType=${payload.orderType}`,
    `partnerCode=${payload.partnerCode}`,
    `payType=${payload.payType}`,
    `requestId=${payload.requestId}`,
    `responseTime=${payload.responseTime}`,
    `resultCode=${payload.resultCode}`,
    `transId=${payload.transId}`,
  ].join('&');

  const expectedSignature = crypto
    .createHmac('sha256', momoConfig.secretKey)
    .update(rawSignature)
    .digest('hex');

  return expectedSignature === payload.signature;
};

const ensureMomoConfig = () => {
  const missingKey = Object.entries(momoConfig).find(([, value]) => !value)?.[0];
  return missingKey ? `Missing MoMo config: ${missingKey}` : null;
};

export const markOrderAsPaid = async (order) => {
  order.paymentStatus = 'paid';
  order.orderStatus = order.orderStatus === 'pending' ? 'confirmed' : order.orderStatus;
  const updatedOrder = await order.save();
  return updatedOrder;
};

export const createMomoPayment = async (req, res) => {
  try {
    const configError = ensureMomoConfig();
    if (configError) {
      return res.status(500).json({ message: configError });
    }

    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Order is already paid' });
    }

    if (order.paymentMethod !== 'MOMO') {
      return res.status(400).json({ message: 'Order payment method is not MoMo' });
    }

    const requestId = `${momoConfig.partnerCode}-${order._id}-${Date.now()}`;
    const momoOrderId = `${order._id}-${Date.now()}`;
    const amount = Math.round(order.totalAmount).toString();
    const requestBody = {
      partnerCode: momoConfig.partnerCode,
      accessKey: momoConfig.accessKey,
      requestId,
      amount,
      orderId: momoOrderId,
      orderInfo: `Thanh toan don hang ${order._id}`,
      redirectUrl: momoConfig.redirectUrl,
      ipnUrl: momoConfig.ipnUrl,
      extraData: Buffer.from(JSON.stringify({ orderId: order._id.toString() })).toString('base64'),
      requestType: 'captureWallet',
      lang: 'vi',
    };

    requestBody.signature = createMomoSignature(requestBody);

    const momoResponse = await fetch(momoConfig.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data = await momoResponse.json();

    if (!momoResponse.ok || !data.payUrl) {
      return res.status(400).json({
        message: data.message || 'Cannot create MoMo payment',
        momo: data,
      });
    }

    res.json({
      payUrl: data.payUrl,
      deeplink: data.deeplink,
      qrCodeUrl: data.qrCodeUrl,
      orderId: order._id,
      momoOrderId,
      requestId,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const handleMomoIpn = async (req, res) => {
  try {
    const configError = ensureMomoConfig();
    if (configError) {
      return res.status(500).json({ message: configError });
    }

    const isValidSignature = verifyMomoSignature(req.body);
    if (!isValidSignature) {
      return res.status(400).json({ message: 'Invalid MoMo signature' });
    }

    let appOrderId = req.body.orderId?.split('-')?.[0];
    if (req.body.extraData) {
      try {
        const extraData = JSON.parse(Buffer.from(req.body.extraData, 'base64').toString('utf8'));
        appOrderId = extraData.orderId || appOrderId;
      } catch {
        // Fallback to MoMo orderId parsing above.
      }
    }

    const order = await Order.findById(appOrderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.paymentMethod !== 'MOMO') {
      return res.status(400).json({ message: 'Order payment method is not MoMo' });
    }

    if (Number(req.body.amount) !== Math.round(order.totalAmount)) {
      return res.status(400).json({ message: 'MoMo payment amount does not match order total' });
    }

    if (Number(req.body.resultCode) === 0) {
      const updatedOrder = await markOrderAsPaid(order);

      const io = req.app.get('io');
      if (io) io.emit('orderUpdated', updatedOrder);
    }

    res.json({ message: 'MoMo IPN received' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const confirmMomoPaymentForDev = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Dev payment confirmation is disabled in production' });
    }

    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (order.paymentMethod !== 'MOMO') {
      return res.status(400).json({ message: 'Order payment method is not MoMo' });
    }

    const updatedOrder = await markOrderAsPaid(order);
    const io = req.app.get('io');
    if (io) io.emit('orderUpdated', updatedOrder);

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// VNPay Sandbox Payment Gateway Handlers
// ==========================================

const formatVnpayDate = (date) => {
  const pad = (n) => (n < 10 ? '0' + n : n);
  const d = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
};

function sortVnpayParams(obj) {
  const sorted = {};
  const str = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (let key = 0; key < str.length; key++) {
    const rawKey = decodeURIComponent(str[key]);
    if (obj[rawKey] !== null && obj[rawKey] !== undefined && obj[rawKey] !== '') {
      sorted[str[key]] = encodeURIComponent(String(obj[rawKey])).replace(/%20/g, '+');
    }
  }
  return sorted;
}

// @desc    Create VNPay payment URL
// @route   POST /api/payments/vnpay/create
// @access  Private
export const createVnpayPayment = async (req, res) => {
  try {
    const tmnCode = (process.env.VNP_TMN_CODE || '').trim();
    const secretKey = (process.env.VNP_HASH_SECRET || '').trim();
    const vnpUrl = (process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html').trim();
    const returnUrl = (process.env.VNP_RETURN_URL || 'http://localhost:5173/payment/vnpay-return').trim();

    if (!tmnCode || !secretKey) {
      return res.status(500).json({ message: 'VNP_TMN_CODE hoặc VNP_HASH_SECRET chưa được cấu hình trong .env' });
    }

    const { orderId, bankCode } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Không có quyền truy cập đơn hàng này' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Đơn hàng này đã được thanh toán' });
    }

    const createDate = formatVnpayDate(new Date());
    const txnRef = `${order._id.toString()}_${Date.now()}`;
    const amount = Math.round(Number(order.totalAmount)) * 100; // VNPay quy định nhân 100

    let vnpParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Thanh toan don hang ${order._id.toString().slice(-6).toUpperCase()}`,
      vnp_OrderType: 'other',
      vnp_Amount: String(amount),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: '127.0.0.1',
      vnp_CreateDate: createDate,
    };

    if (bankCode) {
      vnpParams.vnp_BankCode = bankCode;
    }

    const sortedParams = sortVnpayParams(vnpParams);
    const signData = Object.keys(sortedParams)
      .map((k) => `${k}=${sortedParams[k]}`)
      .join('&');

    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const paymentUrl = `${vnpUrl}?${signData}&vnp_SecureHash=${signed}`;

    res.json({
      paymentUrl,
      orderId: order._id,
      txnRef,
    });
  } catch (error) {
    console.error('Lỗi tạo URL thanh toán VNPay:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify VNPay return / check transaction result
// @route   POST /api/payments/vnpay/verify
// @access  Public
export const verifyVnpayPayment = async (req, res) => {
  try {
    const vnpParams = { ...req.body };
    const secureHash = vnpParams.vnp_SecureHash;

    delete vnpParams.vnp_SecureHash;
    delete vnpParams.vnp_SecureHashType;

    const secretKey = process.env.VNP_HASH_SECRET;
    const sortedParams = sortVnpayParams(vnpParams);
    const signData = Object.keys(sortedParams)
      .map((k) => `${k}=${sortedParams[k]}`)
      .join('&');

    const hmac = crypto.createHmac('sha512', secretKey);
    const calculatedHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== calculatedHash) {
      return res.status(400).json({
        success: false,
        message: 'Chữ ký điện tử không hợp lệ (Sai checksum VNPay)',
      });
    }

    const txnRef = vnpParams.vnp_TxnRef || '';
    const orderId = txnRef.split('_')[0];
    const responseCode = vnpParams.vnp_ResponseCode;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng tương ứng' });
    }

    if (responseCode === '00') {
      // Giao dịch thành công
      if (order.paymentStatus !== 'paid') {
        await markOrderAsPaid(order);
        const io = req.app.get('io');
        if (io) io.emit('orderUpdated', order);
      }

      return res.json({
        success: true,
        message: 'Thanh toán VNPay thành công',
        orderId: order._id,
        amount: Number(vnpParams.vnp_Amount) / 100,
        bankCode: vnpParams.vnp_BankCode,
        transactionNo: vnpParams.vnp_TransactionNo,
      });
    } else {
      // Giao dịch thất bại hoặc bị hủy
      return res.json({
        success: false,
        message: 'Giao dịch qua cổng VNPay không thành công hoặc người dùng đã hủy',
        orderId: order._id,
        responseCode,
      });
    }
  } catch (error) {
    console.error('Lỗi xác thực VNPay:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
