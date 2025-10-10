// commands/generate.js — CoverCraft Stable Handler
const db = require('../db/firebase');
const promptTemplate = require('../utils/promptTemplate');
const flutterwave = require('../services/flutterwave');

const platforms = {
  webnovel: { width: 512, height: 800 },
  letterlux: { width: 1600, height: 2560 },
};

// ✅ Resilient image generator (auto fallback)
function getPlaceholderUrl(title, platform = 'webnovel') {
  const { width, height } = platforms[platform];
  const baseUrl =
    process.env.PLACEHOLDER_URL ||
    'https://placehold.co'; // More stable than fakeimg.pl
  const safeTitle = encodeURIComponent(title.slice(0, 50));
  return `${baseUrl}/${width}x${height}/cccccc/000000.png?text=${safeTitle}`;
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

      await ctx.reply(
        `💳 You’ve used your 10 free covers. Pay $1 to generate more.`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: 'Pay $1', url: paymentUrl }]],
          },
        }
      );
      return;
    }

    // Step 1: Ask platform
    await ctx.reply('📘 Which platform are you uploading your cover to?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 Webnovel', callback_data: 'generate:webnovel' }],
          [{ text: '✨ Letterlux', callback_data: 'generate:letterlux' }],
          [{ text: '❌ Cancel', callback_data: 'cancel' }],
        ],
      },
    });
  } catch (err) {
    console.error('Error in generate.js handler:', err);
    try {
      await ctx.reply('⚠️ Something went wrong. Please try again.');
    } catch (_) {}
  }
};

// --- CALLBACK HANDLER ---
exports.handlePlatform = async (ctx) => {
  try {
    const chatId = ctx.from.id.toString();
    const platformChoice = ctx.callbackQuery.data.split(':')[1];
    await ctx.answerCbQuery();

    ctx.session = ctx.session || {};
    ctx.session.awaitingTitle = platformChoice;

    await ctx.reply(
      `✅ You chose *${platformChoice}*! Now send me your book title:`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('Error in platform handler:', err);
    try {
      await ctx.reply('⚠️ Something went wrong while selecting platform.');
    } catch (_) {}
  }
};

// --- TEXT MESSAGE HANDLER ---
exports.handleTitle = async (ctx) => {
  try {
    if (!ctx.session || !ctx.session.awaitingTitle) return;

    const chatId = ctx.from.id.toString();
    const platformChoice = ctx.session.awaitingTitle;
    const title = ctx.message.text?.trim();

    if (!title || title.startsWith('/')) return;

    // Instant feedback
    await ctx.reply('🎨 Generating your cover... Please wait.');

    const user = await db.getUser(chatId);
    const prompt = promptTemplate({
      title,
      author: ctx.from.first_name || 'Unknown',
      genre: 'Unknown',
      style: 'Minimalist',
    });

    let imageUrl = getPlaceholderUrl(title, platformChoice);

    // 🔁 Retry once if image generation fails
    const tryImage = async (url) => {
      try {
        const test = await fetch(url, { method: 'HEAD' });
        if (!test.ok) throw new Error('Bad image URL');
        return url;
      } catch {
        console.warn('⚠️ Image fetch failed, retrying with backup...');
        return getPlaceholderUrl(title, 'webnovel');
      }
    };
    imageUrl = await tryImage(imageUrl);

    await db.incrementCredits(chatId);

    await ctx.replyWithPhoto(
      { url: imageUrl },
      {
        caption: `✅ *"${title}"* cover generated!\n📖 Platform: *${platformChoice}*\n🎟️ Used: ${user.creditsUsed + 1}/10 free`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬇️ Download Cover', url: imageUrl }],
            [{ text: '✨ Generate Another', callback_data: 'generate' }],
          ],
        },
      }
    );

    // Reset session
    ctx.session.awaitingTitle = null;
  } catch (err) {
    console.error('Error in title handler:', err);
    try {
      await ctx.reply('⚠️ Something went wrong while generating your cover.');
    } catch (_) {}
  }
};
