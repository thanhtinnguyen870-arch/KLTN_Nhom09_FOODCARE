import OpenAI from 'openai';
import Food from '../models/Food.js';
import AIChat from '../models/AIChat.js';
import AIQuestionLog from '../models/AIQuestionLog.js';
import Order from '../models/Order.js';
import User from '../models/User.js';

const detectQuestionTopics = (text = '') => {
  const lower = text.toLowerCase();
  const topics = [];
  if (/tiểu đường|đường huyết|đái tháo đường/.test(lower)) topics.push('Tiểu đường');
  if (/giảm cân|béo|giảm mỡ|diet|eat clean|calo ít/.test(lower)) topics.push('Giảm cân / Eat Clean');
  if (/tăng cơ|gym|thể hình|đạm|protein|bulking/.test(lower)) topics.push('Tăng cơ / Gym');
  if (/chay|thuần chay|vegetable|vegetarian/.test(lower)) topics.push('Ăn chay');
  if (/huyết áp|tim mạch|cholesterol/.test(lower)) topics.push('Tim mạch / Huyết áp');
  if (/dạ dày|tiêu hóa|đau bụng/.test(lower)) topics.push('Dạ dày / Tiêu hóa');
  if (/đơn hàng|order|vận chuyển|giao hàng|shipper|ship|mua hàng/.test(lower)) topics.push('Đơn hàng & Giao vận');
  if (/cân nặng|chiều cao|bao nhiêu kg|thể trạng|bmi|hồ sơ|sức khỏe của tôi|dị ứng của tôi/.test(lower)) topics.push('Hồ sơ sức khỏe cá nhân');
  if (/thành phần|nguyên liệu|calo|protein|carb|fat|dinh dưỡng/.test(lower)) topics.push('Dinh dưỡng & Thành phần món');
  if (/chào|hi|hello|ơi|shop ơi/.test(lower)) topics.push('Chào hỏi / Xã giao');
  if (topics.length === 0) topics.push('Tư vấn món ăn');
  return topics;
};

const buildMessages = (systemPrompt, conversationHistory = [], message) => {
  const messages = [{ role: 'system', content: systemPrompt }];
  if (Array.isArray(conversationHistory)) {
    for (const chat of conversationHistory) {
      if (chat.user) {
        messages.push({ role: 'user', content: chat.user });
      }
      if (chat.assistant) {
        messages.push({ role: 'assistant', content: chat.assistant });
      }
    }
  }
  messages.push({ role: 'user', content: message });
  return messages;
};

const generateAIResponse = async (systemPrompt, conversationHistory, message) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('Chưa cấu hình GROQ_API_KEY trong file .env');
  }

  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
    timeout: 12000,
  });

  const invalidModels = new Set(['groq/compound-mini', 'qwen/qwen3.6-27b']);
  const configuredModel = process.env.GROQ_MODEL;
  const primaryModel = (configuredModel && !invalidModels.has(configuredModel))
    ? configuredModel
    : 'qwen/qwen3.8-27b';
  const backupModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'].filter((m) => m !== primaryModel);

  try {
    const completion = await groq.chat.completions.create({
      model: primaryModel,
      messages: buildMessages(systemPrompt, conversationHistory, message),
      temperature: 0.3,
      max_tokens: 1024,
    });

    return completion.choices[0].message.content;
  } catch (primaryError) {
    console.warn(`Groq model ${primaryModel} gặp lỗi:`, primaryError.message);

    for (const backupModel of backupModels) {
      try {
        console.log(`Đang thử lại với Groq backup model (${backupModel})...`);
        const backupCompletion = await groq.chat.completions.create({
          model: backupModel,
          messages: buildMessages(systemPrompt, conversationHistory, message),
          temperature: 0.3,
          max_tokens: 1024,
        });
        return backupCompletion.choices[0].message.content;
      } catch (backupError) {
        console.warn(`Groq backup model (${backupModel}) cũng gặp lỗi:`, backupError.message);
      }
    }

    throw primaryError;
  }
};

const extractRecommendedFoodNames = (aiResponseText) => {
  const recMatch = aiResponseText.match(/RECOMMENDATIONS:\s*(\[[\s\S]*?\]|.+)$/i);
  if (!recMatch?.[1]) {
    return { responseMessage: aiResponseText, recommendedFoodNames: [] };
  }

  const rawRecommendations = recMatch[1].trim();
  let recommendedFoodNames = [];

  if (rawRecommendations.startsWith('[')) {
    try {
      recommendedFoodNames = JSON.parse(rawRecommendations);
    } catch (error) {
      console.error('Error parsing AI recommendations', error);
    }
  }

  if (recommendedFoodNames.length === 0) {
    recommendedFoodNames = rawRecommendations
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((name) => name.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  return {
    responseMessage: aiResponseText.replace(/RECOMMENDATIONS:\s*(\[[\s\S]*?\]|.+)$/i, '').trim(),
    recommendedFoodNames,
  };
};

// @desc    Get AI Food Recommendation
// @route   POST /api/ai/recommend
// @access  Private
export const recommendFood = async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    const user = req.user;

    if (!message) {
      return res.status(400).json({ message: 'Vui long nhap cau hoi can tu van.' });
    }

    if (message.length > 1000) {
      return res.status(400).json({ message: 'Cau hoi vuot qua do dai cho phep (toi da 1000 ky tu).' });
    }

    // 1. TẢI DỮ LIỆU THỰC ĐƠN TOÀN DIỆN (Đầy đủ dinh dưỡng, nguyên liệu, trạng thái, đánh giá, lượt bán)
    const allFoods = await Food.find({})
      .populate('category', 'name')
      .select('name price discountPrice healthTags suitableFor warningFor nutrition ingredients isAvailable stock ratingAverage ratingCount soldCount category')
      .lean();

    const availableFoods = allFoods.filter((f) => f.isAvailable !== false);
    const unavailableFoods = allFoods.filter((f) => f.isAvailable === false);

    // Format thực đơn đang phục vụ
    const availableFoodContext = availableFoods.map((f) => {
      const nut = f.nutrition || {};
      const nutStr = `~${nut.calories || '?'} kcal (Đạm: ${nut.protein ?? '?'}g, Carb: ${nut.carbs ?? '?'}g, Béo: ${nut.fat ?? '?'}g)`;
      const ingrStr = f.ingredients?.length ? `Nguyên liệu: ${f.ingredients.join(', ')}` : '';
      const tagsStr = f.healthTags?.length ? `Thẻ: [${f.healthTags.join(', ')}]` : '';
      const suitStr = f.suitableFor?.length ? `Phù hợp: [${f.suitableFor.join(', ')}]` : '';
      const warnStr = f.warningFor?.length ? `Cảnh báo: [${f.warningFor.join(', ')}]` : '';
      const catStr = f.category?.name ? `Danh mục: ${f.category.name}` : '';
      const rateStr = f.ratingAverage > 0 ? `★ ${f.ratingAverage.toFixed(1)}/5 (${f.ratingCount || 0} đánh giá)` : '';
      const soldStr = f.soldCount > 0 ? `Đã bán: ${f.soldCount}` : '';

      return `- ${f.name} | Giá: ${(f.price || 0).toLocaleString()}đ | ${nutStr}` +
        `\n  ${[catStr, ingrStr, tagsStr, suitStr, warnStr, rateStr, soldStr].filter(Boolean).join(' | ')}`;
    }).join('\n');

    // Format danh sách món tạm hết
    const unavailableFoodContext = unavailableFoods.length > 0
      ? unavailableFoods.map((f) => `- ${f.name} [TẠM HẾT / HẾT HÀNG]`).join('\n')
      : '(Hiện tại không có món nào tạm hết)';

    // Nhận diện nhanh nếu khách hỏi đích danh món đang tạm hết
    const removeAccents = (str = '') =>
      str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim();

    const cleanMsg = removeAccents(message);
    const mentionedUnavailableFoods = unavailableFoods.filter((f) => {
      const cleanName = removeAccents(f.name);
      return cleanMsg.includes(cleanName) || message.toLowerCase().includes(f.name.toLowerCase());
    });

    let unavailableNotice = '';
    if (mentionedUnavailableFoods.length > 0) {
      const namesStr = mentionedUnavailableFoods.map((f) => `"${f.name}"`).join(', ');
      unavailableNotice = `\n⚠️ CẢNH BÁO: Khách hàng đang hỏi về món ${namesStr} - món này ĐANG TẠM HẾT trên hệ thống! BẮT BUỘC thông báo rõ ràng là tạm hết, KHÔNG được nói còn hàng và KHÔNG nhầm lẫn với bất kỳ món nào khác. Có thể gợi ý món thay thế tương tự đang có sẵn.`;
    }

    // 2. TẢI DỮ LIỆU NGƯỜI DÙNG & HỒ SƠ SỨC KHỎE CHI TIẾT
    const fullUser = await User.findById(user._id).populate('favoriteFoods', 'name price').lean();
    const hp = fullUser?.healthProfile || {};
    const healthParts = [];
    if (hp.age) healthParts.push(`Tuổi: ${hp.age}`);
    if (hp.gender) healthParts.push(`Giới tính: ${hp.gender === 'male' || hp.gender === 'Nam' ? 'Nam' : hp.gender === 'female' || hp.gender === 'Nữ' ? 'Nữ' : hp.gender}`);
    if (hp.height) healthParts.push(`Chiều cao: ${hp.height} cm`);
    if (hp.weight) healthParts.push(`Cân nặng: ${hp.weight} kg`);

    // Tính toán chỉ số BMI nếu có đủ chiều cao và cân nặng
    if (hp.weight && hp.height) {
      const hM = parseFloat(hp.height) / 100;
      const wKg = parseFloat(hp.weight);
      if (hM > 0 && wKg > 0) {
        const bmi = (wKg / (hM * hM)).toFixed(1);
        let bmiDesc = 'Bình thường';
        if (bmi < 18.5) bmiDesc = 'Thiếu cân';
        else if (bmi <= 22.9) bmiDesc = 'Lý tưởng (chuẩn WHO Châu Á)';
        else if (bmi <= 24.9) bmiDesc = 'Thừa cân / Tiền béo phì';
        else bmiDesc = 'Béo phì';
        healthParts.push(`Chỉ số BMI: ${bmi} (${bmiDesc})`);
      }
    }

    if (hp.goal) {
      const goalLabels = {
        maintain: 'Duy trì cân nặng & sức khỏe',
        weight_loss: 'Giảm mỡ / Giảm cân',
        muscle_gain: 'Tăng cân / Tăng cơ',
        eat_clean: 'Ăn Eat Clean thanh lọc cơ thể',
      };
      healthParts.push(`Mục tiêu: ${goalLabels[hp.goal] || hp.goal}`);
    }
    if (hp.dietType) healthParts.push(`Chế độ ăn: ${hp.dietType}`);
    if (hp.activityLevel) {
      const actLabels = {
        sedentary: 'Ít vận động (dân văn phòng)',
        light: 'Vận động nhẹ (1-3 ngày/tuần)',
        moderate: 'Vận động vừa (3-5 ngày/tuần)',
        very_active: 'Vận động nhiều (6-7 ngày/tuần)',
        extra_active: 'Vận động rất nhiều (VĐV/lao động nặng)',
      };
      healthParts.push(`Mức độ vận động: ${actLabels[hp.activityLevel] || hp.activityLevel}`);
    }
    if (hp.allergies?.length) healthParts.push(`Tiền sử dị ứng: ${Array.isArray(hp.allergies) ? hp.allergies.join(', ') : hp.allergies}`);
    if (hp.conditions?.length) healthParts.push(`Bệnh lý nền: ${Array.isArray(hp.conditions) ? hp.conditions.join(', ') : hp.conditions}`);

    const healthSummary = healthParts.length > 0
      ? healthParts.join(' | ')
      : 'Khách hàng chưa cập nhật hồ sơ sức khỏe';

    // Thông tin tài khoản & thành viên
    const accountInfo = [
      `Hạng thành viên: ${fullUser?.tier || 'Thành viên'}`,
      `Tổng chi tiêu: ${(fullUser?.totalSpent || 0).toLocaleString('vi-VN')}đ`,
      fullUser?.favoriteFoods?.length ? `Món yêu thích: ${fullUser.favoriteFoods.map((f) => f.name).join(', ')}` : 'Chưa lưu món yêu thích',
    ].join(' | ');

    // 3. TẢI ĐƠN HÀNG GẦN ĐÂY CỦA KHÁCH HÀNG (Để AI trả lời chính xác khi khách hỏi đơn)
    const recentOrders = await Order.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    const statusMap = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      preparing: 'Đang chuẩn bị món',
      shipping: 'Đang giao hàng',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy',
    };

    const recentOrdersContext = recentOrders.length > 0
      ? recentOrders.map((ord) => {
        const orderCode = ord._id.toString().slice(-6).toUpperCase();
        const dateStr = ord.createdAt ? new Date(ord.createdAt).toLocaleString('vi-VN') : '';
        const itemsStr = ord.items?.map((it) => `${it.name} (x${it.quantity})`).join(', ') || '';
        const totalStr = `${(ord.totalAmount || 0).toLocaleString('vi-VN')}đ`;
        const payStr = `${ord.paymentMethod} (${ord.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'})`;
        const stStr = statusMap[ord.orderStatus] || ord.orderStatus;
        return `• Mã #${orderCode} | Trạng thái: [${stStr}] | Đặt lúc: ${dateStr} | Món: ${itemsStr} | Tổng tiền: ${totalStr} | Thanh toán: ${payStr}`;
      }).join('\n')
      : 'Khách hàng chưa có đơn hàng nào gần đây.';

    // 4. LẤY LỊCH SỬ CHAT GẦN NHẤT
    const recentChats = await AIChat.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();
    recentChats.reverse();

    const conversationHistory = recentChats.map((c) => ({
      user: c.message,
      assistant: c.response,
    }));

    // 5. SYSTEM PROMPT TOÀN DIỆN CỦA HỆ THỐNG FOODCARE
    const systemPrompt = `Bạn là Trợ lý AI Chuyên Gia Dinh Dưỡng & Vận Hành của FoodCare (hệ thống nhà hàng ẩm thực dinh dưỡng & cá nhân hóa sức khỏe hàng đầu).
Bạn nắm toàn bộ cơ sở dữ liệu và chính sách hoạt động của hệ thống FoodCare.

════════════════════════════════════════════════════════════
THÔNG TIN KHÁCH HÀNG HIỆN TẠI:
• Tên khách hàng: ${fullUser?.name || 'Quý khách'} (Email: ${fullUser?.email || ''})
• Tài khoản & Cấp bậc: ${accountInfo}
• Hồ sơ thể trạng & sức khỏe: ${healthSummary}
• Đơn hàng gần nhất:
${recentOrdersContext}${unavailableNotice}

════════════════════════════════════════════════════════════
THỰC ĐƠN ĐANG PHỤC VỤ (CÒN HÀNG - CÓ THỂ ĐẶT MÓN):
${availableFoodContext}

════════════════════════════════════════════════════════════
DANH SÁCH MÓN TẠM HẾT (HẾT HÀNG - KHÔNG THỂ ĐẶT MÓN):
${unavailableFoodContext}

════════════════════════════════════════════════════════════
THÔNG TIN CỬA HÀNG & CHÍNH SÁCH DỊCH VỤ FOODCARE:
• Giờ mở cửa: 07:00 - 22:00 mỗi ngày từ Thứ Hai đến Chủ Nhật.
• Tốc độ giao hàng: Giao hàng hỏa tốc trong 25 - 45 phút, đóng gói bảo ôn giữ nhiệt độ tối ưu.
• Phí giao hàng: Miễn phí vận chuyển (Freeship) cho đơn hàng từ 200.000đ hoặc khách hàng đạt hạng Vàng / Kim Cương.
• Phương thức thanh toán: Tiền mặt khi nhận hàng (COD), Ví điện tử MoMo (quét mã QR tức thì), Chuyển khoản ngân hàng.
• Chính sách thành viên:
  - Hạng Thành viên: Tích lũy chi tiêu trên mỗi đơn.
  - Hạng Vàng (Tổng chi tiêu ≥ 1.000.000đ): Giảm giá 5% mọi đơn hàng, ưu tiên chuẩn bị món.
  - Hạng Kim Cương (Tổng chi tiêu ≥ 3.000.000đ): Giảm giá 10% trọn đời, quà tặng sinh nhật đặc quyền.
• Cam kết chất lượng: 100% nguyên liệu tươi sạch chuẩn VietGAP, công thức được thẩm định bởi chuyên gia dinh dưỡng, hệ thống cảnh báo dị ứng tự động bảo vệ thực khách.

════════════════════════════════════════════════════════════
HƯỚNG DẪN XỬ LÝ THEO TỪNG NHÓM CÂU HỎI (QUY CHUẨN ĐẶC BIỆT):

1. KHÁCH HỎI VỀ BẢN THÂN / THỂ TRẠNG / CÂN NẶNG / CHIỀU CAO / BMI / DỊ ỨNG:
   - Trả lời chính xác các số liệu đã lưu: Cân nặng (${hp.weight ? hp.weight + ' kg' : 'chưa cập nhật'}), Chiều cao (${hp.height ? hp.height + ' cm' : 'chưa cập nhật'}), chỉ số BMI kèm phân loại (lý tưởng, thừa cân...), mục tiêu sức khỏe và danh sách dị ứng.
   - Nếu khách chưa cập nhật trường nào, nhẹ nhàng hướng dẫn khách vào trang "Hồ sơ cá nhân" (/profile) để cập nhật.
   - Dòng cuối cùng: RECOMMENDATIONS: []

2. KHÁCH HỎI VỀ ĐƠN HÀNG CỦA HỌ (ví dụ: "đơn hàng của tôi thế nào", "tôi vừa đặt món gì", "đơn gần nhất đang giao chưa", "tổng chi tiêu của tôi"):
   - Dựa vào phần "Đơn hàng gần nhất" ở trên để báo chính xác: Mã đơn (#...), trạng thái hiện tại (Đang chuẩn bị / Đang giao...), các món đã đặt, tổng tiền và trạng thái thanh toán.
   - Dòng cuối cùng: RECOMMENDATIONS: []

3. KHÁCH HỎI VỀ NGUYÊN LIỆU / THÀNH PHẦN / DINH DƯỠNG CỤ THỂ CỦA MÓN ĂN:
   - Đọc chính xác từ danh sách THỰC ĐƠN: Nêu rõ lượng calo, protein, carb, fat và danh sách nguyên liệu của món đó.
   - Báo rõ món đó có phù hợp với người bị dị ứng hay ăn kiêng không.
   - Dòng cuối cùng: RECOMMENDATIONS: ["Tên món"]

4. KHÁCH HỎI MÓN NÀO BÁN CHẠY NHẤT / ĐƯỢC ĐÁNH GIÁ CAO NHẤT / MÓN CHAY / MÓN THEO DANH MỤC:
   - Dựa vào điểm đánh giá (★), số lượt bán (Đã bán) và danh mục trong thực đơn để gợi ý 2-3 món tốt nhất.
   - Dòng cuối cùng: RECOMMENDATIONS: ["Tên món 1", "Tên món 2"]

5. KHÁCH HỎI MÓN CÒN HAY HẾT:
   - Đối chiếu chính xác: Nếu món thuộc "DANH SÁCH MÓN TẠM HẾT", báo ngay là đã TẠM HẾT và gợi ý món tương tự đang có sẵn. Tuyệt đối KHÔNG nhầm lẫn tên món (ví dụ: "Cơm khoai lang gà cải xanh" là TẠM HẾT, khác với "Gà ta khoai lang cải xanh").
   - Nếu có sẵn, báo giá và calo để khách đặt.

6. KHÁCH CẦN TƯ VẤN THỰC ĐƠN / DINH DƯỠNG / BỆNH LÝ (tiểu đường, giảm cân, gym, huyết áp...):
   - ĐỐI CHIẾU VỚI TIỀN SỬ DỊ ỨNG CỦA KHÁCH: TUYỆT ĐỐI KHÔNG gợi ý món có chứa nguyên liệu khách bị dị ứng!
   - Tư vấn khoa học, in đậm **Tên món**, giải thích lý do vì sao phù hợp.
   - Thêm câu khuyến cáo: "⚠️ Tham khảo ý kiến chuyên gia/bác sĩ trước khi thay đổi chế độ dinh dưỡng đặc biệt."
   - Dòng cuối cùng: RECOMMENDATIONS: ["Tên món 1", "Tên món 2"]

7. KHÁCH HỎI VỀ CỬA HÀNG / GIỜ MỞ CỬA / PHÍ SHIP / THANH TOÁN / ƯU ĐÃI THÀNH VIÊN:
   - Trả lời đúng theo THÔNG TIN CỬA HÀNG & CHÍNH SÁCH DỊCH VỤ ở trên.
   - Dòng cuối cùng: RECOMMENDATIONS: []

8. KHÁCH CHÀO HỎI / XÃ GIAO:
   - Chào nhiệt tình, lịch sự, giới thiệu vai trò và hỏi khách cần hỗ trợ gì. KHÔNG tự động liệt kê danh sách món khi chưa được hỏi.
   - Dòng cuối cùng: RECOMMENDATIONS: []

QUY TẮC BẮT BUỘC:
• Trả lời súc tích, văn phong chuyên nghiệp, ấm áp, lịch thiệp bằng tiếng Việt chuẩn mực (tối đa 150-200 từ).
• In đậm tên món: **Tên món**.
• Mảng RECOMMENDATIONS ở dòng cuối cùng chỉ chứa tên chính xác của món CÒN HÀNG, không bịa tên món.`;

    let aiResponseText;
    try {
      aiResponseText = await generateAIResponse(systemPrompt, conversationHistory, message);
    } catch (apiError) {
      console.warn('AI API Error (Fallback triggered):', apiError.message);
      const fallbackFoods = availableFoods.slice(0, 3);
      const fallbackNames = fallbackFoods.map(f => f.name);
      aiResponseText = `Máy chủ AI tạm thời quá tải. Gợi ý nhanh cho bạn:\n\n${fallbackFoods.map(f => `- **${f.name}**`).join('\n')}\n\n⚠️ Tham khảo bác sĩ trước khi thay đổi chế độ ăn.\nRECOMMENDATIONS: ${JSON.stringify(fallbackNames)}`;
    }

    const { responseMessage, recommendedFoodNames } = extractRecommendedFoodNames(aiResponseText);

    let recommendedFoods = [];
    if (recommendedFoodNames.length > 0) {
      const regexPatterns = recommendedFoodNames.map(
        (name) => new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      );
      // Chỉ lấy các món ĐANG CÓ SẴN (isAvailable: true) để hiển thị card trong chat
      const foodsInDb = await Food.find({
        name: { $in: regexPatterns },
        isAvailable: { $ne: false },
      }).select('_id');
      recommendedFoods = foodsInDb.map(f => f._id);
    }

    // Lưu lịch sử chat (người dùng có thể xem và tự xóa)
    const chat = await AIChat.create({ user: user._id, message, response: responseMessage, recommendedFoods });

    // Lưu vĩnh viễn vào bảng log câu hỏi (AIQuestionLog - độc lập, không bị xóa theo lịch sử chat của user)
    AIQuestionLog.create({
      user: user._id,
      userName: user.name || 'Khách hàng',
      userEmail: user.email || '',
      question: message,
      aiResponse: responseMessage,
      topics: detectQuestionTopics(message),
      recommendedFoods,
    }).catch((logErr) => console.error('Lỗi khi lưu AIQuestionLog:', logErr.message));

    // Trả về kèm thông tin món ăn
    const populatedChat = await AIChat.findById(chat._id).populate('recommendedFoods', 'name images price nutrition healthTags');

    res.json(populatedChat);
  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ message: 'Lỗi khi gọi AI hoặc cấu hình API Key chưa chính xác.' });
  }
};

// @desc    Get Chat History
// @route   GET /api/ai/history
// @access  Private (User gets own chats; Admin can get all chats with ?all=true or ?userId=...)
export const getChatHistory = async (req, res) => {
  try {
    let filter = { user: req.user._id };

    // Nếu là admin và có query all=true hoặc userId thì cho phép xem toàn bộ
    if (req.user.role === 'admin' && (req.query.all === 'true' || req.query.userId)) {
      filter = req.query.userId ? { user: req.query.userId } : {};
    }

    const history = await AIChat.find(filter)
      .populate('user', 'name email avatar')
      .populate('recommendedFoods', 'name images price nutrition healthTags')
      .sort({ createdAt: -1 });

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a single chat entry
// @route   DELETE /api/ai/history/:id
// @access  Private (User can delete own chat, Admin can delete any)
export const deleteChatEntry = async (req, res) => {
  try {
    const chat = await AIChat.findById(req.params.id);
    if (!chat) return res.status(404).json({ message: 'Không tìm thấy cuộc trò chuyện.' });

    // Người dùng chỉ được xóa lịch sử của chính mình, Admin có thể xóa bất kỳ
    if (chat.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền xóa cuộc trò chuyện này.' });
    }

    await chat.deleteOne();
    res.json({ message: 'Đã xóa cuộc trò chuyện thành công.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Clear chat history
// @route   DELETE /api/ai/history
// @access  Private (User clears own chats, Admin can clear all or specific user)
export const clearChatHistory = async (req, res) => {
  try {
    let filter = { user: req.user._id };

    if (req.user.role === 'admin') {
      if (req.query.all === 'true') {
        filter = {};
      } else if (req.query.userId) {
        filter = { user: req.query.userId };
      }
    }

    const result = await AIChat.deleteMany(filter);
    res.json({ message: `Đã xóa ${result.deletedCount} cuộc trò chuyện.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get AI Question Logs (for Admin analytics & management)
// @route   GET /api/ai/logs
// @access  Private/Admin
export const getAIQuestionLogs = async (req, res) => {
  try {
    const pageSize = Math.min(Number(req.query.limit) || 20, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const topic = req.query.topic;
    const search = req.query.search;

    const query = {};
    if (topic && topic !== 'all') {
      query.topics = topic;
    }
    if (search) {
      query.$or = [
        { question: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const count = await AIQuestionLog.countDocuments(query);
    const logs = await AIQuestionLog.find(query)
      .populate('user', 'name email avatar phone')
      .populate('recommendedFoods', 'name price images nutrition')
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    res.json({
      logs,
      page,
      pages: Math.ceil(count / pageSize),
      total: count,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a single AI question log (Admin only)
// @route   DELETE /api/ai/logs/:id
// @access  Private/Admin
export const deleteAIQuestionLog = async (req, res) => {
  try {
    const log = await AIQuestionLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ message: 'Không tìm thấy nhật ký câu hỏi.' });
    }
    await log.deleteOne();
    res.json({ message: 'Đã xóa nhật ký câu hỏi AI thành công.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Clear all AI question logs (Admin only)
// @route   DELETE /api/ai/logs
// @access  Private/Admin
export const clearAIQuestionLogs = async (req, res) => {
  try {
    const result = await AIQuestionLog.deleteMany({});
    res.json({ message: `Đã xóa toàn bộ ${result.deletedCount} nhật ký câu hỏi AI.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

