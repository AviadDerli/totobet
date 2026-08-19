const SystemSettings = require('../models/SystemSettings');
const { DEFAULTS } = require('../config/constants');

class SystemSettingsService {
  /**
   * Retrieves the system settings singleton, creating it if it doesn't exist.
   */
  async getSettings() {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({
        referralBonusCoins: DEFAULTS.REFERRAL_BONUS_COINS
      });
    }
    return settings;
  }

  /**
   * Updates system settings
   */
  async updateSettings(data) {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings(data);
    } else {
      if (data.referralBonusCoins !== undefined) {
        settings.referralBonusCoins = data.referralBonusCoins;
      }
    }
    await settings.save();
    return settings;
  }
}

module.exports = new SystemSettingsService();
