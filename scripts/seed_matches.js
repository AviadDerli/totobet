require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const ProgramTemplate = require('../src/models/ProgramTemplate');
const ProgramGroup = require('../src/models/ProgramGroup');
const Prediction = require('../src/models/Prediction');
const { nowInIsrael } = require('../src/utils/timezone');

const matchesData = [
  {
    matchId: 'm_1',
    homeTeam: 'מכבי תל אביב',
    homeLogo: 'https://media.api-sports.io/football/teams/558.png',
    awayTeam: 'מכבי חיפה',
    awayLogo: 'https://media.api-sports.io/football/teams/559.png',
    status: 'scheduled',
    result: null
  },
  {
    matchId: 'm_2',
    homeTeam: 'הפועל באר שבע',
    homeLogo: 'https://media.api-sports.io/football/teams/560.png',
    awayTeam: 'בית"ר ירושלים',
    awayLogo: 'https://media.api-sports.io/football/teams/561.png',
    status: 'scheduled',
    result: null
  },
  {
    matchId: 'm_3',
    homeTeam: 'ריאל מדריד',
    homeLogo: 'https://media.api-sports.io/football/teams/541.png',
    awayTeam: 'ברצלונה',
    awayLogo: 'https://media.api-sports.io/football/teams/529.png',
    status: 'scheduled',
    result: null
  },
  {
    matchId: 'm_4',
    homeTeam: 'ארסנל',
    homeLogo: 'https://media.api-sports.io/football/teams/42.png',
    awayTeam: 'צ\'לסי',
    awayLogo: 'https://media.api-sports.io/football/teams/49.png',
    status: 'scheduled',
    result: null
  },
  {
    matchId: 'm_5',
    homeTeam: 'מנצ\'סטר סיטי',
    homeLogo: 'https://media.api-sports.io/football/teams/50.png',
    awayTeam: 'ליברפול',
    awayLogo: 'https://media.api-sports.io/football/teams/40.png',
    status: 'scheduled',
    result: null
  },
  {
    matchId: 'm_6',
    homeTeam: 'באיירן מינכן',
    homeLogo: 'https://media.api-sports.io/football/teams/157.png',
    awayTeam: 'בורוסיה דורטמונד',
    awayLogo: 'https://media.api-sports.io/football/teams/165.png',
    status: 'scheduled',
    result: null
  }
];

const bonusQuestionsData = [
  {
    questionId: 'q_1',
    title: 'כמה שערים יובקעו במשחק העונה (מכבי ת"א נגד מכבי חיפה)?',
    costCoins: 10,
    rewardCoins: 50,
    actualResult: null
  },
  {
    questionId: 'q_2',
    title: 'באיזו דקה יובקע השער הראשון בקלאסיקו (ריאל מדריד - ברצלונה)?',
    costCoins: 15,
    rewardCoins: 75,
    actualResult: null
  }
];

const updateTemplates = async () => {
  await connectDB();

  console.log('--- Inspecting and Updating Program Templates ---');

  // Check the group mentioned by the user
  const group = await ProgramGroup.findById('6a85c9804bd317c57d2c91b0');
  if (group) {
    console.log(`Found Group 6a85c9804bd317c57d2c91b0 -> Associated template: ${group.templateId}`);
  } else {
    console.log('Group 6a85c9804bd317c57d2c91b0 not found in DB');
  }

  const targetIds = [
    '6a85b41b542e6a2fa4b3d576',
    '6a85bfeadaa060ff5ca41977'
  ];

  if (group && group.templateId && !targetIds.includes(group.templateId.toString())) {
    targetIds.push(group.templateId.toString());
  }

  const futureDeadline = nowInIsrael().plus({ days: 3 }).toJSDate();

  for (const id of targetIds) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      const template = await ProgramTemplate.findById(id);
      if (template) {
        template.matches = matchesData;
        template.bonusQuestions = bonusQuestionsData;
        template.deadline = futureDeadline;
        template.isActive = true;
        await template.save();
        console.log(`✅ Updated Template ${id} ('${template.title}') with ${matchesData.length} matches & ${bonusQuestionsData.length} bonus questions.`);
      } else {
        console.log(`Template ${id} does not exist. Creating it now...`);
        const newTemplate = new ProgramTemplate({
          _id: id,
          title: `תוכנית מחזור כדורגל ${id.slice(-4)}`,
          entryFee: 30,
          maxParticipants: 30,
          prizePool: 1000,
          deadline: futureDeadline,
          matches: matchesData,
          bonusQuestions: bonusQuestionsData,
          isActive: true
        });
        await newTemplate.save();
        console.log(`✅ Created Template ${id} with ${matchesData.length} matches.`);
      }
    }
  }

  // Also update any other active templates in DB to have these matches
  const allTemplates = await ProgramTemplate.find({ isActive: true });
  for (const t of allTemplates) {
    if (t.matches.length < 5) {
      t.matches = matchesData;
      t.bonusQuestions = bonusQuestionsData;
      t.deadline = futureDeadline;
      await t.save();
      console.log(`✅ Updated existing active template ${t._id} ('${t.title}') to have ${matchesData.length} matches.`);
    }
  }

  console.log('\nAll targeted templates have been successfully updated with matches and bonus questions!');
  process.exit(0);
};

updateTemplates().catch((err) => {
  console.error('Error updating templates:', err);
  process.exit(1);
});
