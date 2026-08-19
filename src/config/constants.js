module.exports = {
  ROLES: {
    USER: 'user',
    ADMIN: 'admin'
  },
  GROUP_STATUS: {
    PENDING: 'pending',
    FULL: 'full',
    COMPLETED: 'completed'
  },
  MATCH_RESULT: {
    HOME_WIN: '1',
    DRAW: 'X',
    AWAY_WIN: '2'
  },
  DEFAULTS: {
    REFERRAL_BONUS_COINS: 50,
    USER_INITIAL_COINS: 100,
    MAX_PARTICIPANTS: 30,
    TIMEZONE: process.env.TIMEZONE || 'Asia/Jerusalem'
  }
};
