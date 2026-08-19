require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const AuthService = require('../src/services/auth.service');
const MatchmakingService = require('../src/services/matchmaking.service');
const PredictionService = require('../src/services/prediction.service');
const AdminTemplateService = require('../src/services/adminTemplate.service');
const ScoringAndDistributionService = require('../src/services/scoring.service');
const SystemSettingsService = require('../src/services/systemSettings.service');
const User = require('../src/models/User');
const ProgramTemplate = require('../src/models/ProgramTemplate');
const ProgramGroup = require('../src/models/ProgramGroup');
const Prediction = require('../src/models/Prediction');
const { nowInIsrael, formatIsraelTime } = require('../src/utils/timezone');

const runVerification = async () => {
  console.log('====================================================');
  console.log('🚀 Starting TotoBet Full Flow Lifecycle Verification');
  console.log('====================================================');

  await connectDB();

  const timestamp = Date.now();
  console.log(`[Test Run ID]: ${timestamp}`);
  console.log(`[Israel Time]: ${formatIsraelTime(nowInIsrael().toJSDate())}\n`);

  try {
    // ----------------------------------------------------------------
    // 1. System Settings
    // ----------------------------------------------------------------
    console.log('--- 1. Testing System Settings ---');
    const settings = await SystemSettingsService.updateSettings({ referralBonusCoins: 50 });
    console.log(`✅ System settings verified. Referral Bonus: ${settings.referralBonusCoins} coins`);

    // ----------------------------------------------------------------
    // 2. User Registration & Referral System
    // ----------------------------------------------------------------
    console.log('\n--- 2. Testing Registration & Referral System ---');
    
    // Register Admin (User A)
    const adminUser = await AuthService.register(
      {
        name: `Admin_${timestamp}`,
        phone: `050${Math.floor(1000000 + Math.random() * 9000000)}`,
        nickname: `admin_${timestamp}`,
        pin: '1234',
        role: 'admin'
      }
    );
    console.log(`✅ Admin registered: ${adminUser.name}, Phone: ${adminUser.phone}, RefCode: ${adminUser.referralCode}, Coins: ${adminUser.coins}`);

    // Register User 1 with Admin's referral code
    const user1 = await AuthService.register(
      {
        name: `David_${timestamp}`,
        phone: `052${Math.floor(1000000 + Math.random() * 9000000)}`,
        nickname: `david_${timestamp}`,
        pin: '5678',
        role: 'user'
      },
      adminUser.referralCode
    );
    console.log(`✅ User 1 (David) registered with Admin's referral code: Phone: ${user1.phone}, Coins: ${user1.coins}, ReferredBy: ${user1.referredBy}`);

    // Verify Admin received +50 referral coins
    const updatedAdmin = await AuthService.getUserById(adminUser._id);
    console.log(`✅ Admin updated coins: ${updatedAdmin.coins} (Expected: 150)`);
    if (updatedAdmin.coins !== 150) {
      throw new Error(`Referral bonus mismatch! Expected 150, got ${updatedAdmin.coins}`);
    }

    // Register User 2 and User 3
    const user2 = await AuthService.register({
      name: `Sarah_${timestamp}`,
      phone: `053${Math.floor(1000000 + Math.random() * 9000000)}`,
      nickname: `sarah_${timestamp}`,
      pin: '1111'
    });
    const user3 = await AuthService.register({
      name: `Michael_${timestamp}`,
      phone: `054${Math.floor(1000000 + Math.random() * 9000000)}`,
      nickname: `michael_${timestamp}`,
      pin: '2222'
    });
    console.log(`✅ User 2 (Sarah) registered. Phone: ${user2.phone}, Coins: ${user2.coins}`);
    console.log(`✅ User 3 (Michael) registered. Phone: ${user3.phone}, Coins: ${user3.coins}`);

    // Test Login with Phone + PIN
    const loginRes = await AuthService.login(user1.phone, '5678');
    console.log(`✅ User 1 Login successful with Phone '${user1.phone}' and PIN '5678'`);

    // ----------------------------------------------------------------
    // 3. Admin Creates Program Template
    // ----------------------------------------------------------------
    console.log('\n--- 3. Testing Admin Program Template Creation ---');
    const deadline = nowInIsrael().plus({ hours: 3 }).toJSDate();

    const templateData = {
      title: `Premier League Round ${timestamp}`,
      entryFee: 30,
      maxParticipants: 2, // Group limit = 2 to test dynamic room matchmaking
      prizePool: 600,
      deadline,
      matches: [
        {
          matchId: 'm_1',
          homeTeam: 'Maccabi Tel Aviv',
          awayTeam: 'Maccabi Haifa',
          status: 'scheduled'
        },
        {
          matchId: 'm_2',
          homeTeam: 'Hapoel Beer Sheva',
          awayTeam: 'Beitar Jerusalem',
          status: 'scheduled'
        },
        {
          matchId: 'm_3',
          homeTeam: 'Real Madrid',
          awayTeam: 'Barcelona',
          status: 'scheduled'
        }
      ],
      bonusQuestions: [
        {
          questionId: 'q_1',
          title: 'Total goals in El Clasico (Real Madrid vs Barcelona)?',
          costCoins: 10,
          rewardCoins: 40
        }
      ]
    };

    const template = await AdminTemplateService.createTemplate(templateData);
    console.log(`✅ Program Template created: '${template.title}' (ID: ${template._id})`);
    console.log(`   Entry Fee: ${template.entryFee}, Prize Pool: ${template.prizePool}, Max/Room: ${template.maxParticipants}`);
    console.log(`   Deadline (Israel Time): ${formatIsraelTime(template.deadline)}`);

    // ----------------------------------------------------------------
    // 4. Dynamic Group Matchmaking
    // ----------------------------------------------------------------
    console.log('\n--- 4. Testing Dynamic Group Matchmaking ---');

    // User 1 joins
    const joinUser1 = await MatchmakingService.joinProgram(user1._id, template._id);
    console.log(`✅ User 1 joined: Group ID ${joinUser1.group.id}, Code: ${joinUser1.group.privateCode}, Status: ${joinUser1.group.status}, Remaining Coins: ${joinUser1.remainingCoins}`);

    // User 2 joins -> Should fill Group 1 (maxParticipants = 2)
    const joinUser2 = await MatchmakingService.joinProgram(user2._id, template._id);
    console.log(`✅ User 2 joined: Group ID ${joinUser2.group.id}, Status: ${joinUser2.group.status} (Expected: 'full'), Remaining Coins: ${joinUser2.remainingCoins}`);

    if (joinUser1.group.id.toString() !== joinUser2.group.id.toString()) {
      throw new Error('User 1 and User 2 should have been matched into the same group!');
    }
    if (joinUser2.group.status !== 'full') {
      throw new Error(`Group status should be 'full', got ${joinUser2.group.status}`);
    }

    // User 3 joins -> Group 1 is full, should dynamically spawn Group 2
    const joinUser3 = await MatchmakingService.joinProgram(user3._id, template._id);
    console.log(`✅ User 3 joined: Group ID ${joinUser3.group.id} (New Room), Code: ${joinUser3.group.privateCode}, Status: ${joinUser3.group.status}, Remaining Coins: ${joinUser3.remainingCoins}`);

    if (joinUser3.group.id.toString() === joinUser1.group.id.toString()) {
      throw new Error('User 3 should NOT be in Group 1 since Group 1 was full!');
    }

    // ----------------------------------------------------------------
    // 5. Predictions & Bonus Guess Submissions
    // ----------------------------------------------------------------
    console.log('\n--- 5. Testing Predictions & Bonus Question Submissions ---');

    // User 1: 3 correct guesses + 1 correct bonus question guess (number: 3)
    const pred1 = await PredictionService.updatePrediction(user1._id, joinUser1.group.id, {
      matchGuesses: [
        { matchId: 'm_1', guess: '1' },
        { matchId: 'm_2', guess: 'X' },
        { matchId: 'm_3', guess: '1' }
      ],
      bonusGuesses: [
        { questionId: 'q_1', guessNumber: 3 }
      ]
    });
    console.log(`✅ User 1 submitted guesses: Coins after bonus deduction: ${pred1.userCoins} (Expected: 60)`);

    // User 2: 2 correct guesses + 1 incorrect bonus question guess (number: 1)
    const pred2 = await PredictionService.updatePrediction(user2._id, joinUser2.group.id, {
      matchGuesses: [
        { matchId: 'm_1', guess: '1' },
        { matchId: 'm_2', guess: '2' }, // wrong
        { matchId: 'm_3', guess: '1' }
      ],
      bonusGuesses: [
        { questionId: 'q_1', guessNumber: 1 }
      ]
    });
    console.log(`✅ User 2 submitted guesses: Coins after bonus deduction: ${pred2.userCoins} (Expected: 60)`);

    // User 3 (Group 2): 2 correct guesses, no bonus question
    const pred3 = await PredictionService.updatePrediction(user3._id, joinUser3.group.id, {
      matchGuesses: [
        { matchId: 'm_1', guess: '1' },
        { matchId: 'm_2', guess: 'X' },
        { matchId: 'm_3', guess: '2' } // wrong
      ]
    });
    console.log(`✅ User 3 submitted guesses: User Coins: ${pred3.userCoins}`);

    // ----------------------------------------------------------------
    // 6. Admin Sets Match & Bonus Results
    // ----------------------------------------------------------------
    console.log('\n--- 6. Testing Admin Setting Match & Bonus Results ---');
    await AdminTemplateService.updateMatchResults(template._id, [
      { matchId: 'm_1', result: '1', status: 'finished' },
      { matchId: 'm_2', result: 'X', status: 'finished' },
      { matchId: 'm_3', result: '1', status: 'finished' }
    ]);
    console.log('✅ Admin updated match results: m_1=1, m_2=X, m_3=1');

    await AdminTemplateService.updateBonusResults(template._id, [
      { questionId: 'q_1', actualResult: 3 }
    ]);
    console.log('✅ Admin updated bonus result: q_1 actualResult = 3');

    // ----------------------------------------------------------------
    // 7. Prize Scoring & Distribution Settlement
    // ----------------------------------------------------------------
    console.log('\n--- 7. Testing Prize Calculation & Distribution ---');
    const distributionReport = await ScoringAndDistributionService.closeAndDistributePrizes(template._id);
    
    console.log(`✅ Distribution Report:`);
    console.log(`   Total Groups: ${distributionReport.totalGroupsProcessed}`);
    console.log(`   Total Predictions: ${distributionReport.totalPredictionsEvaluated}`);
    console.log(`   Main Prizes Awarded: ${distributionReport.totalMainPrizesDistributed} coins`);
    console.log(`   Bonus Prizes Awarded: ${distributionReport.totalBonusCoinsDistributed} coins`);
    console.log(`   Overall Coins Awarded: ${distributionReport.totalOverallCoinsAwarded} coins\n`);

    distributionReport.groupSummaries.forEach((g, idx) => {
      console.log(`   [Group ${idx + 1}] Room Code: ${g.privateCode}, Highest Score: ${g.highestScore}, Winners: ${g.winnersCount}, Prize/Winner: ${g.prizePerWinner}`);
      g.winners.forEach((w) => {
        console.log(`      🏆 Winner: ${w.name} (Score: ${w.correctHits}/3) -> Prize: +${w.prizeCoinsAwarded} coins`);
      });
    });

    console.log('\n   [Bonus Question Winners]:');
    distributionReport.bonusAwards.forEach((b) => {
      console.log(`      🎯 Bonus Winner: ${b.userName} guessed ${b.guessNumber} (Actual: ${b.actualResult}) -> Awarded +${b.coinsAwarded} coins`);
    });

    // ----------------------------------------------------------------
    // 8. Final Balance & Status Assertions
    // ----------------------------------------------------------------
    console.log('\n--- 8. Verifying Final User Balances & Statuses ---');
    const finalUser1 = await AuthService.getUserById(user1._id);
    const finalUser2 = await AuthService.getUserById(user2._id);
    const finalUser3 = await AuthService.getUserById(user3._id);

    console.log(`User 1 (David) Final Balance: ${finalUser1.coins} (Expected: 60 remaining + 600 prize + 40 bonus = 700)`);
    console.log(`User 2 (Sarah) Final Balance: ${finalUser2.coins} (Expected: 60)`);
    console.log(`User 3 (Michael) Final Balance: ${finalUser3.coins} (Expected: 70 remaining + 600 prize = 670)`);

    if (finalUser1.coins !== 700) {
      throw new Error(`User 1 final balance mismatch! Expected 700, got ${finalUser1.coins}`);
    }
    if (finalUser2.coins !== 600 - 540) { // 60
      throw new Error(`User 2 final balance mismatch! Expected 60, got ${finalUser2.coins}`);
    }
    if (finalUser3.coins !== 670) {
      throw new Error(`User 3 final balance mismatch! Expected 670, got ${finalUser3.coins}`);
    }

    const finalTemplate = await AdminTemplateService.getTemplateById(template._id);
    console.log(`Template Active Status: ${finalTemplate.isActive} (Expected: false)`);
    if (finalTemplate.isActive !== false) {
      throw new Error('Template should be inactive after distribution!');
    }

    console.log('\n====================================================');
    console.log('🎉 ALL TESTS AND LIFECYCLE FLOWS PASSED PERFECTLY! 🎉');
    console.log('====================================================');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Verification Failed with Error:', err);
    process.exit(1);
  }
};

runVerification();
