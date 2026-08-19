const mongoose = require('mongoose');
const ProgramTemplate = require('../models/ProgramTemplate');
const ProgramGroup = require('../models/ProgramGroup');
const User = require('../models/User');
const Prediction = require('../models/Prediction');
const { isPastDeadline, formatIsraelTime } = require('../utils/timezone');
const { generatePrivateCode } = require('../utils/codeGenerator');
const { GROUP_STATUS } = require('../config/constants');
const AppError = require('../utils/appError');

class MatchmakingService {
  /**
   * Joins a user to a program template, dynamically matching them into a room.
   * Deducts entryFee and creates an initial empty prediction ticket.
   */
  async joinProgram(userId, templateId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid User ID', 400);
    }
    if (!mongoose.Types.ObjectId.isValid(templateId)) {
      throw new AppError('Invalid Template ID', 400);
    }

    // 1. Fetch Template
    const template = await ProgramTemplate.findById(templateId);
    if (!template) {
      throw new AppError('Program template not found', 404);
    }
    if (!template.isActive) {
      throw new AppError('This program template is not active', 400);
    }
    if (isPastDeadline(template.deadline)) {
      throw new AppError(
        `Deadline passed (${formatIsraelTime(template.deadline)} Israel Time). Program is closed for entries.`,
        400
      );
    }

    // 2. Fetch User & Check Balance
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (user.coins < template.entryFee) {
      throw new AppError(
        `Insufficient coins. Required: ${template.entryFee}, Available: ${user.coins}`,
        400
      );
    }

    // 3. Check if user already joined this template
    const existingGroup = await ProgramGroup.findOne({
      templateId,
      participants: userId
    });
    if (existingGroup) {
      throw new AppError('User is already participating in a group for this program template', 400);
    }

    // 4. Use transaction for consistency & race condition prevention
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find an existing pending group that is not full yet
      let group = await ProgramGroup.findOne({
        templateId,
        status: GROUP_STATUS.PENDING,
        $expr: { $lt: [{ $size: '$participants' }, template.maxParticipants] }
      }).session(session);

      let isNewGroup = false;

      if (!group) {
        // Create new group
        const privateCode = generatePrivateCode();
        group = new ProgramGroup({
          templateId,
          participants: [userId],
          status: template.maxParticipants === 1 ? GROUP_STATUS.FULL : GROUP_STATUS.PENDING,
          privateCode
        });
        await group.save({ session });
        isNewGroup = true;
      } else {
        // Add user to existing group
        group.participants.push(userId);

        if (group.participants.length >= template.maxParticipants) {
          group.status = GROUP_STATUS.FULL;
        }
        await group.save({ session });
      }

      // Deduct entryFee from user
      const updatedUser = await User.findOneAndUpdate(
        { _id: userId, coins: { $gte: template.entryFee } },
        { $inc: { coins: -template.entryFee } },
        { new: true, session }
      );

      if (!updatedUser) {
        throw new AppError('Insufficient coins or concurrent transaction conflict', 400);
      }

      // Create initial empty prediction document
      const prediction = new Prediction({
        userId,
        groupId: group._id,
        templateId,
        matchGuesses: [],
        bonusGuesses: [],
        correctHits: 0
      });
      await prediction.save({ session });

      await session.commitTransaction();
      session.endSession();

      return {
        message: 'Successfully joined program',
        group: {
          id: group._id,
          templateId: group.templateId,
          privateCode: group.privateCode,
          status: group.status,
          currentParticipantsCount: group.participants.length,
          maxParticipants: template.maxParticipants,
          isNewGroup
        },
        predictionId: prediction._id,
        entryFeeDeducted: template.entryFee,
        remainingCoins: updatedUser.coins
      };
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }

  /**
   * Retrieves group details by ID with populated participants and template
   */
  async getGroupById(groupId) {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      throw new AppError('Invalid Group ID', 400);
    }

    const group = await ProgramGroup.findById(groupId)
      .populate('templateId')
      .populate('participants', 'name nickname coins');

    if (!group) {
      throw new AppError('Group not found', 404);
    }

    return group;
  }

  /**
   * Retrieves all groups for a specific template
   */
  async getGroupsByTemplate(templateId) {
    if (!mongoose.Types.ObjectId.isValid(templateId)) {
      throw new AppError('Invalid Template ID', 400);
    }

    return ProgramGroup.find({ templateId })
      .populate('participants', 'name nickname')
      .sort({ createdAt: -1 });
  }

  /**
   * Retrieves all groups a user participates in
   */
  async getUserGroups(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid User ID', 400);
    }

    return ProgramGroup.find({ participants: userId })
      .populate('templateId')
      .populate('participants', 'name nickname')
      .sort({ createdAt: -1 });
  }
}

module.exports = new MatchmakingService();
