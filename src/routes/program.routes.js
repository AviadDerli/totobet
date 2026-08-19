const express = require('express');
const router = express.Router();
const MatchmakingController = require('../controllers/matchmaking.controller');
const AdminController = require('../controllers/admin.controller');

// Templates listing and details for public/users
router.get('/templates', AdminController.getTemplates);
router.get('/templates/:id', AdminController.getTemplateById);

// Dynamic matchmaking room entry
router.post('/templates/:id/join', MatchmakingController.joinProgram);

// Group details & template groups
router.get('/groups/:id', MatchmakingController.getGroup);
router.get('/templates/:templateId/groups', MatchmakingController.getTemplateGroups);

module.exports = router;
