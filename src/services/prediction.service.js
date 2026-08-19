const mongoose = require('mongoose');
const ProgramGroup = require('../models/ProgramGroup');
const ProgramTemplate = require('../models/ProgramTemplate');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const { isPastDeadline, formatIsraelTime } = require('../utils/timezone');
const { MATCH_RESULT, GROUP_STATUS } = require('../config/constants');
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
   * Includes populated group and template matches.
   */
  async getGroupPredictions(groupId) {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      throw new AppError('Invalid Group ID', 400);
    }

    const group = await ProgramGroup.findById(groupId)
      .populate('templateId')
      .populate('participants', 'name phone nickname coins');

    const predictions = await Prediction.find({ groupId })
      .populate('userId', 'name phone nickname')
      .populate('templateId')
      .sort({ correctHits: -1 });

    return {
      group,
      template: group ? group.templateId : null,
      matches: group && group.templateId ? group.templateId.matches : [],
      bonusQuestions: group && group.templateId ? group.templateId.bonusQuestions : [],
      predictions
    };
  }

  /**
   * Retrieves all programs for a user (categorized into active/open and completed).
   */
  async getUserPrograms(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid User ID', 400);
    }

    const predictions = await Prediction.find({ userId })
      .populate('templateId')
      .populate({
        path: 'groupId',
        populate: { path: 'participants', select: 'name phone nickname' }
      })
      .sort({ createdAt: -1 });

    const activePrograms = [];
    const completedPrograms = [];

    for (const pred of predictions) {
      const template = pred.templateId;
      const group = pred.groupId;
      if (!template) continue;

      const deadlinePassed = isPastDeadline(template.deadline);
      const isCompleted = (group && group.status === GROUP_STATUS.COMPLETED) || !template.isActive;

      let status = 'open';
      if (isCompleted) {
        status = 'completed';
      } else if (deadlinePassed) {
        status = 'locked';
      } else {
        status = 'open';
      }

      let resultSummary = null;
      if (isCompleted && group) {
        const groupPredictions = await Prediction.find({ groupId: group._id });
        const highestScore = Math.max(...groupPredictions.map((p) => p.correctHits || 0), 0);
        const isWinner = (pred.correctHits || 0) === highestScore && highestScore > 0;
        const winnersCount = groupPredictions.filter((p) => (p.correctHits || 0) === highestScore).length;
        const prizeWon = isWinner ? Math.floor(template.prizePool / winnersCount) : 0;

        resultSummary = {
          correctHits: pred.correctHits || 0,
          totalMatches: template.matches.length,
          highestScoreInGroup: highestScore,
          isWinner,
          winnersCount,
          prizeCoinsWon: prizeWon
        };
      }

      const programItem = {
        template: {
          id: template._id,
          title: template.title,
          entryFee: template.entryFee,
          prizePool: template.prizePool,
          deadline: template.deadline,
          deadlineIsraelFormatted: formatIsraelTime(template.deadline),
          isPastDeadline: deadlinePassed,
          isActive: template.isActive,
          matchesCount: template.matches.length,
          matches: template.matches,
          bonusQuestions: template.bonusQuestions
        },
        group: group
          ? {
              id: group._id,
              status: group.status,
              privateCode: group.privateCode,
              participantsCount: group.participants ? group.participants.length : 0,
              maxParticipants: template.maxParticipants
            }
          : null,
        prediction: {
          id: pred._id,
          matchGuesses: pred.matchGuesses,
          bonusGuesses: pred.bonusGuesses,
          correctHits: pred.correctHits,
          totalGuesses: (pred.matchGuesses || []).length,
          isComplete: (pred.matchGuesses || []).length >= template.matches.length
        },
        programStatus: status,
        resultSummary
      };

      if (isCompleted) {
        completedPrograms.push(programItem);
      } else {
        activePrograms.push(programItem);
      }
    }

    return {
      total: predictions.length,
      activeCount: activePrograms.length,
      completedCount: completedPrograms.length,
      activePrograms,
      completedPrograms,
      allPrograms: [...activePrograms, ...completedPrograms]
    };
  }

  /**
   * Retrieves comprehensive program details, user's prediction, and if closed,
   * calculates graph distribution of all match guesses (1, X, 2) and leaderboard.
   */
  async getProgramSummaryWithStats({ templateId, groupId, userId }) {
    let template;
    let group;

    if (groupId) {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw new AppError('Invalid Group ID', 400);
      }
      group = await ProgramGroup.findById(groupId).populate('templateId');
      if (!group) throw new AppError('Group not found', 404);
      template = group.templateId;
    } else if (templateId) {
      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        throw new AppError('Invalid Template ID', 400);
      }
      template = await ProgramTemplate.findById(templateId);
      if (!template) throw new AppError('Template not found', 404);

      if (userId) {
        group = await ProgramGroup.findOne({ templateId, participants: userId });
      }
    } else {
      throw new AppError('Template ID or Group ID is required', 400);
    }

    const deadlinePassed = isPastDeadline(template.deadline);
    const isCompletedGroup = group ? group.status === GROUP_STATUS.COMPLETED : false;
    const isClosed = Boolean(!template.isActive || deadlinePassed || isCompletedGroup);

    let userPrediction = null;
    if (userId) {
      const predQuery = { templateId: template._id, userId };
      if (group) predQuery.groupId = group._id;
      userPrediction = await Prediction.findOne(predQuery);
    }

    let matchesDistribution = [];
    let bonusDistribution = [];
    let groupLeaderboard = [];

    if (isClosed) {
      const query = group ? { groupId: group._id } : { templateId: template._id };
      const allGroupPredictions = await Prediction.find(query).populate('userId', 'name nickname phone');
      const totalParticipants = allGroupPredictions.length;

      // 1. Calculate distribution for each match (Graph Data: 1, X, 2)
      matchesDistribution = template.matches.map((match) => {
        let count1 = 0;
        let countX = 0;
        let count2 = 0;
        let countNone = 0;

        allGroupPredictions.forEach((pred) => {
          const guessObj = (pred.matchGuesses || []).find((mg) => mg.matchId === match.matchId);
          if (!guessObj || !guessObj.guess) {
            countNone++;
          } else if (guessObj.guess === '1') {
            count1++;
          } else if (guessObj.guess === 'X') {
            countX++;
          } else if (guessObj.guess === '2') {
            count2++;
          }
        });

        const totalGuesses = count1 + countX + count2;
        const totalConsidered = totalParticipants > 0 ? totalParticipants : 1;

        const userGuessObj = userPrediction?.matchGuesses?.find((mg) => mg.matchId === match.matchId);
        const userGuess = userGuessObj ? userGuessObj.guess : null;

        return {
          matchId: match.matchId,
          homeTeam: match.homeTeam,
          homeLogo: match.homeLogo,
          awayTeam: match.awayTeam,
          awayLogo: match.awayLogo,
          status: match.status,
          actualResult: match.result,
          userGuess,
          isUserCorrect: match.result && userGuess ? match.result === userGuess : null,
          distribution: {
            '1': count1,
            'X': countX,
            '2': count2,
            none: countNone,
            totalGuesses
          },
          percentages: {
            '1': totalConsidered > 0 ? Number(((count1 / totalConsidered) * 100).toFixed(1)) : 0,
            'X': totalConsidered > 0 ? Number(((countX / totalConsidered) * 100).toFixed(1)) : 0,
            '2': totalConsidered > 0 ? Number(((count2 / totalConsidered) * 100).toFixed(1)) : 0,
            none: totalConsidered > 0 ? Number(((countNone / totalConsidered) * 100).toFixed(1)) : 0
          }
        };
      });

      // 2. Calculate distribution for bonus questions
      bonusDistribution = template.bonusQuestions.map((bq) => {
        const guessCounts = {};
        allGroupPredictions.forEach((pred) => {
          const bg = (pred.bonusGuesses || []).find((b) => b.questionId === bq.questionId);
          if (bg && bg.guessNumber !== undefined && bg.guessNumber !== null) {
            guessCounts[bg.guessNumber] = (guessCounts[bg.guessNumber] || 0) + 1;
          }
        });

        const userBonus = userPrediction?.bonusGuesses?.find((b) => b.questionId === bq.questionId);
        const userGuessNumber = userBonus ? userBonus.guessNumber : null;

        return {
          questionId: bq.questionId,
          title: bq.title,
          costCoins: bq.costCoins,
          rewardCoins: bq.rewardCoins,
          actualResult: bq.actualResult,
          userGuessNumber,
          isUserCorrect: bq.actualResult !== null && userGuessNumber !== null ? bq.actualResult === userGuessNumber : null,
          guessCounts
        };
      });

      // 3. Leaderboard of all participants in group
      groupLeaderboard = allGroupPredictions
        .map((p) => ({
          userId: p.userId?._id || p.userId,
          name: p.userId?.name || 'Participant',
          nickname: p.userId?.nickname || '',
          correctHits: p.correctHits || 0,
          matchGuesses: p.matchGuesses,
          bonusGuesses: p.bonusGuesses
        }))
        .sort((a, b) => b.correctHits - a.correctHits);
    }

    return {
      template: {
        id: template._id,
        title: template.title,
        entryFee: template.entryFee,
        prizePool: template.prizePool,
        deadline: template.deadline,
        deadlineIsraelFormatted: formatIsraelTime(template.deadline),
        isActive: template.isActive,
        isPastDeadline: deadlinePassed,
        matches: template.matches,
        bonusQuestions: template.bonusQuestions
      },
      group: group
        ? {
            id: group._id,
            status: group.status,
            privateCode: group.privateCode,
            participantsCount: group.participants?.length || 0,
            maxParticipants: template.maxParticipants
          }
        : null,
      isClosed,
      isGraphDataAvailable: isClosed,
      message: isClosed
        ? 'Full contest stats and graphs are available'
        : 'Graph data and opponents predictions will unlock when deadline passes',
      userPrediction,
      matchesDistribution,
      bonusDistribution,
      groupLeaderboard
    };
  }
}

module.exports = new PredictionService();
