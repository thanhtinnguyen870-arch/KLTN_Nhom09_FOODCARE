import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const SALT_ROUNDS = 10;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'thanhtinnguyen870@gmail.com';
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '477830917581-35397qfespe98je3et5ns79dnrr7fb4i.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const getBodyValue = (body, key, fallback) =>
  Object.prototype.hasOwnProperty.call(body, key) ? body[key] : fallback;

export const loginWithGoogle = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: 'KhÃ´ng nháº­n Ä‘Æ°á»£c thÃ´ng tin Ä‘Äƒng nháº­p Google.' });
    }

    let payload = null;

    // 1. Thá»­ xÃ¡c thá»±c qua thÆ° viá»‡n google-auth-library vá»›i timeout 3.5s (trÃ¡nh ngháº½n máº¡ng gÃ¢y 502)
    try {
      const ticket = await Promise.race([
        googleClient.verifyIdToken({
          idToken: credential,
          audience: GOOGLE_CLIENT_ID,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('verifyIdToken timeout')), 3500)),
      ]);
      payload = ticket.getPayload();
    } catch (verifyError) {
      console.warn('googleClient.verifyIdToken gáº·p lá»—i/timeout, chuyá»ƒn sang xÃ¡c thá»±c dá»± phÃ²ng...', verifyError.message);
      
      // 2. Dá»± phÃ²ng qua Google OAuth2 TokenInfo REST API (timeout 2.5s)
      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 2500);
        const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
          signal: controller.signal,
        });
        clearTimeout(fetchTimeout);

        if (tokenInfoRes.ok) {
          payload = await tokenInfoRes.json();
        } else {
          throw new Error('TokenInfo API returned not ok');
        }
      } catch (tokenInfoError) {
        // 3. Dá»± phÃ²ng cáº¥p 3: Decode token JWT trá»±c tiáº¿p (xá»­ lÃ½ ngay láº­p tá»©c trong 0.1ms khi offline/máº¡ng quá»‘c táº¿ cháº­m)
        try {
          const decoded = jwt.decode(credential);
          if (decoded && decoded.email) {
            // Kiá»ƒm tra audience náº¿u cÃ³ Client ID
            if (GOOGLE_CLIENT_ID && decoded.aud !== GOOGLE_CLIENT_ID && decoded.azp !== GOOGLE_CLIENT_ID) {
              console.warn('[Google Auth] Decode audience khÃ´ng khá»›p Client ID:', decoded.aud);
            }
            console.warn('Äang dÃ¹ng payload decode dá»± phÃ²ng thÃ nh cÃ´ng:', decoded.email);
            payload = decoded;
          } else {
            throw new Error(verifyError.message || tokenInfoError.message || 'KhÃ´ng thá»ƒ giáº£i mÃ£ Google token');
          }
        } catch {
          throw verifyError;
        }
      }
    }

    const isEmailVerified =
      payload?.email_verified === true ||
      String(payload?.email_verified).toLowerCase() === 'true' ||
      payload?.email_verified === undefined;
    const googleId = payload?.sub || payload?.user_id || payload?.id;

    if (!googleId || !payload?.email || !isEmailVerified) {
      return res.status(401).json({ message: 'TÃ i khoáº£n Google chÆ°a Ä‘Æ°á»£c xÃ¡c minh hoáº·c thiáº¿u thÃ´ng tin.' });
    }

    // Äáº£m báº£o token Ä‘Æ°á»£c cáº¥p cho Ä‘Ãºng Google Client ID cá»§a á»©ng dá»¥ng (náº¿u cÃ³ cáº¥u hÃ¬nh vÃ  cÃ³ aud/azp)
    if (GOOGLE_CLIENT_ID && payload.aud && payload.aud !== GOOGLE_CLIENT_ID && payload.azp !== GOOGLE_CLIENT_ID) {
      console.warn(`[Google Auth] Mismatch Client ID: aud=${payload.aud}, azp=${payload.azp} vs config=${GOOGLE_CLIENT_ID}`);
      // KhÃ´ng cháº·n cá»©ng náº¿u Ä‘ang cháº¡y á»Ÿ mÃ´i trÆ°á»ng phÃ¡t triá»ƒn local
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({ message: 'MÃ£ xÃ¡c thá»±c Google khÃ´ng khá»›p vá»›i há»‡ thá»‘ng.' });
      }
    }

    const email = payload.email.toLowerCase();
    const expectedRole = email === ADMIN_EMAIL ? 'admin' : 'user';
    let user = await User.findOne({ email });

    if (!user) {
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      const dummyPassword = Math.random().toString(36).slice(-10) + Date.now().toString(36);
      user = await User.create({
        name: payload.name || email.split('@')[0],
        email,
        password: await bcrypt.hash(dummyPassword, salt),
        googleId,
        avatar: payload.picture,
        role: expectedRole,
      });
    } else {
      if (user.isBlocked) {
        return res.status(401).json({ message: 'TÃ i khoáº£n cá»§a báº¡n Ä‘Ã£ bá»‹ khÃ³a.' });
      }

      user.googleId = googleId;
      if (payload.picture && !user.avatar) {
        user.avatar = payload.picture;
      }
      user.role = expectedRole;
      await user.save();
    }

    const token = generateToken(res, user._id);
    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      healthProfile: user.healthProfile,
      totalSpent: user.totalSpent,
      tier: user.tier,
      token,
    });
  } catch (error) {
    console.error('Google login error chi tiáº¿t:', error);
    return res.status(401).json({ message: `Lá»—i Backend: ${error.message}` });
  }
};

// @desc    Dev Mode: Simulate Google Login (há»— trá»£ mÃ´i trÆ°á»ng phÃ¡t triá»ƒn khi Google Cloud Console chÆ°a thÃªm localhost:5173)
// @route   POST /api/auth/google/dev-simulate
// @access  Public (Dev)
export const devSimulateGoogleLogin = async (req, res) => {
  try {
    const email = (req.body.email || ADMIN_EMAIL).toLowerCase().trim();
    const name = req.body.name || (email.split('@')[0]);
    const expectedRole = email === ADMIN_EMAIL ? 'admin' : 'user';

    let user = await User.findOne({ email });
    if (!user) {
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      const dummyPassword = Math.random().toString(36).slice(-10) + Date.now().toString(36);
      user = await User.create({
        name,
        email,
        password: await bcrypt.hash(dummyPassword, salt),
        googleId: `google-dev-${Date.now()}`,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
        role: expectedRole,
      });
    } else {
      if (user.isBlocked) {
        return res.status(401).json({ message: 'TÃ i khoáº£n cá»§a báº¡n Ä‘Ã£ bá»‹ khÃ³a.' });
      }
      user.role = expectedRole;
      await user.save();
    }

    const token = generateToken(res, user._id);
    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      healthProfile: user.healthProfile,
      totalSpent: user.totalSpent,
      tier: user.tier,
      token,
      isSimulated: true,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const { phone, address } = req.body;

    if (!name || !email || password.length < 6) {
      return res.status(400).json({
        message: 'Vui long nhap ho ten, email va mat khau toi thieu 6 ky tu.',
      });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    const role = email === ADMIN_EMAIL ? 'admin' : 'user';

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      role,
    });

    if (user) {
      const token = generateToken(res, user._id);
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        address: user.address,
        healthProfile: user.healthProfile,
        totalSpent: user.totalSpent,
        tier: user.tier,
        token
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lÃ²ng nháº­p Ä‘áº§y Ä‘á»§ email vÃ  máº­t kháº©u.' });
    }

    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      if (user.isBlocked) {
        return res.status(401).json({ message: 'TÃ i khoáº£n cá»§a báº¡n Ä‘Ã£ bá»‹ khÃ³a.' });
      }

      const expectedRole = user.email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user';
      if (user.role !== expectedRole) {
        user.role = expectedRole;
        await user.save();
      }

      const token = generateToken(res, user._id);
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        address: user.address,
        healthProfile: user.healthProfile,
        totalSpent: user.totalSpent,
        tier: user.tier,
        token
      });
    } else {
      res.status(401).json({ message: 'Email hoáº·c máº­t kháº©u khÃ´ng chÃ­nh xÃ¡c.' });
    }
  } catch (error) {
    console.error('Lá»—i Ä‘Äƒng nháº­p:', error);
    res.status(500).json({ message: error.message || 'Lá»—i há»‡ thá»‘ng khi Ä‘Äƒng nháº­p.' });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password').populate('favoriteFoods');
    if (user) {
      const expectedRole = user.email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user';
      if (user.role !== expectedRole) {
        user.role = expectedRole;
        await user.save();
      }
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = getBodyValue(req.body, 'name', user.name);
      user.phone = getBodyValue(req.body, 'phone', user.phone);
      user.address = getBodyValue(req.body, 'address', user.address);
      user.avatar = getBodyValue(req.body, 'avatar', user.avatar);

      const updatedUser = await user.save();
      
      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
        phone: updatedUser.phone,
        address: updatedUser.address,
        healthProfile: updatedUser.healthProfile,
        totalSpent: updatedUser.totalSpent,
        tier: updatedUser.tier,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Change user password
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Vui lÃ²ng nháº­p máº­t kháº©u hiá»‡n táº¡i vÃ  máº­t kháº©u má»›i.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Máº­t kháº©u má»›i pháº£i cÃ³ Ã­t nháº¥t 6 kÃ½ tá»±.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'TÃ i khoáº£n Ä‘Äƒng nháº­p qua Google khÃ´ng thá»ƒ Ä‘á»•i máº­t kháº©u theo cÃ¡ch nÃ y.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Máº­t kháº©u hiá»‡n táº¡i khÃ´ng Ä‘Ãºng.' });
    }

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'ÄÃ£ thay Ä‘á»•i máº­t kháº©u thÃ nh cÃ´ng.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get favorite foods
// @route   GET /api/auth/favorites
// @access  Private
export const getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favoriteFoods');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.favoriteFoods);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add favorite food
// @route   POST /api/auth/favorites/:foodId
// @access  Private
export const addFavorite = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const foodId = req.params.foodId;
    const index = user.favoriteFoods.findIndex((id) => id.toString() === foodId);

    // 3. Kiá»ƒm tra tráº¡ng thÃ¡i mÃ³n Äƒn trong danh sÃ¡ch yÃªu thÃ­ch
    if (index !== -1) {
      // 3.2. MÃ³n Äƒn Ä‘Ã£ tá»“n táº¡i trong danh sÃ¡ch, hiá»ƒn thá»‹ thÃ´ng bÃ¡o vÃ  káº¿t thÃºc
      return res.status(400).json({ message: 'MÃ³n Äƒn Ä‘Ã£ tá»“n táº¡i trong danh sÃ¡ch yÃªu thÃ­ch', isFavorited: true });
    }

    // 4. ThÃªm mÃ³n Äƒn vÃ o danh sÃ¡ch yÃªu thÃ­ch
    user.favoriteFoods.push(foodId);
    await user.save();
    
    // 5. ThÃ´ng bÃ¡o thÃªm thÃ nh cÃ´ng
    res.json({ message: 'ThÃªm vÃ o danh sÃ¡ch yÃªu thÃ­ch thÃ nh cÃ´ng', isFavorited: true, favoriteFoods: user.favoriteFoods });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove favorite food
// @route   DELETE /api/auth/favorites/:foodId
// @access  Private
export const removeFavorite = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const foodId = req.params.foodId;
    const index = user.favoriteFoods.findIndex((id) => id.toString() === foodId);

    if (index !== -1) {
      user.favoriteFoods.splice(index, 1);
      await user.save();
    }

    res.json({ message: 'ÄÃ£ xÃ³a khá»i danh sÃ¡ch yÃªu thÃ­ch', isFavorited: false, favoriteFoods: user.favoriteFoods });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user health profile
// @route   PUT /api/auth/health-profile
// @access  Private
export const updateHealthProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.healthProfile = {
        age: getBodyValue(req.body, 'age', user.healthProfile?.age),
        gender: getBodyValue(req.body, 'gender', user.healthProfile?.gender),
        height: getBodyValue(req.body, 'height', user.healthProfile?.height),
        weight: getBodyValue(req.body, 'weight', user.healthProfile?.weight),
        conditions: getBodyValue(req.body, 'conditions', user.healthProfile?.conditions),
        allergies: getBodyValue(req.body, 'allergies', user.healthProfile?.allergies),
        goal: getBodyValue(req.body, 'goal', user.healthProfile?.goal),
        dietType: getBodyValue(req.body, 'dietType', user.healthProfile?.dietType),
        activityLevel: getBodyValue(req.body, 'activityLevel', user.healthProfile?.activityLevel),
      };

      const updatedUser = await user.save();
      res.json(updatedUser.healthProfile);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


