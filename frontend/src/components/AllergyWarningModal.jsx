import React from 'react';
import { AlertTriangle, ShieldAlert, X, Check, HeartPulse } from 'lucide-react';

const AllergyWarningModal = ({ isOpen, onClose, onConfirm, food, warnings }) => {
  if (!isOpen || !food) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-rose-100 overflow-hidden transform transition-all animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-500 to-amber-500 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Cảnh báo Dinh dưỡng & Sức khỏe</h3>
              <p className="text-xs text-rose-100">Hệ thống bảo vệ sức khỏe người dùng FoodCare</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
            {food.images?.[0] ? (
              <img
                src={food.images[0]}
                alt={food.name}
                className="w-14 h-14 rounded-xl object-cover border border-gray-200"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary-light flex items-center justify-center text-primary font-bold">
                🍽️
              </div>
            )}
            <div>
              <h4 className="font-bold text-gray-900 text-sm">{food.name}</h4>
              <p className="text-xs text-gray-500 line-clamp-1">
                {food.ingredients?.length ? `Thành phần: ${food.ingredients.join(', ')}` : 'Món ăn dinh dưỡng'}
              </p>
            </div>
          </div>

          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {warnings.map((warn, index) => (
              <div
                key={index}
                className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                  warn.type === 'allergy'
                    ? 'bg-rose-50/80 border-rose-200 text-rose-800'
                    : 'bg-amber-50/80 border-amber-200 text-amber-800'
                }`}
              >
                {warn.type === 'allergy' ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <HeartPulse className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-sm">{warn.title}</p>
                  <p className="leading-relaxed opacity-90">{warn.message}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/60 text-xs text-gray-600">
            💡 <span className="font-medium">Lưu ý:</span> Bạn có thể cập nhật lại hồ sơ dị ứng và bệnh lý trong mục{' '}
            <span className="font-semibold text-primary">Hồ sơ cá nhân</span> để nhận được khuyến nghị chính xác nhất.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 pt-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-100 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-rose-600 text-white font-semibold text-sm hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200 flex items-center justify-center gap-1.5"
          >
            <Check size={16} />
            Tôi hiểu, vẫn thêm
          </button>
        </div>
      </div>
    </div>
  );
};

export default AllergyWarningModal;
