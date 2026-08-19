const mongoose = require('mongoose');
const { MATCH_RESULT } = require('../config/constants');

const matchGuessSubSchema = new mongoose.Schema(
  {
    matchId: {
      type: String,
      required: [true, 'Match ID is required'],
      trim: true
    },
    guess: {
      type: String,
      enum: [MATCH_RESULT.HOME_WIN, MATCH_RESULT.DRAW, MATCH_RESULT.AWAY_WIN],
      required: [true, 'Guess must be 1, X, or 2']
    }
  },
  { _id: false }
);

const bonusGuessSubSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: [true, 'Question ID is required'],
      trim: true
    },
    guessNumber: {
      type: Number,
      required: [true, 'Guess number is required']
    },
    paidCost: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const predictionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProgramGroup',
      required: [true, 'Group ID is required']
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProgramTemplate',
      required: [true, 'Template ID is required']
    },
    matchGuesses: {
      type: [matchGuessSubSchema],
      default: []
    },
    bonusGuesses: {
      type: [bonusGuessSubSchema],
      default: []
    },
    correctHits: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

predictionSchema.index({ userId: 1, groupId: 1 }, { unique: true });
predictionSchema.index({ templateId: 1 });

module.exports = mongoose.model('Prediction', predictionSchema);
