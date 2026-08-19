const mongoose = require('mongoose');
const { GROUP_STATUS } = require('../config/constants');

const programGroupSchema = new mongoose.Schema(
  {
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProgramTemplate',
      required: [true, 'Template ID is required']
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    status: {
      type: String,
      enum: [GROUP_STATUS.PENDING, GROUP_STATUS.FULL, GROUP_STATUS.COMPLETED],
      default: GROUP_STATUS.PENDING
    },
    privateCode: {
      type: String,
      required: [true, 'Private code is required'],
      match: [/^\d{4}$/, 'Private code must be a 4-digit number']
    }
  },
  {
    timestamps: true
  }
);

// Helpful index for matchmaking queries
programGroupSchema.index({ templateId: 1, status: 1 });

module.exports = mongoose.model('ProgramGroup', programGroupSchema);
