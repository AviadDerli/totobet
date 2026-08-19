const express = require('express');
const router = express.Router();
const MatchmakingController = require('../controllers/matchmaking.controller');
const AdminController = require('../controllers/admin.controller');
const PredictionController = require('../controllers/prediction.controller');

// Templates listing and details for public/users
router.get('/templates', AdminController.getTemplates);
router.get('/templates/:id', AdminController.getTemplateById);
router.get('/templates/:id/summary', PredictionController.getProgramSummary);

// Dynamic matchmaking room entry
router.post('/templates/:id/join', MatchmakingController.joinProgram);

// Group details, summary & template groups
router.get('/groups/:id', MatchmakingController.getGroup);
router.get('/groups/:groupId/summary', PredictionController.getProgramSummary);
router.get('/templates/:templateId/groups', MatchmakingController.getTemplateGroups);

module.exports = router;
