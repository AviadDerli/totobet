const crypto = require('crypto');

/**
 * Generates a random alphanumeric referral code of specified length (default: 6 chars)
 * @param {number} length 
 * @returns {string}
 */
const generateReferralCode = (length = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous 0/O, 1/I
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
};

/**
 * Generates a random 4-digit string for group private codes
 * @returns {string}
 */
const generatePrivateCode = () => {
  const num = crypto.randomInt(1000, 10000);
  return num.toString();
};

module.exports = {
  generateReferralCode,
  generatePrivateCode
};
