const mongoose = require('mongoose');
const { MATCH_RESULT, DEFAULTS } = require('../config/constants');

const matchSubSchema = new mongoose.Schema(
  {
    matchId: {
      type: String,
      required: [true, 'Match ID is required'],
      trim: true
    },
    homeTeam: {
      type: String,
      required: [true, 'Home team name is required'],
      trim: true
    },
    homeLogo: {
      type: String,
      default: '',
      trim: true
    },
    awayTeam: {
      type: String,
      required: [true, 'Away team name is required'],
      trim: true
    },
    awayLogo: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      default: 'scheduled',
      trim: true
    },
    result: {
      type: String,
      enum: [MATCH_RESULT.HOME_WIN, MATCH_RESULT.DRAW, MATCH_RESULT.AWAY_WIN, null],
      default: null
    }
  },
  { _id: false }
);

const bonusQuestionSubSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: [true, 'Question ID is required'],
      trim: true
    },
    title: {
      type: String,
      required: [true, 'Bonus question title is required'],
      trim: true
    },
    costCoins: {
      type: Number,
      required: [true, 'Bonus cost in coins is required'],
      min: [0, 'Cost coins cannot be negative'],
      default: 10
    },
    rewardCoins: {
      type: Number,
      min: [0, 'Reward coins cannot be negative'],
      default: 50
    },
    actualResult: {
      type: Number,
      default: null
    }
  },
  { _id: false }
);

const programTemplateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Template title is required'],
      trim: true
    },
    entryFee: {
      type: Number,
      required: [true, 'Entry fee is required'],
      min: [0, 'Entry fee cannot be negative']
    },
    maxParticipants: {
      type: Number,
      default: DEFAULTS.MAX_PARTICIPANTS,
      min: [2, 'Max participants must be at least 2']
    },
    prizePool: {
      type: Number,
      required: [true, 'Prize pool is required'],
      min: [0, 'Prize pool cannot be negative']
    },
    deadline: {
      type: Date,
      required: [true, 'Deadline is required']
    },
    matches: {
      type: [matchSubSchema],
      default: []
    },
    bonusQuestions: {
      type: [bonusQuestionSubSchema],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ProgramTemplate', programTemplateSchema);
