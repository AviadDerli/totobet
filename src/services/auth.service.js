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
    const { name, phone, nickname, pin, role } = userData;

    if (!name || !name.trim()) {
      throw new AppError('User name is required', 400);
    }

    if (!phone || !phone.toString().trim()) {
      throw new AppError('Phone number is required', 400);
    }

    const cleanPhone = phone.toString().trim().replace(/[-\s]/g, '');
    if (!/^\+?[0-9]{9,15}$/.test(cleanPhone)) {
      throw new AppError('Invalid phone number format (9-15 digits required)', 400);
    }

    // Check if phone already exists
    const existingPhoneUser = await User.findOne({ phone: cleanPhone });
    if (existingPhoneUser) {
      throw new AppError('Phone number is already registered', 409);
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
      phone: cleanPhone,
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
   * Login using Phone number + 4-digit PIN
   */
  async login(phoneOrIdentifier, pin) {
    if (!phoneOrIdentifier) {
      throw new AppError('Phone number is required for login', 400);
    }

    if (!pin || !/^\d{4}$/.test(pin.toString())) {
      throw new AppError('A valid 4-digit PIN is required', 400);
    }

    const cleanInput = phoneOrIdentifier.toString().trim();
    const cleanPhone = cleanInput.replace(/[-\s]/g, '');

    const query = [
      { phone: cleanPhone },
      { phone: cleanInput }
    ];

    if (mongoose.Types.ObjectId.isValid(cleanInput)) {
      query.push({ _id: cleanInput });
    }
    query.push({ nickname: cleanInput });
    query.push({ name: cleanInput });
    query.push({ referralCode: cleanInput.toUpperCase() });

    const user = await User.findOne({ $or: query });

    if (!user) {
      throw new AppError('User not found with this phone number', 404);
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
