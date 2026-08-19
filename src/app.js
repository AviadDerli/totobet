const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const AppError = require('./utils/appError');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// API Routes
app.use('/api/v1', routes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'TotoBet Football Prediction API',
    version: '1.0.0',
    documentation: '/api/v1/health'
  });
});

// 404 handler for undefined routes
app.all('*', (req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server!`, 404));
});

// Centralized error handler middleware
app.use(errorHandler);

module.exports = app;
