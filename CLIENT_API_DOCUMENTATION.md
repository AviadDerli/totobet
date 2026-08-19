# 📱 דוקומנטציה מפורטת לפיתוח קליינט (Frontend & Mobile API Guide)
## מערכת חיזוי כדורגל דינמית - TotoBet

כתובת בסיס לכל הקריאות (Base URL):
```
http://localhost:5000/api/v1
```

---

## 📋 מבנה תשובה אחיד (Standard Response Format)

כל התשובות מהשרת מוחזרות במבנה JSON אחיד:

### במקרה של הצלחה (Success):
```json
{
  "success": true,
  "message": "הודעת הצלחה",
  "data": { ... }
}
```

### במקרה של שגיאה (Error):
```json
{
  "success": false,
  "message": "פירוט השגיאה",
  "details": [ ... ]
}
```

---

## 🗂️ פירוט השירותים (Services) וה-Endpoints

---

### 1. שירות אימות והרשמה (Auth & User Service)

שירות זה אחראי על ניהול משתמשים, רישום פשוט, התחברות מהירה באמצעות קוד PIN בן 4 ספרות, וניהול כלכלת ההפניות (Referrals).

#### א. הרשמת משתמש חדש (`Register`)
* **Endpoint:** `POST /api/v1/auth/register`
* **תיאור:** יוצר משתמש חדש עם שם, מספר טלפון ו-PIN. מקצה לו אוטומטית 100 מטבעות התחלתיים ויוצר קוד הפניה ייחודי (6 תווים). במידה והוזן קוד הפניה של חבר, המפנה מקבל מיידית בונוס של 50 מטבעות לארנק שלו!
* **Body לדוגמה:**
```json
{
  "name": "דוד כהן",
  "phone": "0501234567",
  "nickname": "davidc",
  "pin": "1234",
  "role": "user",
  "referralCode": "FQ69AT" // אופציונלי - קוד של החבר שהזמין אותו
}
```
* **תשובה מוצלחת (`201 Created`):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "_id": "6a85b41a542e6a2fa4b3d565",
    "name": "דוד כהן",
    "phone": "0501234567",
    "nickname": "davidc",
    "role": "user",
    "coins": 100,
    "referralCode": "K9X7P2",
    "referredBy": "6a85b41a542e6a2fa4b3d560"
  }
}
```

#### ב. התחברות משתמש (`Login`)
* **Endpoint:** `POST /api/v1/auth/login`
* **תיאור:** התחברות באמצעות מספר טלפון (`phone`) וקוד PIN בן 4 ספרות (`pin`).
* **Body לדוגמה:**
```json
{
  "phone": "0501234567",
  "pin": "1234"
}
```
* **תשובה מוצלחת (`200 OK`):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "_id": "6a85b41a542e6a2fa4b3d565",
    "name": "דוד כהן",
    "phone": "0501234567",
    "nickname": "davidc",
    "role": "user",
    "coins": 100,
    "referralCode": "K9X7P2"
  }
}
```

#### ג. צפייה בפרופיל משתמש (`Get Profile`)
* **Endpoint:** `GET /api/v1/auth/profile/:id`
* **תיאור:** שליפת יתרת מטבעות ופרטי המשתמש.

---

### 2. שירות תוכניות ושיבוץ חדרים דינמי (Programs & Matchmaking Service)

זהו לב המערכת! השירות מאפשר למשתמשים לצפות בתוכניות משחקים פתוחות, להצטרף אליהן ולעבור שיבוץ אוטומטי לחדרים (`ProgramGroups`) לפי מגבלת מקומות (`maxParticipants`).

#### א. רשימת כל התוכניות הפתוחות (`Get Program Templates`)
* **Endpoint:** `GET /api/v1/programs/templates`
* **תיאור:** מחזיר את כל התוכניות, המשחקים, שאלות הבונוס, דמי הכניסה (`entryFee`), קופת הפרס (`prizePool`) והדדליין לסגירה.
* **תשובה לדוגמה:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "6a85b41b542e6a2fa4b3d576",
      "title": "מחזור 25 - ליגת העל",
      "entryFee": 30,
      "maxParticipants": 30,
      "prizePool": 600,
      "deadline": "2026-08-20T17:00:00.000Z",
      "isActive": true,
      "matches": [
        {
          "matchId": "m_1",
          "homeTeam": "מכבי תל אביב",
          "awayTeam": "מכבי חיפה",
          "status": "scheduled"
        },
        {
          "matchId": "m_2",
          "homeTeam": "הפועל באר שבע",
          "awayTeam": "בית\"ר ירושלים",
          "status": "scheduled"
        }
      ],
      "bonusQuestions": [
        {
          "questionId": "q_1",
          "title": "כמה קרנות יהיו במשחק המרכזי?",
          "costCoins": 10,
          "rewardCoins": 50
        }
      ]
    }
  ]
}
```

#### ב. הצטרפות לתוכנית ושיבוץ לחדר (`Join Program & Matchmaking`)
* **Endpoint:** `POST /api/v1/programs/templates/:id/join`
* **תיאור:**
  1. בודק שהתוכנית פעילה ושטרם עבר הדדליין (לפי שעון ישראל).
  2. בודק שלמשתמש יש מספיק מטבעות (`User.coins >= entryFee`).
  3. מחפש חדר קיים בסטטוס `pending` שלא התמלא. אם אין - יוצר חדר חדש עם קוד 4 ספרות (`privateCode`).
  4. מנכה את דמי הכניסה מהארנק של המשתמש.
  5. יוצר עבור המשתמש טופס ניחושים ריק (`Prediction`).
  6. אם החדר הגיע למכסה (`maxParticipants`), משנה את סטטוס החדר ל-`full`.
* **Body לדוגמה:**
```json
{
  "userId": "6a85b41a542e6a2fa4b3d565"
}
```
* **תשובה מוצלחת (`200 OK`):**
```json
{
  "success": true,
  "message": "Successfully joined program",
  "data": {
    "group": {
      "id": "6a85b41b542e6a2fa4b3d57c",
      "templateId": "6a85b41b542e6a2fa4b3d576",
      "privateCode": "3356",
      "status": "pending",
      "currentParticipantsCount": 1,
      "maxParticipants": 30,
      "isNewGroup": true
    },
    "predictionId": "6a85b41b542e6a2fa4b3d582",
    "entryFeeDeducted": 30,
    "remainingCoins": 70
  }
}
```

#### ג. צפייה בפרטי חדר (`Get Group Details`)
* **Endpoint:** `GET /api/v1/programs/groups/:id`
* **תיאור:** שליפת שמות וכינויי כל המשתתפים בחדר, סטטוס החדר והקוד הפרטי.

---

### 3. שירות ניחושים ושאלות בונוס (Predictions & Bonus Service)

מאפשר למשתמש לעדכן את טופס הניחושים שלו בתוך החדר, לשלוח ניחושים חלקיים או מלאים, ולהשתתף בשאלות בונוס (בתשלום מטבעות נוסף).

#### א. עדכון ושליחת ניחושים (`Update Prediction`)
* **Endpoint:** `PUT /api/v1/predictions/groups/:groupId`
* **תיאור:**
  * ניתן לעדכן ניחושים עד לדדליין של התוכנית.
  * תומך בניחושים חלקיים (אפשר למלא חלק מהמשחקים ולחזור אח"כ לעדכן).
  * ערכי ניחוש משחק חוקיים: `'1'` (ניצחון בית), `'X'` (תיקו), `'2'` (ניצחון חוץ).
  * שאלת בונוס גובה `costCoins` בפעם הראשונה שהמשתמש מנחש אותה. עדכון של הניחוש באותה שאלה לא יחייב שוב.
* **Body לדוגמה:**
```json
{
  "userId": "6a85b41a542e6a2fa4b3d565",
  "matchGuesses": [
    { "matchId": "m_1", "guess": "1" },
    { "matchId": "m_2", "guess": "X" }
  ],
  "bonusGuesses": [
    { "questionId": "q_1", "guessNumber": 11 }
  ]
}
```
* **תשובה מוצלחת (`200 OK`):**
```json
{
  "success": true,
  "message": "Prediction successfully updated",
  "data": {
    "prediction": {
      "_id": "6a85b41b542e6a2fa4b3d582",
      "userId": "6a85b41a542e6a2fa4b3d565",
      "groupId": "6a85b41b542e6a2fa4b3d57c",
      "templateId": "6a85b41b542e6a2fa4b3d576",
      "matchGuesses": [
        { "matchId": "m_1", "guess": "1" },
        { "matchId": "m_2", "guess": "X" }
      ],
      "bonusGuesses": [
        { "questionId": "q_1", "guessNumber": 11, "paidCost": 10 }
      ],
      "correctHits": 0
    },
    "totalCoinsDeductedForBonus": 10,
    "userCoins": 60
  }
}
```

#### ב. שליפת הניחושים שלי בחדר (`Get My Prediction`)
* **Endpoint:** `GET /api/v1/predictions/groups/:groupId/user/:userId`

#### ג. צפייה בכל הטפסים של חברי החדר / לוח תוצאות (`Get Group Leaderboard`)
* **Endpoint:** `GET /api/v1/predictions/groups/:groupId/all`
* **תיאור:** מחזיר את כל הניחושים וכמות הפגיעות (`correctHits`) של כל המשתתפים בחדר.

---

### 4. שירות היסטוריה ופרופיל שחקן (User Dashboard Service)

שירות זה מיועד למסכי "הפרופיל שלי", "המשחקים שלי" ו"היסטוריית ניחושים":

* `GET /api/v1/users/:id` - פרטי המשתמש ויתרת מטבעות עדכנית.
* `GET /api/v1/users/:id/groups` - כל החדרים שהמשתמש השתתף בהם בעבר או בהווה.
* `GET /api/v1/users/:id/predictions` - כל הטפסים והניחושים שהמשתמש מילא אי פעם.

---

### 5. שירות ניהול אדמין, תוצאות וחלוקת פרסים (Admin & Settlement Service)

שירות המשמש את ממשק הניהול להזנת משחקים, עדכון תוצאות בזמן אמת וסגירת התוכנית עם חלוקת פרסים אוטומטית.

#### א. יצירת תוכנית חדשה (`Create Template`)
* **Endpoint:** `POST /api/v1/admin/templates`
* **Body לדוגמה:**
```json
{
  "title": "מחזור 26 - ליגת האלופות",
  "entryFee": 50,
  "maxParticipants": 30,
  "prizePool": 1200,
  "deadline": "2026-08-25T19:00:00.000Z",
  "matches": [
    {
      "matchId": "m_1",
      "homeTeam": "ריאל מדריד",
      "homeLogo": "https://...",
      "awayTeam": "מנצ'סטר סיטי",
      "awayLogo": "https://..."
    }
  ],
  "bonusQuestions": [
    {
      "questionId": "q_1",
      "title": "באיזו דקה יובקע השער הראשון?",
      "costCoins": 15,
      "rewardCoins": 60
    }
  ]
}
```

#### ב. עדכון תוצאות המשחקים (`Update Match Results`)
* **Endpoint:** `PUT /api/v1/admin/templates/:id/matches`
* **Body לדוגמה:**
```json
{
  "matches": [
    { "matchId": "m_1", "result": "1", "status": "finished" }
  ]
}
```

#### ג. עדכון תוצאות שאלות הבונוס (`Update Bonus Results`)
* **Endpoint:** `PUT /api/v1/admin/templates/:id/bonus`
* **Body לדוגמה:**
```json
{
  "bonusQuestions": [
    { "questionId": "q_1", "actualResult": 24 }
  ]
}
```

#### ד. סגירת תוכנית וחלוקת פרסים (`Close & Distribute Prizes`)
* **Endpoint:** `POST /api/v1/admin/templates/:id/distribute`
* **מה קורה מאחורי הקלעים:**
  1. התוכנית מסומנת כלא פעילה (`isActive: false`) וכל החדרים הופכים ל-`completed`.
  2. השרת מחשב את מספר הפגיעות (`correctHits`) בכל טופס ניחוש.
  3. **בכל חדר בנפרד:** נבחר המשתמש עם הניקוד הגבוה ביותר. במידה ויש שוויון במקום הראשון, קופת הפרס (`prizePool`) מתחלקת שווה בשווה ביניהם (אין פרס למקום שני).
  4. **שאלות בונוס:** מחושבות עצמאית לכל מי שניחש במדויק את התוצאה, והמטבעות מתווספים לארנקו מיידית.
* **תשובה לדוגמה מהשרת:**
```json
{
  "success": true,
  "message": "Prizes calculated and distributed successfully",
  "data": {
    "templateTitle": "מחזור 25 - ליגת העל",
    "totalGroupsProcessed": 2,
    "totalPredictionsEvaluated": 3,
    "totalMainPrizesDistributed": 1200,
    "totalBonusCoinsDistributed": 40,
    "groupSummaries": [
      {
        "groupId": "6a85b41b542e6a2fa4b3d57c",
        "privateCode": "3356",
        "highestScore": 3,
        "winnersCount": 1,
        "prizePerWinner": 600,
        "winners": [
          { "userId": "...", "name": "דוד כהן", "correctHits": 3, "prizeCoinsAwarded": 600 }
        ]
      }
    ],
    "bonusAwards": [
      {
        "userName": "דוד כהן",
        "questionTitle": "כמה קרנות יהיו?",
        "guessNumber": 11,
        "actualResult": 11,
        "coinsAwarded": 50
      }
    ]
  }
}
```

---

## 🔄 תרשים זרימת משתמש בקליינט (User Journey Flow)

```
1. מסך כניסה / הרשמה
   └── רישום עם שם ו-PIN (הזנת קוד חבר לקבלת בונוסים)
   
2. מסך ראשי / לובי (Dashboard)
   ├── הצגת יתרת מטבעות נוכחית
   └── רשימת תוכניות פתוחות להימור (כולל דדליין ודמי כניסה)

3. לחיצה על "הצטרף לתוכנית"
   └── POST /programs/templates/:id/join
       └── ניכוי דמי כניסה + שיבוץ לחדר + פתיחת טופס ניחושים

4. מסך מילוי טופס ניחושים (Prediction Screen)
   ├── בחירת '1', 'X', או '2' לכל משחק
   ├── בחירה אופציונלית של שאלות בונוס
   └── שמירת הטופס: PUT /predictions/groups/:groupId

5. מסך צפייה בחדר וטבלת מובילים (Leaderboard & Results)
   ├── צפייה בחברי החדר והקוד הפרטי
   └── לאחר סיום המשחקים: צפייה בדירוג, פגיעות וזכייה במטבעות
```
