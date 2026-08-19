const PredictionService = require('../services/prediction.service');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/asyncHandler');
const AppError = require('../utils/appError');

class PredictionController {
  /**
   * Update prediction (match guesses and bonus guesses)
   * PUT /api/v1/predictions/groups/:groupId
   */
  updatePrediction = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { userId, matchGuesses, bonusGuesses } = req.body;

    if (!userId) {
      throw new AppError('User ID is required', 400);
    }
    if (!groupId) {
      throw new AppError('Group ID is required', 400);
    }

    const result = await PredictionService.updatePrediction(userId, groupId, {
      matchGuesses,
      bonusGuesses
    });

    return success(
      res,
      result,
      result.message || 'Prediction updated successfully'
    );
  });

  /**
   * Get single prediction for user in group
   * GET /api/v1/predictions/groups/:groupId/user/:userId
   */
  getPrediction = asyncHandler(async (req, res) => {
    const { groupId, userId } = req.params;
    const queryUserId = userId || req.query.userId;

    if (!queryUserId) {
      throw new AppError('User ID is required', 400);
    }

    const prediction = await PredictionService.getPrediction(queryUserId, groupId);

    return success(
      res,
      prediction,
      'Prediction retrieved'
    );
  });

  /**
   * Get all predictions for a group (Leaderboard)
   * GET /api/v1/predictions/groups/:groupId/all
   */
  getGroupPredictions = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const predictions = await PredictionService.getGroupPredictions(groupId);

    return success(
      res,
      predictions,
      'Group predictions retrieved'
    );
  });
}

module.exports = new PredictionController();
