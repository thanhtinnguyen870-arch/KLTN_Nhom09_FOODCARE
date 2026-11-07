import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, ArrowRight, Home, ReceiptText, ShieldCheck } from 'lucide-react';
import axiosClient from '../api/axiosClient';

const VnpayReturn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const hasVerifiedRef = useRef(false);

  useEffect(() => {
    if (hasVerifiedRef.current) return;
    hasVerifiedRef.current = true;

    const verifyPayment = async () => {
      try {
        const params = {};
        for (const [key, value] of searchParams.entries()) {
          params[key] = value;
        }

        if (!params.vnp_SecureHash || !params.vnp_ResponseCode) {
          setErrorMsg('Không tìm thấy thông tin phản hồi từ cổng thanh toán VNPay.');
          setLoading(false);
          return;
        }

        const { data } = await axiosClient.post('/payments/vnpay/verify', params);
        setResult(data);
      } catch (error) {
        console.error('Lỗi xác thực VNPay:', error);
        setErrorMsg(error.response?.data?.message || 'Không thể xác thực giao dịch với máy chủ.');
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [searchParams]);

  const isSuccess = result?.success === true;
  const orderId = result?.orderId || searchParams.get('vnp_TxnRef')?.split('_')[0] || '';
  const amount = result?.amount || (Number(searchParams.get('vnp_Amount')) / 100) || 0;
  const bankCode = result?.bankCode || searchParams.get('vnp_BankCode') || 'NCB';
  const transactionNo = result?.transactionNo || searchParams.get('vnp_TransactionNo') || 'N/A';

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-slate-50/50">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
        {/* Header Decorator */}
        <div className={`p-8 text-center text-white ${isSuccess ? 'bg-gradient-to-br from-emerald-600 to-teal-700' : 'bg-gradient-to-br from-rose-500 to-red-600'}`}>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
            {loading ? (
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent" />
            ) : isSuccess ? (
              <CheckCircle2 size={46} className="text-white" />
            ) : (
              <XCircle size={46} className="text-white" />
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {loading
              ? 'Đang xác thực giao dịch...'
              : isSuccess
              ? 'Thanh toán thành công!'
              : 'Thanh toán chưa hoàn tất'}
          </h1>
          <p className="mt-1.5 text-xs font-medium text-white/80 flex items-center justify-center gap-1">
            <ShieldCheck size={14} /> Cổng thanh toán trực tuyến VNPay Sandbox
          </p>
        </div>

        {/* Content Details */}
        <div className="p-6 sm:p-8 space-y-6">
          {loading ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              Vui lòng đợi giây lát, hệ thống FoodCare đang đối soát kết quả với VNPay...
            </div>
          ) : isSuccess ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-xs text-emerald-900 leading-relaxed">
                Đơn hàng của bạn đã được xác nhận thanh toán trực tuyến thành công. Bếp ăn FoodCare sẽ chuẩn bị món và giao đến bạn trong thời gian sớm nhất!
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-500">
                  <span>Mã đơn hàng:</span>
                  <span className="font-mono font-bold text-slate-800">#{orderId.slice(-6).toUpperCase()}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Số tiền thanh toán:</span>
                  <span className="font-bold text-emerald-700 text-sm">{amount.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Phương thức:</span>
                  <span className="font-semibold text-slate-800">Cổng VNPAY ({bankCode})</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Mã giao dịch VNPay:</span>
                  <span className="font-mono text-slate-700">{transactionNo}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Trạng thái đơn:</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-[10px] text-emerald-800">
                    Đã thanh toán (Paid)
                  </span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/profile?tab=tracking')}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#16845B] py-3 text-xs font-bold text-white hover:bg-[#116344] transition-all shadow-md shadow-emerald-900/10"
                >
                  <ReceiptText size={15} /> Theo dõi đơn hàng
                </button>
                <Link
                  to="/foods"
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Home size={15} /> Đặt thêm món
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-xs text-rose-800 leading-relaxed">
                {errorMsg || result?.message || 'Giao dịch qua cổng VNPay bị gián đoạn hoặc bạn đã chủ động hủy thanh toán.'}
              </div>

              <p className="text-xs text-slate-500 text-center">
                Đơn hàng của bạn vẫn được lưu lại. Bạn có thể thanh toán lại trong mục Quản lý đơn hàng hoặc đặt đơn hàng mới.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/profile?tab=tracking')}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-sm"
                >
                  Xem đơn hàng <ArrowRight size={14} />
                </button>
                <Link
                  to="/checkout"
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Thử thanh toán lại
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VnpayReturn;

