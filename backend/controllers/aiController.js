import OpenAI from 'openai';
import Food from '../models/Food.js';
import AIChat from '../models/AIChat.js';
import AIQuestionLog from '../models/AIQuestionLog.js';

const detectQuestionTopics = (text = '') => {
  const lower = text.toLowerCase();
  const topics = [];
  if (/tiểu đường|đường huyết|đái tháo đường/.test(lower)) topics.push('Tiểu đường');
  if (/giảm cân|béo|giảm mỡ|diet|eat clean|calo ít/.test(lower)) topics.push('Giảm cân / Eat Clean');
  if (/tăng cơ|gym|thể hình|đạm|protein|bulking/.test(lower)) topics.push('Tăng cơ / Gym');
  if (/chay|thuần chay|vegetable|vegetarian/.test(lower)) topics.push('Ăn chay');
  if (/huyết áp|tim mạch|cholesterol/.test(lower)) topics.push('Tim mạch / Huyết áp');
  if (/dạ dày|tiêu hóa|đau bụng/.test(lower)) topics.push('Dạ dày / Tiêu hóa');
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

    // Lấy tất cả món ăn trong menu để AI nhận biết được cả món đang có sẵn và món tạm hết
    const allFoods = await Food.find({})
      .select('name price healthTags suitableFor warningFor nutrition.calories isAvailable')
      .lean();

    const availableFoods = allFoods.filter((f) => f.isAvailable !== false);
    const unavailableFoods = allFoods.filter((f) => f.isAvailable === false);

    // Context món có sẵn (đang bán)
    const availableFoodContext = availableFoods.map(f =>
      `- ${f.name} (${(f.price || 0).toLocaleString()}đ, ~${f.nutrition?.calories || '?'} kcal)` +
      (f.healthTags?.length   ? ` [${f.healthTags.join(', ')}]` : '') +
      (f.suitableFor?.length  ? ` ✓${f.suitableFor.join(', ')}` : '') +
      (f.warningFor?.length   ? ` ✗${f.warningFor.join(', ')}` : '')
    ).join('\n');

    // Context món tạm hết (không khả dụng)
    const unavailableFoodContext = unavailableFoods.length > 0
      ? unavailableFoods.map(f => `- ${f.name} [TẠM HẾT]`).join('\n')
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
      const namesStr = mentionedUnavailableFoods.map(f => `"${f.name}"`).join(', ');
      unavailableNotice = `\n⚠️ CẢNH BÁO QUAN TRỌNG: Khách hàng đang hỏi về món ${namesStr} - món này hiện ĐANG TẠM HẾT trên hệ thống! BẮT BUỘC thông báo rõ ràng cho khách rằng món này đã tạm hết/hết hàng. Tuyệt đối KHÔNG được nói món này còn hàng và KHÔNG nhầm lẫn với bất kỳ món nào khác (ví dụ: không nhầm lẫn giữa "Cơm khoai lang gà cải xanh" và "Gà ta khoai lang cải xanh"). Có thể gợi ý món thay thế tương tự đang có sẵn.`;
    }

    // Hồ sơ sức khỏe người dùng (chỉ nếu có)
    const hp = user.healthProfile;
    const healthSummary = [
      hp?.age        ? `Tuổi: ${hp.age}`                                 : '',
      hp?.conditions?.length ? `Bệnh: ${hp.conditions.join(', ')}`       : '',
      hp?.allergies?.length  ? `Dị ứng: ${hp.allergies.join(', ')}`      : '',
      hp?.goal       ? `Mục tiêu: ${hp.goal}`                            : '',
    ].filter(Boolean).join(' | ') || 'Không có thông tin';

    // Lấy tối đa 4 lượt chat gần nhất để AI hiểu ngữ cảnh trò chuyện liên tục
    const recentChats = await AIChat.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();
    recentChats.reverse();

    const conversationHistory = recentChats.map((c) => ({
      user: c.message,
      assistant: c.response,
    }));

    const systemPrompt = `Bạn là chuyên viên dinh dưỡng và chăm sóc khách hàng thông minh của FoodCare (cửa hàng đồ ăn dinh dưỡng & cá nhân hoá sức khỏe).
Khách hàng: ${user.name || 'Quý khách'} | ${healthSummary}${unavailableNotice}

THỰC ĐƠN ĐANG CÓ SẴN (CÒN HÀNG - CÓ THỂ ĐẶT MÓN):
${availableFoodContext}

DANH SÁCH MÓN ĐANG TẠM HẾT (HẾT HÀNG - KHÔNG THỂ ĐẶT MÓN):
${unavailableFoodContext}

HƯỚNG DẪN XỬ LÝ THEO TỪNG LOẠI CÂU HỎI (RẤT QUAN TRỌNG):
1. NẾU KHÁCH CHÀO HỎI / XÃ GIAO / CẢM ƠN (ví dụ: "hi", "chào shop", "hello", "shop ơi", "bạn là ai", "cảm ơn", "tạm biệt"):
   - Chào lại khách hàng một cách thân thiện, nhiệt tình và lịch sự.
   - Giới thiệu bạn là trợ lý dinh dưỡng FoodCare, sẵn sàng tư vấn món ăn phù hợp với khẩu vị, chế độ ăn kiêng (giảm cân, tập gym, ăn chay, eat clean...) hoặc hỗ trợ bệnh lý (tiểu đường, huyết áp...).
   - Hỏi khách hôm nay cần tư vấn món ăn hay hỗ trợ điều gì.
   - TUYỆT ĐỐI KHÔNG tự động liệt kê danh sách món ăn khi khách chỉ mới chào hỏi hoặc chưa hỏi món!
   - Dòng cuối cùng bắt buộc: RECOMMENDATIONS: []

2. NẾU KHÁCH HỎI KIỂM TRA MÓN ĂN CÒN HAY HẾT (ví dụ: "cơm khoai lang gà cải xanh còn không?", "món X còn không?"):
   - ĐỐI CHIẾU CHÍNH XÁC TÊN MÓN KHÁCH HỎI:
     + Chú ý phân biệt chính xác tên món, TRÁNH nhầm lẫn giữa các món có tên gần giống nhau (Ví dụ: "Cơm khoai lang gà cải xanh" là món TẠM HẾT, hoàn toàn khác biệt với món "Gà ta khoai lang cải xanh" đang CÒN HÀNG).
   - Nếu món khách hỏi nằm trong "DANH SÁCH MÓN ĐANG TẠM HẾT":
     + THÔNG BÁO RÕ RÀNG: Món **[Tên món khách hỏi]** hiện tại đã TẠM HẾT (chưa thể đặt hàng lúc này).
     + TUYỆT ĐỐI KHÔNG nói món đó còn hàng, và TUYỆT ĐỐI KHÔNG lấy thông tin món khác có tên gần giống để nói là còn hàng!
     + Lịch sự gợi ý khách 1-2 món tương tự ĐANG CÓ SẴN trên thực đơn để thay thế (nêu rõ món gợi ý này đang có sẵn).
     + Ở dòng RECOMMENDATIONS, chỉ đưa món thay thế đang có sẵn (nếu có gợi ý), TUYỆT ĐỐI KHÔNG đưa món tạm hết vào.
   - Nếu món khách hỏi nằm trong "THỰC ĐƠN ĐANG CÓ SẴN":
     + Báo cho khách biết món **[Tên món]** hiện đang có sẵn trên thực đơn, kèm giá và calo để khách đặt món.
     + Dòng cuối cùng: RECOMMENDATIONS: ["Tên món"]
   - Nếu món không có trong cả 2 danh sách:
     + Thông báo cửa hàng hiện chưa có món này trên thực đơn, gợi ý 1-2 món có sẵn phù hợp.
     + Dòng cuối cùng: RECOMMENDATIONS: [...]

3. NẾU KHÁCH HỎI VỀ DỊCH VỤ / CÂU HỎI CHUNG (ví dụ: giao hàng, giờ mở cửa, cách thức đặt món, thanh toán):
   - Trả lời ngắn gọn, lịch sự, đúng trọng tâm và hướng dẫn khách đặt món trên website.
   - Dòng cuối cùng bắt buộc: RECOMMENDATIONS: []

4. NẾU KHÁCH CẦN TƯ VẤN MÓN ĂN / DINH DƯỠNG / BỆNH LÝ / BỮA ĂN:
   - Trả lời đúng trọng tâm câu hỏi của khách, kết hợp với hồ sơ sức khỏe nếu có.
   - CHỈ GỢI Ý các món trong "THỰC ĐƠN ĐANG CÓ SẴN" (tuyệt đối KHÔNG gợi ý món đang TẠM HẾT).
   - In đậm tên món ăn: **Tên món**, kèm lý do ngắn gọn vì sao phù hợp (calo, đạm, ít tinh bột/đường, tốt cho sức khỏe...).
   - Nếu khách hỏi về bệnh lý hoặc ăn kiêng đặc biệt, thêm 1 dòng: "⚠️ Tham khảo bác sĩ trước khi thay đổi chế độ ăn."
   - Dòng CUỐI CÙNG bắt buộc phải là:
     RECOMMENDATIONS: ["Tên món 1", "Tên món 2"]

QUY TẮC:
• Trả lời tự nhiên, súc tích, bằng tiếng Việt chuẩn mực, tối đa 150-200 từ.
• Đọc thật kỹ tên món khách hỏi để đối chiếu chính xác với cả 2 danh sách ĐANG CÓ SẴN và ĐANG TẠM HẾT.
• KHÔNG bịa ra món ngoài danh sách THỰC ĐƠN.
• Mảng RECOMMENDATIONS: [...] CHỈ ĐƯỢC CHỨA các món ĐANG CÓ SẴN, tuyệt đối KHÔNG chứa món TẠM HẾT.`;

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

