const mongoose = require('mongoose');
const ProgramTemplate = require('../models/ProgramTemplate');
const ProgramGroup = require('../models/ProgramGroup');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const { GROUP_STATUS } = require('../config/constants');
const AppError = require('../utils/appError');

class ScoringAndDistributionService {
  /**
   * Closes a template and calculates scores & distributes prizes:
   * 1. Marks template isActive: false, updates groups to 'completed'.
   * 2. Evaluates match guesses against template match results -> updates correctHits.
   * 3. For each group, finds highest score (1st place) and divides prizePool equally among ties.
   * 4. Evaluates bonus questions independently and awards bonus rewards for exact matches.
   */
  async closeAndDistributePrizes(templateId) {
    if (!mongoose.Types.ObjectId.isValid(templateId)) {
      throw new AppError('Invalid Template ID', 400);
    }

    // 1. Fetch Template
    const template = await ProgramTemplate.findById(templateId);
    if (!template) {
      throw new AppError('Program template not found', 404);
    }

    // Mark Template inactive
    template.isActive = false;
    await template.save();

    // 2. Mark all associated groups as completed
    const groups = await ProgramGroup.find({ templateId });
    await ProgramGroup.updateMany(
      { templateId },
      { $set: { status: GROUP_STATUS.COMPLETED } }
    );

    // 3. Fetch all predictions for this template
    const predictions = await Prediction.find({ templateId }).populate('userId', 'name nickname coins');

    // Build Match Result Map: matchId -> result ('1', 'X', '2')
    const matchResultsMap = new Map();
    template.matches.forEach((m) => {
      if (m.result) {
        matchResultsMap.set(m.matchId, m.result);
      }
    });

    // Build Bonus Result Map: questionId -> { actualResult, rewardCoins }
    const bonusResultsMap = new Map();
    template.bonusQuestions.forEach((bq) => {
      if (bq.actualResult !== null && bq.actualResult !== undefined) {
        bonusResultsMap.set(bq.questionId, {
          actualResult: bq.actualResult,
          rewardCoins: bq.rewardCoins || 50,
          title: bq.title
        });
      }
    });

    // 4. Calculate and save correctHits for every prediction
    for (const pred of predictions) {
      let hits = 0;
      if (Array.isArray(pred.matchGuesses)) {
        pred.matchGuesses.forEach((mg) => {
          const actualResult = matchResultsMap.get(mg.matchId);
          if (actualResult && actualResult === mg.guess) {
            hits++;
          }
        });
      }
      pred.correctHits = hits;
      await pred.save();
    }

    // 5. Prize distribution per group (1st place and ties)
    const groupSummaries = [];
    let totalMainPrizesDistributed = 0;

    for (const group of groups) {
      const groupPreds = predictions.filter(
        (p) => p.groupId.toString() === group._id.toString()
      );

      if (groupPreds.length === 0) {
        groupSummaries.push({
          groupId: group._id,
          privateCode: group.privateCode,
          participantsCount: 0,
          message: 'No predictions submitted in this group'
        });
        continue;
      }

      // Find highest correctHits in this group
      const highestScore = Math.max(...groupPreds.map((p) => p.correctHits));
      const winners = groupPreds.filter((p) => p.correctHits === highestScore);

      if (winners.length > 0) {
        // Divide prize pool equally among top users
        const prizePerWinner = Math.floor(template.prizePool / winners.length);

        const winnerDetails = [];
        for (const winner of winners) {
          const userDoc = winner.userId;
          const uId = userDoc._id || userDoc;

          await User.findByIdAndUpdate(uId, {
            $inc: { coins: prizePerWinner }
          });

          totalMainPrizesDistributed += prizePerWinner;

          winnerDetails.push({
            userId: uId,
            name: userDoc.name || 'Participant',
            correctHits: winner.correctHits,
            prizeCoinsAwarded: prizePerWinner
          });
        }

        groupSummaries.push({
          groupId: group._id,
          privateCode: group.privateCode,
          participantsCount: groupPreds.length,
          highestScore,
          winnersCount: winners.length,
          prizePerWinner,
          totalGroupPrizePool: template.prizePool,
          winners: winnerDetails
        });
      }
    }

    // 6. Bonus Questions Distribution (Independent of group ranking)
    const bonusAwards = [];
    let totalBonusCoinsDistributed = 0;

    for (const pred of predictions) {
      if (Array.isArray(pred.bonusGuesses)) {
        for (const bg of pred.bonusGuesses) {
          const bonusDef = bonusResultsMap.get(bg.questionId);
          if (bonusDef && bg.guessNumber === bonusDef.actualResult) {
            const reward = bonusDef.rewardCoins;
            const uId = pred.userId._id || pred.userId;

            await User.findByIdAndUpdate(uId, {
              $inc: { coins: reward }
            });

            totalBonusCoinsDistributed += reward;
            bonusAwards.push({
              userId: uId,
              userName: pred.userId.name || 'Participant',
              groupId: pred.groupId,
              questionId: bg.questionId,
              questionTitle: bonusDef.title,
              guessNumber: bg.guessNumber,
              actualResult: bonusDef.actualResult,
              coinsAwarded: reward
            });
          }
        }
      }
    }

    return {
      message: 'Prizes successfully distributed and program closed',
      templateId: template._id,
      templateTitle: template.title,
      totalGroupsProcessed: groups.length,
      totalPredictionsEvaluated: predictions.length,
      totalMainPrizesDistributed,
      totalBonusCoinsDistributed,
      totalOverallCoinsAwarded: totalMainPrizesDistributed + totalBonusCoinsDistributed,
      groupSummaries,
      bonusAwards
    };
  }
}

module.exports = new ScoringAndDistributionService();
