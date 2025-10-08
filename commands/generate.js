
const db = require('../db/firebase');
const promptTemplate = require('../utils/promptTemplate');
const flutterwave = require('../services/flutterwave');

const platforms = {
  webnovel: { width: 512, height: 800 },
  letterlux: { width: 1600, height: 2560 }
};

// Helper: generate dynamic placeholder URL using .env base
function getPlaceholderUrl(title, platform='webnovel') {
  const { width, height } = platforms[platform];
  const baseUrl = process.env.PLACEHOLDER_URL || 'https://placehold.co';
  const bgColor = 'cccccc'; // light gray background
  const fgColor = '000000'; // black text
  return `${baseUrl}/${width}x${height}/${bgColor}/${fgColor}.png?text=${encodeURIComponent(title)}`;
}

exports.handler = async (ctx) => {
  const chatId = ctx.from.id.toString();
  const user = await db.getUser(chatId);

  // Check free cover limit
  if (user.creditsUsed >= 10 && (!user.balance || user.balance <= 0)) {
    const paymentUrl = await flutterwave.createPayment(chatId, ctx.from.first_name, ctx.from.username);
    return ctx.reply(
      `You’ve used your 10 free covers. Pay $1 to generate more.`,
      { reply_markup: { inline_keyboard: [[{ text: "Pay $1", url: paymentUrl }]] } }
    );
  }

  // Step 1: Ask user to choose platform
  ctx.reply(
    'Which platform are you uploading your cover to?',
    { reply_markup: { inline_keyboard: [
      [{ text: 'Webnovel', callback_data: 'platform_webnovel' }],
      [{ text: 'Letterlux', callback_data: 'platform_letterlux' }]
    ]}}
  );

  // Step 2: Handle platform selection
  const platformListener = async (callbackQuery) => {
    const platformChoice = callbackQuery.data.replace('platform_', '');
    ctx.telegram.answerCallbackQuery(callbackQuery.id);

    ctx.reply('Great! Now send me the title of your book.');

    // Step 3: Listen for book title
    const titleListener = async (msgCtx) => {
      const title = msgCtx.message.text;

      // Build prompt for future AI integration
      const prompt = promptTemplate({
        title,
        author: ctx.from.first_name,
        genre: 'Unknown',
        style: 'Minimalist'
      });

      // Generate placeholder URL based on platform
      const imageUrl = getPlaceholderUrl(title, platformChoice);

      // Increment credits
      await db.incrementCredits(chatId);

      // Send image ready for download
      ctx.replyWithPhoto({ url: imageUrl }, {
        caption: `✅ Cover for "${title}" generated!\nPlatform: ${platformChoice}\nUsed: ${user.creditsUsed + 1}/10 free`
      });

      // Remove listeners to avoid multiple triggers
      ctx.telegram.off('text', titleListener);
    };

    ctx.telegram.on('text', titleListener);
    ctx.telegram.off('callback_query', platformListener);
  };

  ctx.telegram.on('callback_query', platformListener);
};

