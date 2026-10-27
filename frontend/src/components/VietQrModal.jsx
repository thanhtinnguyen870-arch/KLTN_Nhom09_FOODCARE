import { useState } from 'react';
import { X, Copy, Check, QrCode, Download, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { BANK_CONFIG, getVietQrUrl } from '../constants/bankConfig';

const VietQrModal = ({ isOpen, onClose, order, onComplete }) => {
  const [copiedField, setCopiedField] = useState(null);

  if (!isOpen || !order) return null;

  const orderShortId = (order._id || '').slice(-6).toUpperCase();
  const transferContent = `FOODCARE ${orderShortId}`;
  const amount = Math.round(Number(order.totalAmount) || 0);
  const qrUrl = getVietQrUrl(amount, transferContent);

  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Đã sao chép ${fieldName}!`);
    setTimeout(() => {
      setCopiedField((curr) => (curr === fieldName ? null : curr));
    }, 2000);
  };

  const handleDownloadQr = () => {
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `VietQR_FoodCare_${orderShortId}.png`;
    link.target = '_blank';
    link.click();
  };

  const handleDone = () => {
    if (onComplete) {
      onComplete();
    } else {
      toast.info('FoodCare đã ghi nhận. Nhân viên sẽ kiểm tra thanh toán và chuẩn bị món cho bạn ngay!');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-100 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-[#16845B] text-white px-6 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Thanh toán chuyển khoản VietQR</h3>
              <p className="text-xs text-emerald-100">Đơn hàng #{orderShortId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Thông báo quét mã */}
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/70 text-emerald-900 text-xs">
            <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <p>
              Mở ứng dụng <strong>Ngân hàng</strong> hoặc <strong>Ví điện tử</strong> bất kỳ để quét mã. 
              Số tiền <strong>{amount.toLocaleString('vi-VN')} đ</strong> và nội dung đã được hệ thống điền tự động.
            </p>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center bg-gray-50/80 rounded-2xl p-4 border border-gray-100 shadow-inner">
            <div className="relative group bg-white p-3 rounded-2xl shadow-md border border-gray-200">
              <img
                src={qrUrl}
                alt="VietQR MB Bank FoodCare"
                className="w-56 h-auto max-w-full rounded-xl object-contain"
                loading="eager"
              />
            </div>
            <button
              onClick={handleDownloadQr}
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-white px-3 py-1.5 rounded-full border border-emerald-200 shadow-sm hover:shadow transition-all"
            >
              <Download size={13} /> Tải ảnh mã QR
            </button>
          </div>

          {/* Bảng chi tiết thông tin chuyển khoản */}
          <div className="space-y-2 text-xs">
            {/* Ngân hàng */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-150">
              <span className="text-gray-500 font-medium">Ngân hàng thụ hưởng:</span>
              <span className="font-bold text-dark text-right">{BANK_CONFIG.bankName}</span>
            </div>

            {/* Chủ tài khoản */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-150">
              <span className="text-gray-500 font-medium">Chủ tài khoản:</span>
              <span className="font-bold text-emerald-800 tracking-wide text-right">{BANK_CONFIG.accountName}</span>
            </div>

            {/* Số tài khoản */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-150">
              <span className="text-gray-600 font-medium">Số tài khoản:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm text-emerald-900 tracking-wider">
                  {BANK_CONFIG.accountNo}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(BANK_CONFIG.accountNo, 'Số tài khoản')}
                  className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-700 transition-colors"
                  title="Sao chép số tài khoản"
                >
                  {copiedField === 'Số tài khoản' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Số tiền */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-150">
              <span className="text-gray-600 font-medium">Số tiền thanh toán:</span>
              <div className="flex items-center gap-2">
                <span className="font-black text-base text-primary">
                  {amount.toLocaleString('vi-VN')} đ
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(amount.toString(), 'Số tiền')}
                  className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-700 transition-colors"
                  title="Sao chép số tiền"
                >
                  {copiedField === 'Số tiền' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Nội dung chuyển khoản */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 border border-amber-200">
              <div>
                <span className="text-gray-600 font-medium block">Nội dung chuyển khoản:</span>
                <span className="text-[10px] text-amber-700">(Giữ nguyên để nhân viên đối soát)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-amber-900 bg-white px-2 py-1 rounded border border-amber-200">
                  {transferContent}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(transferContent, 'Nội dung chuyển khoản')}
                  className="p-1 rounded-lg hover:bg-amber-100 text-amber-800 transition-colors"
                  title="Sao chép nội dung"
                >
                  {copiedField === 'Nội dung chuyển khoản' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Lưu ý kiểm tra nhân viên */}
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
            <AlertCircle size={15} className="text-blue-600 shrink-0 mt-0.5" />
            <p>
              Sau khi bạn nhấn <strong>&ldquo;Tôi đã hoàn tất thanh toán&rdquo;</strong>, hệ thống sẽ gửi đơn đến nhà bếp. Nhân viên FoodCare sẽ kiểm tra giao dịch biến động số dư và xác nhận đơn của bạn ngay lập tức.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-2.5 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition-colors"
          >
            Để thanh toán sau
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 hover:shadow-xl transition-all flex items-center justify-center gap-1.5"
          >
            <Check size={16} /> Tôi đã hoàn tất thanh toán
          </button>
        </div>
      </div>
    </div>
  );
};

export default VietQrModal;
