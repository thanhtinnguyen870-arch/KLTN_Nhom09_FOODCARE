import { useMemo } from 'react';
import { Flame, Zap, Scale, Heart, Sparkles, AlertCircle, Info } from 'lucide-react';
import { calculateMacroGoals } from '../utils/nutritionCalculator';

const NutritionTargetCard = ({ healthProfile }) => {
  const result = useMemo(() => {
    return calculateMacroGoals(healthProfile);
  }, [healthProfile]);

  if (!result) {
    return (
      <div className="rounded-3xl border border-dashed border-gray-300 bg-amber-50/50 p-6 text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <h4 className="font-bold text-gray-800 text-base">Chưa đủ dữ liệu tính toán chỉ số dinh dưỡng</h4>
        <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
          Vui lòng cập nhật đầy đủ <span className="font-semibold text-gray-700">Tuổi, Cân nặng, Chiều cao và Giới tính</span> trong hồ sơ bên dưới để hệ thống tính toán TDEE và mục tiêu dinh dưỡng cá nhân hóa.
        </p>
      </div>
    );
  }

  const { bmr, tdee, targetCalories, bmi, bmiCategory, bmiColor, macros } = result;

  return (
    <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/30 p-6 md:p-8 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={13} /> Chuẩn Y Khoa Mifflin-St Jeor
            </span>
          </div>
          <h3 className="text-xl md:text-2xl font-black text-gray-900 mt-1">
            Chỉ Số Năng Lượng & Dinh Dưỡng Mục Tiêu
          </h3>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center px-3.5 py-2 rounded-2xl bg-white border border-gray-200/80 shadow-sm text-xs font-medium text-gray-600">
          <Info size={14} className="text-primary" />
          <span>Cá nhân hóa theo thể trạng của bạn</span>
        </div>
      </div>

      {/* 4 Cards Thống kê chính */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* BMI */}
        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold text-gray-500">Chỉ số BMI</span>
            <Scale size={18} className="text-indigo-500" />
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-black text-gray-900">{bmi}</span>
            <span className="text-xs text-gray-400 ml-1">kg/m²</span>
          </div>
          <p className={`text-xs font-bold mt-2 truncate ${bmiColor}`}>{bmiCategory}</p>
        </div>

        {/* BMR */}
        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold text-gray-500">BMR (Cơ bản)</span>
            <Zap size={18} className="text-amber-500" />
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-black text-gray-900">{bmr.toLocaleString()}</span>
            <span className="text-xs text-gray-400 ml-1">kcal/ngày</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Năng lượng duy trì sự sống</p>
        </div>

        {/* TDEE */}
        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold text-gray-500">TDEE (Tiêu thụ)</span>
            <Flame size={18} className="text-orange-500" />
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-black text-gray-900">{tdee.toLocaleString()}</span>
            <span className="text-xs text-gray-400 ml-1">kcal/ngày</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Đã tính hệ số vận động</p>
        </div>

        {/* Target Calories */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-100 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Khuyến nghị nạp</span>
            <Heart size={18} className="text-white fill-white/20" />
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-black">{targetCalories.toLocaleString()}</span>
            <span className="text-xs text-emerald-100 ml-1">kcal/ngày</span>
          </div>
          <p className="text-[11px] text-emerald-100 font-medium mt-2">Tối ưu theo mục tiêu của bạn</p>
        </div>
      </div>

      {/* Phân bổ Macronutrients (Đạm, Béo, Tinh bột) */}
      <div className="p-5 md:p-6 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-800 text-sm md:text-base">
            Phân Bổ Dinh Dưỡng Đa Lượng (Macronutrients Target)
          </h4>
          <span className="text-xs text-gray-400">100% Khẩu phần</span>
        </div>

        {/* Visual Progress Bar */}
        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${macros.protein.percent}%` }}
            className="bg-blue-500 transition-all duration-500"
            title={`Chất đạm: ${macros.protein.percent}%`}
          />
          <div
            style={{ width: `${macros.fat.percent}%` }}
            className="bg-amber-400 transition-all duration-500"
            title={`Chất béo: ${macros.fat.percent}%`}
          />
          <div
            style={{ width: `${macros.carbs.percent}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`Tinh bột: ${macros.carbs.percent}%`}
          />
        </div>

        {/* Macro Details Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Protein */}
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
            <div>
              <span className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                Chất đạm (Protein)
              </span>
              <p className="text-lg font-black text-blue-900 mt-1">{macros.protein.grams}g</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-blue-600">{macros.protein.percent}%</span>
              <p className="text-[10px] text-gray-400">{macros.protein.calories} kcal</p>
            </div>
          </div>

          {/* Fat */}
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center justify-between">
            <div>
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                Chất béo (Fat)
              </span>
              <p className="text-lg font-black text-amber-900 mt-1">{macros.fat.grams}g</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-amber-600">{macros.fat.percent}%</span>
              <p className="text-[10px] text-gray-400">{macros.fat.calories} kcal</p>
            </div>
          </div>

          {/* Carbs */}
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
            <div>
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Tinh bột (Carbs)
              </span>
              <p className="text-lg font-black text-emerald-900 mt-1">{macros.carbs.grams}g</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-emerald-600">{macros.carbs.percent}%</span>
              <p className="text-[10px] text-gray-400">{macros.carbs.calories} kcal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NutritionTargetCard;
