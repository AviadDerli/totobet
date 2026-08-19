const express = require('express');
const router = express.Router();
const PredictionController = require('../controllers/prediction.controller');

// Submit or update match & bonus predictions inside a group
router.put('/groups/:groupId', PredictionController.updatePrediction);

// Fetch a user's prediction in a group
router.get('/groups/:groupId/user/:userId', PredictionController.getPrediction);

// Fetch all predictions within a group (Leaderboard)
router.get('/groups/:groupId/all', PredictionController.getGroupPredictions);

module.exports = router;
