/**
 * Formats a successful response
 */
const success = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Formats an error response
 */
const error = (res, message = 'An error occurred', statusCode = 500, details = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(details && { details })
  });
};

module.exports = {
  success,
  error
};
