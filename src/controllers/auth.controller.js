const AuthService = require('../services/auth.service');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/asyncHandler');
const AppError = require('../utils/appError');

class AuthController {
  /**
   * Register a new user
   * POST /api/v1/auth/register
   */
  register = asyncHandler(async (req, res) => {
    const { name, phone, nickname, pin, role, referralCode } = req.body;

    if (!name || !phone || !pin) {
      throw new AppError('Name, phone number, and 4-digit PIN are required', 400);
    }

    const newUser = await AuthService.register(
      { name, phone, nickname, pin, role },
      referralCode
    );

    return success(
      res,
      newUser,
      'User registered successfully',
      201
    );
  });

  /**
   * User login
   * POST /api/v1/auth/login
   */
  login = asyncHandler(async (req, res) => {
    const { phone, identifier, userId, pin } = req.body;
    const loginIdentifier = phone || identifier || userId;

    if (!loginIdentifier || !pin) {
      throw new AppError('Phone number and PIN are required', 400);
    }

    const user = await AuthService.login(loginIdentifier, pin);

    return success(
      res,
      user,
      'Login successful'
    );
  });

  /**
   * Get user profile by ID
   * GET /api/v1/auth/profile/:id
   */
  getProfile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await AuthService.getUserById(id);

    return success(
      res,
      user,
      'User profile retrieved'
    );
  });
}

module.exports = new AuthController();
