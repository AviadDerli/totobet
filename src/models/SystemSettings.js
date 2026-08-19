const mongoose = require('mongoose');
const { DEFAULTS } = require('../config/constants');

const systemSettingsSchema = new mongoose.Schema(
  {
    referralBonusCoins: {
      type: Number,
      default: DEFAULTS.REFERRAL_BONUS_COINS,
      min: [0, 'Referral bonus coins cannot be negative']
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
