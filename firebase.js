exports.getUser = async (telegramId) => {
  // Placeholder: use real Firebase here
  // For now, store in-memory or simulate
  if (!global.users) global.users = {};
  if (!global.users[telegramId]) global.users[telegramId] = { creditsUsed: 0, balance: 0 };
  return global.users[telegramId];
};

exports.incrementCredits = async (telegramId) => {
  if (!global.users[telegramId]) global.users[telegramId] = { creditsUsed: 0, balance: 0 };
  global.users[telegramId].creditsUsed += 1;
};

exports.addBalance = async (telegramId, amount) => {
  if (!global.users[telegramId]) global.users[telegramId] = { creditsUsed: 0, balance: 0 };
  global.users[telegramId].balance += amount;
};
