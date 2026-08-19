const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');

// Template management
router.post('/templates', AdminController.createTemplate);
router.get('/templates', AdminController.getTemplates);
router.get('/templates/:id', AdminController.getTemplateById);

// Updating results
router.put('/templates/:id/matches', AdminController.updateMatchResults);
router.put('/templates/:id/bonus', AdminController.updateBonusResults);

// Prize distribution & settlement
router.post('/templates/:id/distribute', AdminController.distributePrizes);

// System settings
router.get('/settings', AdminController.getSystemSettings);
router.put('/settings', AdminController.updateSystemSettings);

module.exports = router;
