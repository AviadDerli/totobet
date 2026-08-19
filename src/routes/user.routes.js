const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user.controller');

router.get('/:id', UserController.getUser);
router.get('/:id/groups', UserController.getUserGroups);
router.get('/:id/predictions', UserController.getUserPredictions);

module.exports = router;
