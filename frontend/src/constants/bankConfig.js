export const BANK_CONFIG = {
  bankId: 'MB', // Mã định danh ngân hàng theo VietQR
  bankName: 'MB Bank (Ngân hàng TMCP Quân Đội)',
  accountNo: '0383024159',
  accountName: 'NGUYEN THANH TIN',
  template: 'compact2', // Giao diện thẻ VietQR chuẩn kèm khung đẹp
};

/**
 * Tạo link ảnh VietQR động tự động điền số tiền và nội dung chuyển khoản
 * @param {number} amount - Số tiền giao dịch trong hóa đơn (VND)
 * @param {string} memo - Nội dung chuyển khoản (thường là mã đơn hàng)
 * @returns {string} Đường dẫn ảnh VietQR động chuẩn Napas 24/7
 */
export const getVietQrUrl = (amount = 0, memo = '') => {
  const cleanAmount = Math.max(0, Math.round(Number(amount) || 0));
  const cleanMemo = String(memo || '').trim();
  const encodedName = encodeURIComponent(BANK_CONFIG.accountName);
  const encodedMemo = encodeURIComponent(cleanMemo);

  return `https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-${BANK_CONFIG.template}.png?amount=${cleanAmount}&addInfo=${encodedMemo}&accountName=${encodedName}`;
};
