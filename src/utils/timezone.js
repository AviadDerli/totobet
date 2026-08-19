const { DateTime } = require('luxon');
const { DEFAULTS } = require('../config/constants');

const TIMEZONE = DEFAULTS.TIMEZONE;

/**
 * Returns current DateTime in Israel Time (Asia/Jerusalem)
 */
const nowInIsrael = () => {
  return DateTime.now().setZone(TIMEZONE);
};

/**
 * Converts a JavaScript Date or ISO string into Luxon DateTime in Israel Time
 */
const toIsraelDateTime = (date) => {
  if (!date) return null;
  if (date instanceof Date) {
    return DateTime.fromJSDate(date).setZone(TIMEZONE);
  }
  if (typeof date === 'string') {
    return DateTime.fromISO(date).setZone(TIMEZONE);
  }
  return DateTime.fromMillis(date).setZone(TIMEZONE);
};

/**
 * Checks if a given deadline has passed in Israel Time
 * @param {Date|string|number} deadline 
 * @returns {boolean}
 */
const isPastDeadline = (deadline) => {
  if (!deadline) return false;
  const deadlineDt = toIsraelDateTime(deadline);
  const nowDt = nowInIsrael();
  return nowDt > deadlineDt;
};

/**
 * Formats a Date into a human-readable Israel Time string
 * @param {Date|string|number} date 
 * @param {string} format 
 * @returns {string}
 */
const formatIsraelTime = (date, format = 'yyyy-MM-dd HH:mm:ss ZZZZ') => {
  const dt = toIsraelDateTime(date);
  return dt ? dt.toFormat(format) : '';
};

module.exports = {
  TIMEZONE,
  nowInIsrael,
  toIsraelDateTime,
  isPastDeadline,
  formatIsraelTime
};
