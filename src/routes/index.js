const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const programRoutes = require('./program.routes');
const predictionRoutes = require('./prediction.routes');
const adminRoutes = require('./admin.routes');
const userRoutes = require('./user.routes');

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'TotoBet Football Prediction Backend'
  });
});

router.use('/auth', authRoutes);
router.use('/programs', programRoutes);
router.use('/predictions', predictionRoutes);
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);

module.exports = router;
