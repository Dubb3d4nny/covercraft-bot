const db = require('../db/firebase');
const promptTemplate = require('../utils/promptTemplate');
const flutterwave = require('../services/flutterwave');

const platforms = {
  webnovel: { width: 512, height: 800 },
  letterlux: { width: 1600, height: 2560 },
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
      const paymentUrl = await flutterwave.createPayment(
        chatId,
        ctx.from.first_name,
        ctx.from.username
      );
      return ctx.reply(
        `💳 You’ve used your 10 free covers. Pay $1 to generate more.`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: 'Pay $1', url: paymentUrl }]],
          },
        }
      );
    }

    // Step 1: Ask for platform
    await ctx.reply('📘 Which platform are you uploading your cover to?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 Webnovel', callback_data: 'platform_webnovel' }],
          [{ text: '✨ Letterlux', callback_data: 'platform_letterlux' }],
        ],
      },
    });

    // Step 2: Wait for callback query (platform selection)
    ctx.bot.on('callback_query', async (callbackCtx) => {
      try {
        if (
          callbackCtx.from.id !== ctx.from.id ||
          !callbackCtx.data.startsWith('platform_')
        )
          return;

        const platformChoice = callbackCtx.data.replace('platform_', '');
        await callbackCtx.answerCbQuery();

        await callbackCtx.reply(
          `✅ You chose *${platformChoice}*! Now send me your book title:`,
          { parse_mode: 'Markdown' }
        );

        // Step 3: Wait for title from the same user
        ctx.bot.on('text', async (msgCtx) => {
          try {
            if (msgCtx.from.id !== ctx.from.id) return;
            const title = msgCtx.message.text;
            if (!title || title.startsWith('/')) return;

            const prompt = promptTemplate({
              title,
              author: ctx.from.first_name,
              genre: 'Unknown',
              style: 'Minimalist',
            });

            const imageUrl = getPlaceholderUrl(title, platformChoice);

            await db.incrementCredits(chatId);

            await msgCtx.replyWithPhoto({ url: imageUrl }, {
              caption: `✅ Cover for *"${title}"* generated!\nPlatform: *${platformChoice}*\nUsed: ${user.creditsUsed + 1}/10 free`,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[{ text: '⬇️ Download Cover', url: imageUrl }]],
              },
            });
          } catch (err) {
            console.error('Error handling title input:', err);
            await msgCtx.reply('⚠️ Something went wrong while generating your cover.');
          }
        });
      } catch (err) {
        console.error('Error handling platform selection:', err);
        await callbackCtx.reply('⚠️ Something went wrong during platform selection.');
      }
    });
  } catch (err) {
    console.error('Error in generate.js handler:', err);
    await ctx.reply('⚠️ Something went wrong. Please try again.');
  }
};
