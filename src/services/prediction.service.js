const mongoose = require('mongoose');
const ProgramGroup = require('../models/ProgramGroup');
const ProgramTemplate = require('../models/ProgramTemplate');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const { isPastDeadline, formatIsraelTime } = require('../utils/timezone');
const { MATCH_RESULT } = require('../config/constants');
const AppError = require('../utils/appError');

class PredictionService {
  /**
   * Updates a user's match and bonus predictions inside a group.
   * - Enforces Israel Time deadline.
   * - Supports partial match guesses.
   * - Charges costCoins for newly entered bonus question guesses.
   */
  async updatePrediction(userId, groupId, predictionsData) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid User ID', 400);
    }
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      throw new AppError('Invalid Group ID', 400);
    }

    const { matchGuesses, bonusGuesses } = predictionsData || {};

    // 1. Fetch Group & verify membership
    const group = await ProgramGroup.findById(groupId);
    if (!group) {
      throw new AppError('Program group not found', 404);
    }

    const isMember = group.participants.some((p) => p.toString() === userId.toString());
    if (!isMember) {
      throw new AppError('You are not a participant of this group', 403);
    }

    // 2. Fetch Template & verify deadline
    const template = await ProgramTemplate.findById(group.templateId);
    if (!template) {
      throw new AppError('Associated program template not found', 404);
    }

    if (isPastDeadline(template.deadline)) {
      throw new AppError(
        `Predictions locked. The deadline passed at ${formatIsraelTime(template.deadline)} Israel Time.`,
        400
      );
    }

    // 3. Fetch or initialize user's Prediction document
    let prediction = await Prediction.findOne({ userId, groupId });
    if (!prediction) {
      prediction = new Prediction({
        userId,
        groupId,
        templateId: template._id,
        matchGuesses: [],
        bonusGuesses: []
      });
    }

    // 4. Update Match Guesses (Partial updates allowed)
    if (Array.isArray(matchGuesses) && matchGuesses.length > 0) {
      const templateMatchIds = new Set(template.matches.map((m) => m.matchId));
      const validResults = Object.values(MATCH_RESULT);

      const existingMatchMap = new Map();
      (prediction.matchGuesses || []).forEach((mg) => {
        existingMatchMap.set(mg.matchId, mg.guess);
      });

      for (const item of matchGuesses) {
        if (!item.matchId || !templateMatchIds.has(item.matchId)) {
          throw new AppError(`Match ID '${item.matchId}' does not belong to this program`, 400);
        }
        if (!validResults.includes(item.guess)) {
          throw new AppError(`Invalid guess '${item.guess}' for match ${item.matchId}. Must be 1, X, or 2`, 400);
        }
        existingMatchMap.set(item.matchId, item.guess);
      }

      prediction.matchGuesses = Array.from(existingMatchMap.entries()).map(([matchId, guess]) => ({
        matchId,
        guess
      }));
    }

    // 5. Update Bonus Guesses & Deduct Coins for new questions
    let totalCoinsDeducted = 0;
    if (Array.isArray(bonusGuesses) && bonusGuesses.length > 0) {
      const templateBonusMap = new Map();
      template.bonusQuestions.forEach((bq) => {
        templateBonusMap.set(bq.questionId, bq);
      });

      const existingBonusMap = new Map();
      (prediction.bonusGuesses || []).forEach((bg) => {
        existingBonusMap.set(bg.questionId, bg);
      });

      for (const item of bonusGuesses) {
        if (!item.questionId || !templateBonusMap.has(item.questionId)) {
          throw new AppError(`Bonus question '${item.questionId}' not found in template`, 400);
        }
        if (typeof item.guessNumber !== 'number' || isNaN(item.guessNumber)) {
          throw new AppError(`Invalid numeric guess for bonus question '${item.questionId}'`, 400);
        }

        const bonusDef = templateBonusMap.get(item.questionId);
        const existingGuess = existingBonusMap.get(item.questionId);

        if (!existingGuess) {
          // New bonus question guess -> Charge user costCoins
          const cost = bonusDef.costCoins || 0;
          if (cost > 0) {
            const user = await User.findById(userId);
            if (user.coins < cost) {
              throw new AppError(
                `Insufficient coins for bonus question '${bonusDef.title}'. Required: ${cost}, Available: ${user.coins}`,
                400
              );
            }
            await User.findByIdAndUpdate(userId, { $inc: { coins: -cost } });
            totalCoinsDeducted += cost;
          }

          existingBonusMap.set(item.questionId, {
            questionId: item.questionId,
            guessNumber: item.guessNumber,
            paidCost: cost
          });
        } else {
          // Already paid for this question -> Just update the guessed number
          existingGuess.guessNumber = item.guessNumber;
          existingBonusMap.set(item.questionId, existingGuess);
        }
      }

      prediction.bonusGuesses = Array.from(existingBonusMap.values());
    }

    await prediction.save();

    const updatedUser = await User.findById(userId);

    return {
      message: 'Prediction successfully updated',
      prediction,
      totalCoinsDeductedForBonus: totalCoinsDeducted,
      userCoins: updatedUser.coins
    };
  }

  /**
   * Retrieves a specific user's prediction in a group
   */
  async getPrediction(userId, groupId) {
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(groupId)) {
      throw new AppError('Invalid ID format', 400);
    }

    const prediction = await Prediction.findOne({ userId, groupId })
      .populate('templateId')
      .populate('userId', 'name nickname');

    if (!prediction) {
      throw new AppError('Prediction not found', 404);
    }

    return prediction;
  }

  /**
   * Retrieves all predictions in a group (for leaderboard or post-deadline viewing)
   */
  async getGroupPredictions(groupId) {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      throw new AppError('Invalid Group ID', 400);
    }

    return Prediction.find({ groupId })
      .populate('userId', 'name nickname')
      .sort({ correctHits: -1 });
  }

  /**
   * Retrieves all predictions submitted by a specific user across all groups
   */
  async getUserPredictions(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid User ID', 400);
    }

    return Prediction.find({ userId })
      .populate('templateId')
      .populate('groupId')
      .sort({ createdAt: -1 });
  }
}

module.exports = new PredictionService();
