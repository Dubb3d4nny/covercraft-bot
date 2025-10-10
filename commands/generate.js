const db = require('../db/firebase');
const promptTemplate = require('../utils/promptTemplate');
const flutterwave = require('../services/flutterwave');

const platforms = {
  webnovel: { width: 512, height: 800 },
  letterlux: { width: 1600, height: 2560 },
};

// Generate placeholder image link
function getPlaceholderUrl(title, platform = 'webnovel') {
  const { width, height } = platforms[platform];
  const baseUrl = process.env.PLACEHOLDER_URL || 'https://placehold.co';
  const bgColor = 'cccccc';
  const fgColor = '000000';
  return `${baseUrl}/${width}x${height}/${bgColor}/${fgColor}.png?text=${encodeURIComponent(
    title
  )}`;
}

// --- EXPORT HANDLER ---
exports.handler = async (ctx) => {
  try {
    const chatId = ctx.from.id.toString();
    const user = await db.getUser(chatId);

    // Step 0: Check credit balance
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

    // Step 1: Ask platform
    await ctx.reply('📘 Which platform are you uploading your cover to?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 Webnovel', callback_data: 'generate:webnovel' }],
          [{ text: '✨ Letterlux', callback_data: 'generate:letterlux' }],
        ],
      },
    });
  } catch (err) {
    console.error('Error in generate.js handler:', err);
    await ctx.reply('⚠️ Something went wrong. Please try again.');
  }
};

// --- CALLBACK HANDLER ---
exports.handlePlatform = async (ctx) => {
  try {
    const chatId = ctx.from.id.toString();
    const platformChoice = ctx.callbackQuery.data.split(':')[1];
    await ctx.answerCbQuery();

    await ctx.reply(
      `✅ You chose *${platformChoice}*! Now send me your book title:`,
      { parse_mode: 'Markdown' }
    );

    // Next message from this user will be treated as book title
    ctx.session = ctx.session || {};
    ctx.session.awaitingTitle = platformChoice;
  } catch (err) {
    console.error('Error in platform handler:', err);
    await ctx.reply('⚠️ Something went wrong while selecting platform.');
  }
};

// --- TEXT MESSAGE HANDLER ---
exports.handleTitle = async (ctx) => {
  try {
    if (!ctx.session || !ctx.session.awaitingTitle) return;

    const chatId = ctx.from.id.toString();
    const platformChoice = ctx.session.awaitingTitle;
    const title = ctx.message.text;

    if (!title || title.startsWith('/')) return;

    const user = await db.getUser(chatId);

    const prompt = promptTemplate({
      title,
      author: ctx.from.first_name,
      genre: 'Unknown',
      style: 'Minimalist',
    });

    const imageUrl = getPlaceholderUrl(title, platformChoice);
    await db.incrementCredits(chatId);

    await ctx.replyWithPhoto({ url: imageUrl }, {
      caption: `✅ Cover for *"${title}"* generated!\nPlatform: *${platformChoice}*\nUsed: ${user.creditsUsed + 1}/10 free`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '⬇️ Download Cover', url: imageUrl }]],
      },
    });

    // Reset session
    ctx.session.awaitingTitle = null;
  } catch (err) {
    console.error('Error in title handler:', err);
    await ctx.reply('⚠️ Something went wrong while generating your cover.');
  }
};
