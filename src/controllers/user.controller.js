const AuthService = require('../services/auth.service');
const MatchmakingService = require('../services/matchmaking.service');
const PredictionService = require('../services/prediction.service');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/asyncHandler');
const AppError = require('../utils/appError');

class UserController {
  /**
   * Get user details and current wallet balance
   * GET /api/v1/users/:id
   */
  getUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await AuthService.getUserById(id);

    return success(
      res,
      user,
      'User data retrieved'
    );
  });

  /**
   * Get all active & completed groups for a user
   * GET /api/v1/users/:id/groups
   */
  getUserGroups = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const groups = await MatchmakingService.getUserGroups(id);

    return success(
      res,
      groups,
      'User groups retrieved'
    );
  });

  /**
   * Get all programs for a user (categorized into open and completed with predictions and results)
   * GET /api/v1/users/:id/programs
   */
  getUserPrograms = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const programs = await PredictionService.getUserPrograms(id);

    return success(
      res,
      programs,
      'User programs retrieved'
    );
  });

  /**
   * Get all predictions submitted by a user
   * GET /api/v1/users/:id/predictions
   */
  getUserPredictions = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const predictions = await PredictionService.getUserPredictions(id);

    return success(
      res,
      predictions,
      'User predictions retrieved'
    );
  });
}

module.exports = new UserController();
