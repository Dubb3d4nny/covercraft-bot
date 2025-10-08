// db/firebase.js

// In-memory user storage (temporary for testing)
if (!global.users) global.users = {};

// Get user info
exports.getUser = async (telegramId) => {
  if (!global.users[telegramId]) {
    global.users[telegramId] = { creditsUsed: 0, balance: 0 };
  }
  return global.users[telegramId];
};

// Increment user credits
exports.incrementCredits = async (telegramId) => {
  if (!global.users[telegramId]) {
    global.users[telegramId] = { creditsUsed: 0, balance: 0 };
  }
  global.users[telegramId].creditsUsed += 1;
};
