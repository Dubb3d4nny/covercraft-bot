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

    // Check free cover limit
    if (user.creditsUsed >= 10 && (!user.balance || user.balance <= 0)) {
      const paymentUrl = await flutterwave.createPayment(chatId, ctx.from.first_name, ctx.from.username);
      return ctx.reply(
        `You’ve used your 10 free covers. Pay $1 to generate more.`,
        { reply_markup: { inline_keyboard: [[{ text: "Pay $1", url: paymentUrl }]] } }
      );
    }

    // Step 1: Ask user to choose platform
    await ctx.reply(
      'Which platform are you uploading your cover to?',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Webnovel', callback_data: 'platform_webnovel' }],
            [{ text: 'Letterlux', callback_data: 'platform_letterlux' }]
          ]
        }
      }
    );

    // Step 2: Handle the platform button click (once only)
    ctx.telegram.once('callback_query', async (callbackQuery) => {
      try {
        const platformChoice = callbackQuery.data.replace('platform_', '');
        if (!['webnovel', 'letterlux'].includes(platformChoice)) return;

        await ctx.telegram.answerCallbackQuery(callbackQuery.id);
        await ctx.reply('Great! Now send me the title of your book.');

        // Step 3: Wait for title input
        ctx.telegram.once('message', async (msgCtx) => {
          try {
            const title = msgCtx.text;

            // Build prompt (for future AI integration)
            const prompt = promptTemplate({
              title,
              author: ctx.from.first_name,
              genre: 'Unknown',
              style: 'Minimalist'
            });

            // Generate placeholder cover
            const imageUrl = getPlaceholderUrl(title, platformChoice);

            // Increment credit count
            await db.incrementCredits(chatId);

            // Send the generated image
            await ctx.replyWithPhoto({ url: imageUrl }, {
              caption: `✅ Cover for "${title}" generated!\nPlatform: ${platformChoice}\nUsed: ${user.creditsUsed + 1}/10 free`
            });
          } catch (err) {
            console.error('Error handling title input:', err);
            await ctx.reply('⚠️ Something went wrong while generating your cover.');
          }
        });
      } catch (err) {
        console.error('Error handling platform selection:', err);
        await ctx.reply('⚠️ There was an issue selecting your platform.');
      }
    });
  } catch (err) {
    console.error('Error in generate.js handler:', err);
    await ctx.reply('⚠️ Something went wrong. Please try again.');
  }
};
