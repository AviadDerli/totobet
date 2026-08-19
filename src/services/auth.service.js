const mongoose = require('mongoose');
const User = require('../models/User');
const SystemSettingsService = require('./systemSettings.service');
const { generateReferralCode } = require('../utils/codeGenerator');
const AppError = require('../utils/appError');
const { ROLES } = require('../config/constants');

class AuthService {
  /**
   * Registers a new user.
   * Auto-generates a unique 6-char alphanumeric referralCode.
   * If optionalReferralCode is provided and valid, links referrer and credits their wallet.
   */
  async register(userData, optionalReferralCode = null) {
    const { name, nickname, pin, role } = userData;

    if (!name || !name.trim()) {
      throw new AppError('User name is required', 400);
    }

    if (!pin || !/^\d{4}$/.test(pin.toString())) {
      throw new AppError('A 4-digit numeric PIN is required', 400);
    }

    // Generate unique referral code
    let referralCode;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      referralCode = generateReferralCode(6);
      const existing = await User.findOne({ referralCode });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new AppError('Could not generate unique referral code, please try again', 500);
    }

    let referredBy = null;
    let referrerUser = null;

    if (optionalReferralCode && optionalReferralCode.trim()) {
      const cleanRefCode = optionalReferralCode.trim().toUpperCase();
      referrerUser = await User.findOne({ referralCode: cleanRefCode });

      if (referrerUser) {
        referredBy = referrerUser._id;
      }
    }

    // Create new user
    const newUser = new User({
      name: name.trim(),
      nickname: nickname ? nickname.trim() : '',
      pin: pin.toString(),
      role: role && Object.values(ROLES).includes(role) ? role : ROLES.USER,
      referralCode,
      referredBy
    });

    await newUser.save();

    // If there was a valid referrer, credit their wallet with referralBonusCoins
    if (referrerUser) {
      const settings = await SystemSettingsService.getSettings();
      const bonusCoins = settings.referralBonusCoins || 50;

      await User.findByIdAndUpdate(referrerUser._id, {
        $inc: { coins: bonusCoins }
      });
    }

    return newUser;
  }

  /**
   * Simple login using User ID, Nickname, Name or ReferralCode + 4-digit PIN
   */
  async login(identifier, pin) {
    if (!identifier) {
      throw new AppError('User identifier (ID, nickname, name, or referral code) is required', 400);
    }

    if (!pin || !/^\d{4}$/.test(pin.toString())) {
      throw new AppError('A valid 4-digit PIN is required', 400);
    }

    const query = [];
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      query.push({ _id: identifier });
    }
    query.push({ nickname: identifier });
    query.push({ name: identifier });
    query.push({ referralCode: identifier.toString().toUpperCase() });

    const user = await User.findOne({ $or: query });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.pin !== pin.toString()) {
      throw new AppError('Invalid PIN', 401);
    }

    return user;
  }

  /**
   * Retrieves user by ID
   */
  async getUserById(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID format', 400);
    }

    const user = await User.findById(userId).populate('referredBy', 'name nickname referralCode');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }
}

module.exports = new AuthService();
