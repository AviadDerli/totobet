const MatchmakingService = require('../services/matchmaking.service');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/asyncHandler');
const AppError = require('../utils/appError');

class MatchmakingController {
  /**
   * Join a program template
   * POST /api/v1/programs/:id/join
   */
  joinProgram = asyncHandler(async (req, res) => {
    const templateId = req.params.id || req.body.templateId;
    const { userId } = req.body;

    if (!userId) {
      throw new AppError('User ID is required to join a program', 400);
    }
    if (!templateId) {
      throw new AppError('Template ID is required', 400);
    }

    const result = await MatchmakingService.joinProgram(userId, templateId);

    return success(
      res,
      result,
      result.message || 'Successfully joined program',
      200
    );
  });

  /**
   * Get single group details
   * GET /api/v1/programs/groups/:id
   */
  getGroup = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const group = await MatchmakingService.getGroupById(id);

    return success(
      res,
      group,
      'Group details retrieved'
    );
  });

  /**
   * Get all groups for a template
   * GET /api/v1/programs/templates/:templateId/groups
   */
  getTemplateGroups = asyncHandler(async (req, res) => {
    const { templateId } = req.params;
    const groups = await MatchmakingService.getGroupsByTemplate(templateId);

    return success(
      res,
      groups,
      'Template groups retrieved'
    );
  });
}

module.exports = new MatchmakingController();
