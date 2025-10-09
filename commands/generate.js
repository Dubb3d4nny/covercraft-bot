const db = require('../db/firebase');
const promptTemplate = require('../utils/promptTemplate');
const flutterwave = require('../services/flutterwave');

const platforms = {
  webnovel: { width: 512, height: 800 },
  letterlux: { width: 1600, height: 2560 }
};

// Helper: generate dynamic placeholder URL using .env base
function getPlaceholderUrl(title, platform = 'webnovel') {
  const { width, height } = platforms[platform];
  const baseUrl = process.env.PLACEHOLDER_URL || 'https://placehold.co';
  const bgColor = 'cccccc'; // light gray background
  const fgColor = '000000'; // black text
  return `${baseUrl}/${width}x${height}/${bgColor}/${fgColor}.png?text=${encodeURIComponent(title)}`;
}

exports.handler = async (ctx) => {
  try {
    const chatId = ctx.from.id.toString();
    const user = await db.getUser(chatId);

    // Step 0: Check free cover limit
    if (user.creditsUsed >= 10 && (!user.balance || user.balance <= 0)) {
      const paymentUrl = await flutterwave.createPayment(chatId, ctx.from.first_name, ctx.from.username);
      return ctx.reply(
        `You’ve used your 10 free covers. Pay $1 to generate more.`,
        { reply_markup: { inline_keyboard: [[{ text: "💳 Pay $1", url: paymentUrl }]] } }
      );
    }

    // Step 1: Ask for platform
    const platformMsg = await ctx.reply(
      '📘 Which platform are you uploading your cover to?',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌐 Webnovel', callback_data: 'platform_webnovel' }],
            [{ text: '✨ Letterlux', callback_data: 'platform_letterlux' }]
          ]
        }
      }
    );

    // Step 2: Wait for user platform selection
    ctx.telegram.on('callback_query', async (callbackQuery) => {
      if (!callbackQuery.data.startsWith('platform_')) return;

      const platformChoice = callbackQuery.data.replace('platform_', '');
      await ctx.telegram.answerCallbackQuery(callbackQuery.id);

      // Confirm selection
      await ctx.telegram.sendMessage(chatId, `✅ You chose *${platformChoice}*! Now send me your book title:`, { parse_mode: 'Markdown' });

      // Step 3: Wait for book title message
      ctx.telegram.on('message', async (msgCtx) => {
        const title = msgCtx.text;
        if (!title || title.startsWith('/')) return;

        try {
          // Build prompt (for future AI integration)
          const prompt = promptTemplate({
            title,
            author: ctx.from.first_name,
            genre: 'Unknown',
            style: 'Minimalist'
          });

          // Generate placeholder
          const imageUrl = getPlaceholderUrl(title, platformChoice);

          // Increment credits
          await db.incrementCredits(chatId);

          // Send image with button
          await ctx.telegram.sendPhoto(chatId, imageUrl, {
            caption: `✅ Cover for *"${title}"* generated!\nPlatform: *${platformChoice}*\nUsed: ${user.creditsUsed + 1}/10 free`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '⬇️ Download Cover', url: imageUrl }]]
            }
          });
        } catch (err) {
          console.error('Error handling title input:', err);
          await ctx.telegram.sendMessage(chatId, '⚠️ Something went wrong while generating your cover.');
        }
      });
    });
  } catch (err) {
    console.error('Error in generate.js handler:', err);
    await ctx.reply('⚠️ Something went wrong. Please try again.');
  }
};
