const mongoose = require('mongoose');
const ProgramTemplate = require('../models/ProgramTemplate');
const { MATCH_RESULT } = require('../config/constants');
const { toIsraelDateTime } = require('../utils/timezone');
const AppError = require('../utils/appError');

class AdminTemplateService {
  /**
   * Creates a new program template
   */
  async createTemplate(data) {
    const {
      title,
      entryFee,
      maxParticipants,
      prizePool,
      deadline,
      matches,
      bonusQuestions,
      isActive
    } = data;

    if (!title || !title.trim()) {
      throw new AppError('Template title is required', 400);
    }
    if (entryFee === undefined || entryFee === null || entryFee < 0) {
      throw new AppError('A valid entry fee is required', 400);
    }
    if (prizePool === undefined || prizePool === null || prizePool < 0) {
      throw new AppError('A valid prize pool is required', 400);
    }
    if (!deadline) {
      throw new AppError('Deadline is required', 400);
    }

    const deadlineDt = toIsraelDateTime(deadline);
    if (!deadlineDt || !deadlineDt.isValid) {
      throw new AppError('Invalid deadline format', 400);
    }

    // Ensure match IDs exist and structure is clean
    const formattedMatches = (matches || []).map((m, index) => ({
      matchId: m.matchId ? m.matchId.toString().trim() : `m_${index + 1}`,
      homeTeam: m.homeTeam ? m.homeTeam.trim() : 'Home Team',
      homeLogo: m.homeLogo || '',
      awayTeam: m.awayTeam ? m.awayTeam.trim() : 'Away Team',
      awayLogo: m.awayLogo || '',
      status: m.status || 'scheduled',
      result: m.result && Object.values(MATCH_RESULT).includes(m.result) ? m.result : null
    }));

    // Ensure bonus questions format
    const formattedBonus = (bonusQuestions || []).map((b, index) => ({
      questionId: b.questionId ? b.questionId.toString().trim() : `q_${index + 1}`,
      title: b.title ? b.title.trim() : `Bonus Question ${index + 1}`,
      costCoins: b.costCoins !== undefined ? Number(b.costCoins) : 10,
      rewardCoins: b.rewardCoins !== undefined ? Number(b.rewardCoins) : 50,
      actualResult: b.actualResult !== undefined && b.actualResult !== null ? Number(b.actualResult) : null
    }));

    const template = new ProgramTemplate({
      title: title.trim(),
      entryFee: Number(entryFee),
      maxParticipants: maxParticipants ? Number(maxParticipants) : 30,
      prizePool: Number(prizePool),
      deadline: deadlineDt.toJSDate(),
      matches: formattedMatches,
      bonusQuestions: formattedBonus,
      isActive: isActive !== undefined ? Boolean(isActive) : true
    });

    await template.save();
    return template;
  }

  /**
   * Updates match results ('1', 'X', or '2') for a template
   * matchResultsData: [{ matchId: 'm_1', result: '1', status: 'finished' }]
   */
  async updateMatchResults(templateId, matchResultsData) {
    if (!mongoose.Types.ObjectId.isValid(templateId)) {
      throw new AppError('Invalid Template ID', 400);
    }

    if (!Array.isArray(matchResultsData) || matchResultsData.length === 0) {
      throw new AppError('matchResultsData array is required', 400);
    }

    const template = await ProgramTemplate.findById(templateId);
    if (!template) {
      throw new AppError('Program template not found', 404);
    }

    const validResults = [...Object.values(MATCH_RESULT), null];

    matchResultsData.forEach((update) => {
      const match = template.matches.find((m) => m.matchId === update.matchId);
      if (match) {
        if (update.result !== undefined) {
          if (!validResults.includes(update.result)) {
            throw new AppError(`Invalid match result '${update.result}'. Must be 1, X, 2, or null`, 400);
          }
          match.result = update.result;
        }
        if (update.status) {
          match.status = update.status;
        }
      }
    });

    await template.save();
    return template;
  }

  /**
   * Updates exact numeric answers for bonus questions
   * bonusResultsData: [{ questionId: 'q_1', actualResult: 3 }]
   */
  async updateBonusResults(templateId, bonusResultsData) {
    if (!mongoose.Types.ObjectId.isValid(templateId)) {
      throw new AppError('Invalid Template ID', 400);
    }

    if (!Array.isArray(bonusResultsData) || bonusResultsData.length === 0) {
      throw new AppError('bonusResultsData array is required', 400);
    }

    const template = await ProgramTemplate.findById(templateId);
    if (!template) {
      throw new AppError('Program template not found', 404);
    }

    bonusResultsData.forEach((update) => {
      const question = template.bonusQuestions.find((q) => q.questionId === update.questionId);
      if (question) {
        if (update.actualResult !== undefined) {
          question.actualResult = update.actualResult !== null ? Number(update.actualResult) : null;
        }
      }
    });

    await template.save();
    return template;
  }

  /**
   * Retrieves all templates (with optional isActive filter)
   */
  async getAllTemplates(filter = {}) {
    return ProgramTemplate.find(filter).sort({ createdAt: -1 });
  }

  /**
   * Retrieves single template by ID
   */
  async getTemplateById(templateId) {
    if (!mongoose.Types.ObjectId.isValid(templateId)) {
      throw new AppError('Invalid Template ID', 400);
    }

    const template = await ProgramTemplate.findById(templateId);
    if (!template) {
      throw new AppError('Program template not found', 404);
    }

    return template;
  }
}

module.exports = new AdminTemplateService();
