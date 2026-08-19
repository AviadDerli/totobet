const AdminTemplateService = require('../services/adminTemplate.service');
const ScoringAndDistributionService = require('../services/scoring.service');
const SystemSettingsService = require('../services/systemSettings.service');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/asyncHandler');
const AppError = require('../utils/appError');

class AdminController {
  /**
   * Create a new program template
   * POST /api/v1/admin/templates
   */
  createTemplate = asyncHandler(async (req, res) => {
    const template = await AdminTemplateService.createTemplate(req.body);
    return success(
      res,
      template,
      'Program template created successfully',
      201
    );
  });

  /**
   * Update match results
   * PUT /api/v1/admin/templates/:id/matches
   */
  updateMatchResults = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { matches } = req.body;

    if (!matches || !Array.isArray(matches)) {
      throw new AppError('An array of matches results is required', 400);
    }

    const template = await AdminTemplateService.updateMatchResults(id, matches);
    return success(
      res,
      template,
      'Match results updated successfully'
    );
  });

  /**
   * Update bonus question results
   * PUT /api/v1/admin/templates/:id/bonus
   */
  updateBonusResults = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { bonusQuestions } = req.body;

    if (!bonusQuestions || !Array.isArray(bonusQuestions)) {
      throw new AppError('An array of bonus question results is required', 400);
    }

    const template = await AdminTemplateService.updateBonusResults(id, bonusQuestions);
    return success(
      res,
      template,
      'Bonus question results updated successfully'
    );
  });

  /**
   * Close template and distribute prizes
   * POST /api/v1/admin/templates/:id/distribute
   */
  distributePrizes = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const report = await ScoringAndDistributionService.closeAndDistributePrizes(id);

    return success(
      res,
      report,
      'Prizes calculated and distributed successfully'
    );
  });

  /**
   * List all templates
   * GET /api/v1/admin/templates
   */
  getTemplates = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const templates = await AdminTemplateService.getAllTemplates(filter);
    return success(
      res,
      templates,
      'Templates retrieved successfully'
    );
  });

  /**
   * Get single template
   * GET /api/v1/admin/templates/:id
   */
  getTemplateById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const template = await AdminTemplateService.getTemplateById(id);

    return success(
      res,
      template,
      'Template retrieved successfully'
    );
  });

  /**
   * Get system settings
   * GET /api/v1/admin/settings
   */
  getSystemSettings = asyncHandler(async (req, res) => {
    const settings = await SystemSettingsService.getSettings();
    return success(
      res,
      settings,
      'System settings retrieved'
    );
  });

  /**
   * Update system settings
   * PUT /api/v1/admin/settings
   */
  updateSystemSettings = asyncHandler(async (req, res) => {
    const settings = await SystemSettingsService.updateSettings(req.body);
    return success(
      res,
      settings,
      'System settings updated'
    );
  });
}

module.exports = new AdminController();
