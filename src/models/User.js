const mongoose = require('mongoose');
const { ROLES, DEFAULTS } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      match: [/^\+?[0-9]{9,15}$/, 'Please provide a valid phone number (9-15 digits)']
    },
    nickname: {
      type: String,
      trim: true,
      default: ''
    },
    pin: {
      type: String,
      required: [true, '4-digit PIN is required'],
      match: [/^\d{4}$/, 'PIN must be exactly 4 digits']
    },
    role: {
      type: String,
      enum: [ROLES.USER, ROLES.ADMIN],
      default: ROLES.USER
    },
    coins: {
      type: Number,
      default: DEFAULTS.USER_INITIAL_COINS,
      min: [0, 'Coins balance cannot be negative']
    },
    referralCode: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.pin; // Do not leak PIN in responses unless explicitly needed
  return obj;
};

module.exports = mongoose.model('User', userSchema);
