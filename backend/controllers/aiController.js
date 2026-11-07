import OpenAI from 'openai';
import Food from '../models/Food.js';
import AIChat from '../models/AIChat.js';
import AIQuestionLog from '../models/AIQuestionLog.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Category from '../models/Category.js';

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

// Cấu hình tối ưu theo khuyến nghị kỹ thuật:
// Gemini OpenAI endpoint tính max_tokens kèm prompt tokens, đặt 4096 để tránh bị chặt cụt giữa chừng
const GEMINI_CONFIG = {
  temperature: 0.2,
  top_p: 0.85,
  max_tokens: 4096,
};

// Groq hỗ trợ đầy đủ các tham số penalty chống lặp từ
const GROQ_CONFIG = {
  temperature: 0.2,
  top_p: 0.85,
  frequency_penalty: 0.5,
  presence_penalty: 0.3,
  max_tokens: 1500,
};

const generateAIResponse = async (systemPrompt, conversationHistory, message) => {
  const messages = buildMessages(systemPrompt, conversationHistory, message);

  // 1. Ưu tiên Google Gemini (Tốc độ xử lý tiếng Việt vượt trội, hạn ngạch token lớn)
  if (process.env.GEMINI_API_KEY) {
    try {
      const gemini = new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        timeout: 25000,
      });
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const completion = await gemini.chat.completions.create({
        model,
        messages,
        ...GEMINI_CONFIG,
      });

      const content = completion.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return content.trim();
      }
      console.warn('Gemini trả về nội dung rỗng, chuẩn bị chuyển sang Groq fallback...');
    } catch (geminiError) {
      console.warn('Gemini gặp lỗi:', geminiError.message, '-> Đang chuyển sang Groq fallback...');
    }
  }

  // 2. Dự phòng (Fallback) với Groq
  if (process.env.GROQ_API_KEY) {
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      timeout: 25000,
    });

    const candidateModels = [process.env.GROQ_MODEL, 'qwen/qwen3.8-27b']
      .filter(Boolean)
      .filter((m, idx, arr) => arr.indexOf(m) === idx);

    for (const model of candidateModels) {
      try {
        const backupCompletion = await groq.chat.completions.create({
          model,
          messages,
          ...GROQ_CONFIG,
        });

        const content = backupCompletion.choices?.[0]?.message?.content;
        if (content && content.trim()) {
          return content.trim();
        }
      } catch (backupError) {
        console.warn(`Groq backup model (${model}) gặp lỗi:`, backupError.message);
      }
    }
  }

  throw new Error('Không thể kết nối đến cả dịch vụ Gemini lẫn Groq AI.');
};

const extractRecommendedFoodNames = (aiResponseText, availableFoods = []) => {
  const recMatch = aiResponseText.match(/(?:\*{0,2})RECOMMENDATIONS(?:\*{0,2})\s*:\s*(\[[\s\S]*?\]|.+)$/i);
  let rawRecommendations = recMatch?.[1] ? recMatch[1].trim().replace(/^```(?:json)?|```$/g, '').trim() : '';
  let recommendedFoodNames = [];

  if (rawRecommendations.startsWith('[')) {
    try {
      recommendedFoodNames = JSON.parse(rawRecommendations);
    } catch (error) {
      console.error('Error parsing AI recommendations', error);
    }
  }

  if (recommendedFoodNames.length === 0 && rawRecommendations) {
    recommendedFoodNames = rawRecommendations
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((name) => name.trim().replace(/^["'*]+|["'*]+$/g, ''))
      .filter(Boolean);
  }

  // Fallback an toàn: Nếu AI bị ngắt cụt mất dòng RECOMMENDATIONS, tự động quét tên món in đậm trong văn bản
  if (recommendedFoodNames.length === 0 && Array.isArray(availableFoods) && availableFoods.length > 0) {
    const boldMatches = aiResponseText.match(/\*\*([^*]+)\*\*/g) || [];
    for (const bold of boldMatches) {
      const cleanBold = bold.replace(/\*\*/g, '').trim();
      const found = availableFoods.find(f => f.name.toLowerCase() === cleanBold.toLowerCase());
      if (found && !recommendedFoodNames.includes(found.name)) {
        recommendedFoodNames.push(found.name);
      }
    }
    // Nếu vẫn chưa có và không phải câu chào/xã giao/từ chối
    if (recommendedFoodNames.length === 0 && !/chào|hẹn gặp|thời tiết|chúc bạn/i.test(aiResponseText)) {
      for (const f of availableFoods) {
        if (aiResponseText.includes(f.name) && !recommendedFoodNames.includes(f.name)) {
          recommendedFoodNames.push(f.name);
          if (recommendedFoodNames.length >= 3) break;
        }
      }
    }
  }

  return {
    responseMessage: aiResponseText.replace(/(?:\n|^)\s*(?:\*{0,2})RECOMMENDATIONS(?:\*{0,2})\s*:[\s\S]*$/i, '').trim(),
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

    // Gửi TOÀN BỘ menu cho AI tự lọc ngữ nghĩa — 58 món ≈ 2,500 tokens, nằm trong giới hạn
    // Gemini 2.5 Flash (1M token context). Không còn regex brittle, AI tự hiểu ý định user.
    //
    // Format mỗi món: tên | danh mục | giá | calo, đạm, carb, fat | tags | thành phần chính |
    //                  phù hợp với | cảnh báo | ★rating (lượt bán)
    //
    // Nhóm theo danh mục để AI nhận diện category nhanh hơn.
    const groupByCategory = (foods) => {
      const map = {};
      for (const f of foods) {
        const cat = f.category?.name || 'Khác';
        if (!map[cat]) map[cat] = [];
        map[cat].push(f);
      }
      return map;
    };

    const formatFoodLine = (f) => {
      const nut = f.nutrition || {};
      const priceStr = f.discountPrice && f.discountPrice < f.price
        ? `${Math.round(f.discountPrice / 1000)}k (gốc ${Math.round(f.price / 1000)}k)`
        : `${Math.round((f.price || 0) / 1000)}k`;
      const nutStr = [
        nut.calories ? `${nut.calories}cal` : '',
        nut.protein  ? `đạm${nut.protein}g` : '',
      ].filter(Boolean).join(' ');
      const tags    = f.healthTags?.slice(0, 2).join(', ') || '';
      const ingr    = f.ingredients?.slice(0, 3).map((i) => i.replace(/\s*\(.*?\)/g, '').trim()).join(', ') || '';
      const parts = [
        `• ${f.name} | ${priceStr}`,
        nutStr    && `[${nutStr}]`,
        tags      && `tag:${tags}`,
        ingr      && `TP:${ingr}`,
      ].filter(Boolean).join(' | ');
      return parts;
    };

    // Sắp xếp món trong mỗi danh mục theo độ phổ biến (rating × soldCount)
    // → AI ưu tiên gợi ý món bán chạy / được đánh giá cao hơn mặc định
    const sortByPopularity = (foods) =>
      [...foods].sort((a, b) => {
        const scoreA = (a.ratingAverage || 0) * Math.log1p(a.soldCount || 0);
        const scoreB = (b.ratingAverage || 0) * Math.log1p(b.soldCount || 0);
        return scoreB - scoreA;
      });

    const grouped = groupByCategory(availableFoods);
    const availableFoodContext = Object.entries(grouped)
      .map(([cat, foods]) => `[${cat}]\n${sortByPopularity(foods).map(formatFoodLine).join('\n')}`)
      .join('\n\n');

    // Format danh sách món tạm hết gọn gàng
    const unavailableFoodContext = unavailableFoods.length > 0
      ? unavailableFoods.map((f) => f.name).join(', ')
      : 'Không có món nào tạm hết';

    // Nhận diện nhanh nếu khách hỏi đích danh món đang tạm hết
    const removeAccents = (str = '') =>
      str.replace(/đ/gi, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

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

    let bmiValue = '';
    let bmiDesc = '';
    if (hp.weight && hp.height) {
      const hM = parseFloat(hp.height) / 100;
      const wKg = parseFloat(hp.weight);
      if (hM > 0 && wKg > 0) {
        bmiValue = (wKg / (hM * hM)).toFixed(1);
        if (bmiValue < 18.5) bmiDesc = 'Thiếu cân';
        else if (bmiValue <= 22.9) bmiDesc = 'Lý tưởng (chuẩn WHO Châu Á)';
        else if (bmiValue <= 24.9) bmiDesc = 'Thừa cân / Tiền béo phì';
        else bmiDesc = 'Béo phì';
      }
    }

    const goalLabels = {
      maintain: 'Duy trì cân nặng & sức khỏe',
      weight_loss: 'Giảm mỡ / Giảm cân',
      muscle_gain: 'Tăng cân / Tăng cơ',
      eat_clean: 'Ăn Eat Clean thanh lọc cơ thể',
    };

    const userMetrics = [
      `Chiều cao: ${hp.height ? hp.height + ' cm' : 'Chưa cập nhật'}`,
      `Cân nặng: ${hp.weight ? hp.weight + ' kg' : 'Chưa cập nhật'}`,
      bmiValue ? `BMI: ${bmiValue} (${bmiDesc})` : 'BMI: Chưa cập nhật',
      hp.age ? `Tuổi: ${hp.age}` : null,
      hp.gender ? `Giới tính: ${hp.gender === 'male' || hp.gender === 'Nam' ? 'Nam' : hp.gender === 'female' || hp.gender === 'Nữ' ? 'Nữ' : hp.gender}` : null,
    ].filter(Boolean).join(' | ');

    const healthGoal = goalLabels[hp.goal] || hp.goal || 'Chưa cập nhật';
    const healthConditions = hp.conditions?.length
      ? (Array.isArray(hp.conditions) ? hp.conditions.join(', ') : hp.conditions)
      : 'Không có ghi nhận / Bình thường';
    const allergies = hp.allergies?.length
      ? (Array.isArray(hp.allergies) ? hp.allergies.join(', ') : hp.allergies)
      : 'Không có ghi nhận dị ứng';

    // Thông tin tài khoản & thành viên
    const accountInfo = [
      `Tên khách hàng: ${fullUser?.name || 'Bạn'}`,
      `Hạng thành viên: ${fullUser?.tier || 'Thành viên'}`,
      `Tổng chi tiêu: ${(fullUser?.totalSpent || 0).toLocaleString('vi-VN')}đ`,
      fullUser?.favoriteFoods?.length ? `Món yêu thích: ${fullUser.favoriteFoods.map((f) => f.name).join(', ')}` : 'Chưa lưu món yêu thích',
    ].join(' | ');

    // 3. TẢI ĐƠN HÀNG GẦN ĐÂY CỦA KHÁCH HÀNG (Giới hạn gọn nhẹ để tránh phình token)
    const recentOrders = await Order.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(2)
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
        const itemsStr = ord.items?.slice(0, 4).map((it) => `${it.name} (x${it.quantity})`).join(', ') || '';
        const totalStr = `${(ord.totalAmount || 0).toLocaleString('vi-VN')}đ`;
        const payStr = `${ord.paymentMethod} (${ord.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'})`;
        const stStr = statusMap[ord.orderStatus] || ord.orderStatus;
        return `• Mã #${orderCode} | Trạng thái: [${stStr}] | Đặt lúc: ${dateStr} | Món: ${itemsStr} | Tổng tiền: ${totalStr} | Thanh toán: ${payStr}`;
      }).join('\n')
      : 'Khách hàng chưa có đơn hàng nào gần đây.';

    // 4. LẤY LỊCH SỬ CHAT GẦN NHẤT & TỔNG HỢP MÓN ĐÃ TỪNG GỢI Ý (CHỐNG LẶP MÓN VÀ LẶP TỪ TUYỆT ĐỐI)
    const recentChats = await AIChat.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('recommendedFoods', 'name')
      .lean();
    recentChats.reverse();

    // Tập hợp danh sách các món ăn đã được gợi ý trong các câu chat gần đây để đưa vào danh sách cấm lặp
    const previouslyRecommendedSet = new Set();
    for (const c of recentChats) {
      if (Array.isArray(c.recommendedFoods)) {
        for (const rf of c.recommendedFoods) {
          if (rf?.name) previouslyRecommendedSet.add(rf.name.trim());
        }
      }
      const resText = c.response || '';
      for (const f of availableFoods) {
        if (resText.includes(f.name)) {
          previouslyRecommendedSet.add(f.name.trim());
        }
      }
    }
    const alreadyRecommendedList = Array.from(previouslyRecommendedSet);

    const cleanHistoryText = (text = '') =>
      String(text)
        .replace(/(?:\n|^)\s*(?:\*{0,2})RECOMMENDATIONS(?:\*{0,2})\s*:[\s\S]*$/i, '')
        .trim();

    // Giữ 6 tin nhắn gần nhất để giữ ngữ cảnh gọn gàng, súc tích (chống tràn token)
    const conversationHistory = recentChats.slice(-6)
      .map((c) => ({
        user: c.message ? String(c.message).slice(0, 300) : '',
        assistant: c.response ? cleanHistoryText(c.response).slice(0, 450) : '',
      }))
      .filter((c) => Boolean(c.user && c.assistant));

    const isOngoingConversation = conversationHistory.length > 0;
    const conversationFlowConstraint = isOngoingConversation
      ? `\n⚠️ QUY TẮC BẮT BUỘC KHI ĐANG TRONG CUỘC HỘI THOẠI (Lượt chat tiếp theo):
- TUYỆT ĐỐI CẤM chào hỏi lại (CẤM các từ: "Chào anh...", "Chào bạn...", "Xin chào...", "FoodCare rất vui...", "FoodCare xin giới thiệu...", "Chào [Tên]...").
- KHÔNG lặp lại tên khách hàng hoặc xin lỗi rườm rà.
- BẮT BUỘC ĐI THẲNG VÀO NỘI DUNG hoặc danh sách món mới ngay từ từ đầu tiên của câu đầu tiên!`
      : `LƯỢT CHAT ĐẦU TIÊN: Có thể chào hỏi thân thiện trong 1 câu ngắn gọn rồi đi thẳng vào tư vấn.`;

    const previouslyRecommendedConstraint = alreadyRecommendedList.length > 0
      ? `\n⚠️ DANH SÁCH MÓN ĐÃ GỢI Ý CHO KHÁCH TRONG CÁC LƯỢT TRƯỚC: [${alreadyRecommendedList.join(', ')}]
=> NGUYÊN TẮC CHỐNG LẶP MÓN (BẮT BUỘC): Khách hàng ghét nhất bị lặp món! Khi khách hỏi "còn món nào khác không", "đổi món", "ngoài ra...", "bị lặp món", hoặc tiếp tục yêu cầu món ăn:
+ TUYỆT ĐỐI CẤM gợi ý lại bất kỳ món nào đã có trong danh sách trên.
+ BẮT BUỘC chọn 100% món MỚI HOÀN TOÀN từ thực đơn hiện có.`
      : '';

    // 5. SYSTEM PROMPT THEO QUY TRÌNH XỬ LÝ & PHÂN LOẠI Ý ĐỊNH
    const systemPrompt = `# VAI TRÒ & ĐỊNH DANH
Bạn là "Trợ lý Dinh dưỡng AI của FoodCare" – chuyên gia tư vấn thực đơn lành mạnh và chăm sóc khách hàng trên website thương mại điện tử FoodCare.
${conversationFlowConstraint}
${previouslyRecommendedConstraint}

# DỮ LIỆU ĐẦU VÀO THỜI GIAN THỰC (CONTEXT)
1. Hồ sơ sức khỏe của khách hàng hiện tại:
- Chỉ số cơ thể (Chiều cao / Cân nặng / BMI): ${userMetrics}
- Mục tiêu sức khỏe: ${healthGoal} (Giảm cân / Tăng cơ / Giữ dáng / Kiểm soát bệnh lý)
- Tình trạng sức khỏe / Bệnh lý: ${healthConditions} (Tiểu đường, dạ dày, huyết áp, tập gym...)
- Dị ứng thực phẩm / Món kiêng kỵ: ${allergies}
- Thông tin tài khoản: ${accountInfo}
- Đơn hàng gần nhất của khách:
${recentOrdersContext}${unavailableNotice}

2. Thực đơn hiện có tại FoodCare (Tên món | Phân loại | Giá | Calo & Macro | Thành phần):
${availableFoodContext}

Danh sách món tạm hết (KHÔNG THỂ ĐẶT MÓN):
${unavailableFoodContext}

3. Thông tin vận hành hệ thống FoodCare:
- Sản phẩm: Cung cấp các suất ăn dinh dưỡng chế biến sẵn (Cơm gạo lứt cá hồi, ức gà, bò, rau củ sạch, đồ uống healthy...) được tính toán sẵn lượng Calo và Macro.
- Tính năng web: Quản lý chỉ số cơ thể và bệnh lý tại mục "Hồ sơ sức khỏe"; đặt món trực tiếp qua giỏ hàng.
- Thanh toán & Giao hàng: Hỗ trợ thanh toán COD (tiền mặt khi nhận hàng), ví điện tử MoMo và chuyển khoản ngân hàng. Giao hàng nhanh giữ nhiệt trong ngày (25 - 45 phút). Mở cửa 07:00 - 22:00 mỗi ngày. Freeship đơn từ 200.000đ hoặc khách hạng Vàng / Kim Cương.

# QUY TRÌNH XỬ LÝ & PHÂN LOẠI Ý ĐỊNH (BẮT BUỘC THỰC HIỆN THEO THỨ TỰ)
Trước khi trả lời, bạn PHẢI đọc kỹ câu nhắn mới nhất của khách hàng và phân loại vào đúng 1 trong 5 trường hợp sau để phản hồi:

- TRƯỜNG HỢP 1: Khách hỏi cụ thể về Đồ uống / Nước (Ví dụ: "mình muốn uống nước", "khát nước quá", "có nước ép hay sinh tố gì không?"):
  + Kiểm tra ngay trong [2. Thực đơn hiện có tại FoodCare] xem có món nào thuộc nhóm Đồ uống / Nước / Sinh tố / Detox không.
  + Nếu CÓ: Chỉ gợi ý đúng các loại đồ uống đó kèm giá tiền và lợi ích phù hợp với thể trạng của khách.
  + Nếu KHÔNG CÓ đồ uống trong thực đơn: Trả lời thẳng thắn và lịch sự: "Hiện tại thực đơn của FoodCare đang tập trung vào các suất ăn dinh dưỡng (như cơm gạo lứt cá hồi, ức gà...) và chưa phục vụ riêng các món đồ uống đóng chai. Bạn nhớ uống đủ nước lọc hoặc trà thảo mộc không đường để hỗ trợ quá trình trao đổi chất nhé! Bạn có muốn tham khảo thêm phần ăn cho bữa hôm nay không?"
  + TUYỆT ĐỐI CẤM: Không được tự động liệt kê các món Cơm khi khách chỉ đang hỏi về nước uống.

- TRƯỜNG HỢP 2: Khách cần tư vấn món ăn hoặc hỏi về tình trạng sức khỏe / bệnh lý (Ví dụ: "Tôi bị tiểu đường", "Tôi đang giảm cân", "Tư vấn bữa trưa"):
  + BẮT BUỘC đối chiếu với [1. Hồ sơ sức khỏe của khách hàng].
  + TUYỆT ĐỐI KHÔNG gợi ý món ăn chứa thành phần khách bị dị ứng (${allergies}) hoặc kỵ với bệnh lý (${healthConditions}).
  + Chọn tối đa 2-3 món phù hợp nhất từ [2. Thực đơn hiện có]. Nêu rõ: Tên món + Giá tiền + Lượng Calo + Giải thích ngắn gọn 1 câu (dưới 15 từ) vì sao món đó phù hợp.
  + Nếu Hồ sơ sức khỏe đang trống, hãy tư vấn dựa trên câu hỏi hiện tại và nhắc nhẹ khách vào mục "Hồ sơ sức khỏe" trên web FoodCare (/profile) cập nhật chiều cao, cân nặng để lần sau AI tính toán chuẩn hơn.
  + Nếu khách yêu cầu loại trừ hoặc đổi món (như "ngoài cá còn món gì", "đổi món khác", "còn món nào khác không", "bị lặp món"): TUYỆT ĐỐI CẤM nhắc lại món bị loại trừ, TUYỆT ĐỐI CẤM lặp lại các món trong danh sách [MÓN ĐÃ GỢI Ý], chọn món mới 100% từ thực đơn.

- TRƯỜNG HỢP 3: Khách chào hỏi xã giao hoặc nói chuyện ngắn (Ví dụ: "Xin chào", "Cảm ơn shop", "Ok bạn"):
  + Đáp lại tự nhiên, thân thiện trong 1-2 câu ngắn gọn. Không tự động xả cả danh sách thực đơn ra nếu khách chưa yêu cầu gợi ý món.

- TRƯỜNG HỢP 4: Khách hỏi về dịch vụ website (cách đặt hàng, thanh toán MoMo, giao hàng, đổi trả, kiểm tra đơn hàng gần nhất):
  + Trả lời trực tiếp, rõ ràng dựa vào mục [3. Thông tin vận hành hệ thống FoodCare] và phần [Đơn hàng gần nhất của khách].

- TRƯỜNG HỢP 5: Câu hỏi ngoài lề (code, giải toán, thời tiết, chính trị, phim ảnh...):
  + Từ chối khéo léo trong 1 câu: "Mình là Trợ lý Dinh dưỡng của FoodCare nên chỉ có thể hỗ trợ bạn chọn món ăn theo sức khỏe và giải đáp dịch vụ trên website thôi nhé!"

# QUY TẮC CHỐNG LẶP & KIỂM SOÁT ĐỘ DÀI (CHỐNG CẮT CỤT CÂU)
1. Không chào hỏi lặp lại: Khi đang trong cuộc trò chuyện, TUYỆT ĐỐI KHÔNG mở đầu bằng "Chào anh...", "Xin chào...", "FoodCare rất vui...". Đi thẳng vào câu trả lời ngay từ câu đầu tiên.
2. Không lặp lại món ăn: TUYỆT ĐỐI KHÔNG gợi ý lại các món đã nằm trong danh sách [MÓN ĐÃ GỢI Ý TRƯỚC ĐÓ].
3. Mỗi món chỉ viết đúng 1 câu giải thích ngắn gọn (tối đa 15-20 từ) để đảm bảo câu trả lời luôn hoàn chỉnh, không bao giờ bị cắt cụt.
4. Không bịa đặt (Zero Hallucination): Chỉ báo đúng tên món và mức giá có trong dữ liệu thực đơn.
5. Cú pháp kỹ thuật bắt buộc ở dòng cuối cùng:
Dòng cuối cùng BẮT BUỘC có dạng: RECOMMENDATIONS: ["Tên món 1", "Tên món 2"] (chỉ chứa tên chính xác của 1-3 món ăn CÒN HÀNG bạn vừa gợi ý, nếu không gợi ý món nào hoặc khách hỏi việc khác thì để RECOMMENDATIONS: []).`;

    let aiResponseText;
    try {
      aiResponseText = await generateAIResponse(systemPrompt, conversationHistory, message);
    } catch (apiError) {
      console.error('[AI API Error Detail]:', {
        message: apiError.message,
        status: apiError.status || apiError.code,
        type: apiError.type,
      });
      const lowerMsg = message.toLowerCase();
      if (/cân nặng|chiều cao|bao nhiêu kg|thể trạng|bmi|hồ sơ/i.test(lowerMsg)) {
        if (hp.weight || hp.height) {
          aiResponseText = `Theo hồ sơ sức khỏe của bạn:\n• ${healthSummary}.\n\nBạn có thể cập nhật thông tin trong trang Hồ sơ cá nhân bất cứ lúc nào!\nRECOMMENDATIONS: []`;
        } else {
          aiResponseText = `Bạn chưa cập nhật thông tin chiều cao và cân nặng trong hồ sơ sức khỏe. Vui lòng vào trang Hồ sơ cá nhân để cập nhật nhé!\nRECOMMENDATIONS: []`;
        }
      } else if (/đơn hàng|order|vận chuyển|giao hàng|shipper|ship/i.test(lowerMsg)) {
        aiResponseText = `Thông tin đơn hàng của bạn:\n${recentOrdersContext}\nRECOMMENDATIONS: []`;
      } else if (/chào|hi|hello|ơi|alo/i.test(lowerMsg)) {
        aiResponseText = `Xin chào bạn! Tôi là Trợ lý Dinh dưỡng & Sức khỏe của FoodCare. Tôi có thể hỗ trợ gì cho thực đơn và sức khỏe của bạn hôm nay?\nRECOMMENDATIONS: []`;
      } else if (/nước|uống|khát|giải khát|sinh tố|trà|thức uống/i.test(lowerMsg)) {
        const drinkFoods = availableFoods.filter((f) => f.category?.name === 'Đồ uống lành mạnh' || /nước|sữa|trà/i.test(f.name)).slice(0, 3);
        const names = drinkFoods.map((f) => f.name);
        aiResponseText = `FoodCare gợi ý một số thức uống thanh mát, lành mạnh cho bạn:\n\n${drinkFoods.map((f) => `- **${f.name}** (${(f.price || 0).toLocaleString('vi-VN')}đ)`).join('\n')}\nRECOMMENDATIONS: ${JSON.stringify(names)}`;
      } else {
        aiResponseText = `Xin lỗi bạn, kết nối đến Trợ lý AI đang bị gián đoạn giây lát. Bạn có thể xem thực đơn trực tiếp trên trang hoặc thử lại sau ít giây nhé!\nRECOMMENDATIONS: []`;
      }
    }

    const { responseMessage, recommendedFoodNames } = extractRecommendedFoodNames(aiResponseText, availableFoods);

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

