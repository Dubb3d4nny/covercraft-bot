// commands/generate.js — CoverCraft Stable+Gemini Ready Edition
const db = require('../db/firebase');
const promptTemplate = require('../utils/promptTemplate');
const flutterwave = require('../services/flutterwave');
const fetch = require('node-fetch'); // Ensure installed: npm i node-fetch

const platforms = {
  webnovel: { width: 512, height: 800 },
  letterlux: { width: 1600, height: 2560 },
};

// ✅ Image fallback with optional Gemini hook
async function getImageUrl(title, platform = 'webnovel') {
  const { width, height } = platforms[platform];
  const safeTitle = encodeURIComponent(title.slice(0, 50));
  const baseUrl =
    process.env.PLACEHOLDER_URL || 'https://placehold.co';

  // 🚀 Future-ready: Gemini Image API (optional)
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateImage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
        },
        body: JSON.stringify({
          prompt: `Minimalist book cover titled "${title}" optimized for ${platform} platform.`,
          size: `${width}x${height}`,
        }),
      });

      const data = await res.json();
      if (data && data.imageUrl) return data.imageUrl;
      console.warn('⚠️ Gemini image generation fallback triggered.');
    } catch (err) {
      console.error('Gemini API error:', err.message);
    }
  }

  // 🩹 Default fallback placeholder
  return `${baseUrl}/${width}x${height}/cccccc/000000.png?text=${safeTitle}`;
}

// --- PRIMARY HANDLER ---
exports.handler = async (ctx) => {
  try {
    const chatId = ctx.from.id.toString();
    const user = await db.getUser(chatId);

    // Step 0: Enforce free credits strictly
    const used = user?.creditsUsed || 0;
    const balance = user?.balance || 0;

    if (used >= 10 && balance <= 0) {
      const paymentUrl = await flutterwave.createPayment(
        chatId,
        ctx.from.first_name,
        ctx.from.username
      );

      return await ctx.reply(
        `💳 You’ve used your *10 free covers*. To continue, please make a small $1 payment.`,
        {
          parse_mode: 'Markdown',
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
          [{ text: '🌐 Webnovel', callback_data: 'generate:webnovel' }],
          [{ text: '✨ Letterlux', callback_data: 'generate:letterlux' }],
          [{ text: '❌ Cancel', callback_data: 'cancel' }],
        ],
      },
    });
  } catch (err) {
    console.error('Error in generate.js handler:', err);
    try {
      await ctx.reply('⚠️ Something went wrong. Please try again shortly.');
    } catch (_) {}
  }
};

// --- PLATFORM SELECTION ---
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

// --- TITLE HANDLER ---
exports.handleTitle = async (ctx) => {
  try {
    if (!ctx.session?.awaitingTitle) return;

    const chatId = ctx.from.id.toString();
    const platformChoice = ctx.session.awaitingTitle;
    const title = ctx.message.text?.trim();
    if (!title || title.startsWith('/')) return;

    await ctx.reply('🎨 Generating your cover... Please wait.');

    const user = await db.getUser(chatId);

    // Strict credit enforcement
    if (user.creditsUsed >= 10 && (!user.balance || user.balance <= 0)) {
      const paymentUrl = await flutterwave.createPayment(
        chatId,
        ctx.from.first_name,
        ctx.from.username
      );

      return await ctx.reply(
        `🚫 You’ve reached your 10 free covers limit.\n💳 Please pay $1 to unlock more generations.`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: 'Pay $1', url: paymentUrl }]],
          },
        }
      );
    }

    const prompt = promptTemplate({
      title,
      author: ctx.from.first_name || 'Unknown',
      genre: 'Unknown',
      style: 'Minimalist',
    });

    let imageUrl = await getImageUrl(title, platformChoice);

    // Double-check URL works
    try {
      const res = await fetch(imageUrl, { method: 'HEAD' });
      if (!res.ok) throw new Error('Bad image URL');
    } catch {
      console.warn('⚠️ Image URL failed validation, fallback triggered.');
      imageUrl = await getImageUrl(title, 'webnovel');
    }

    // Update credits
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

    ctx.session.awaitingTitle = null;
  } catch (err) {
    console.error('Error in title handler:', err);
    try {
      await ctx.reply('⚠️ Something went wrong while generating your cover.');
    } catch (_) {}
  }
};
