// index.js — CoverCraft Webhook + Auto-Recovery Edition
require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const express = require('express');
const generateCmd = require('./commands/generate');

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TELEGRAM_TOKEN;
const BASE_URL = process.env.BASE_URL;

if (!TOKEN) {
  console.error('❌ Missing TELEGRAM_TOKEN in .env');
  process.exit(1);
}
if (!BASE_URL || !BASE_URL.startsWith('https://')) {
  console.error('❌ BASE_URL must be your Render URL (e.g. https://covercraft.onrender.com)');
  process.exit(1);
}

const bot = new Telegraf(TOKEN);
const app = express();
let startTime = Date.now();

// --- ENABLE SESSION + GLOBAL SAFE MIDDLEWARE ---
bot.use(session());
bot.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('💥 Bot crashed in middleware:', err);
    try {
      await ctx.reply('⚠️ Oops! Something went wrong, please try again.');
    } catch (_) {}
  }
});

// --- START COMMAND ---
bot.start(async (ctx) => {
  try {
    await ctx.reply(
      `👋 Welcome to *CoverCraft!*\nYou get 10 free covers.\nType /generate to create your first book cover.`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('Error in /start command:', err);
  }
});

// --- GENERATE COMMAND ---
bot.command('generate', async (ctx) => {
  try {
    await ctx.reply('⏳ Preparing to generate your cover...');
    await generateCmd.handler(ctx);
  } catch (err) {
    console.error('Error in /generate command:', err);
    await ctx.reply('⚠️ Something went wrong. Please try again.');
  }
});

// --- CALLBACK HANDLER (Platform Selection) ---
bot.on('callback_query', async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;

    if (data.startsWith('generate:')) {
      await ctx.answerCbQuery('✅ Platform selected!');
      await generateCmd.handlePlatform(ctx);
    } else if (data === 'cancel') {
      ctx.session = {};
      await ctx.answerCbQuery('❌ Cancelled.');
      await ctx.reply('🚫 Request cancelled. Type /generate to start again.');
    }
  } catch (err) {
    console.error('Error in callback handler:', err);
    try {
      await ctx.reply('⚠️ Something went wrong with your selection.');
    } catch (_) {}
  }
});

// --- TEXT HANDLER (Book Title Input) ---
bot.on('text', async (ctx) => {
  try {
    await generateCmd.handleTitle(ctx);
  } catch (err) {
    console.error('Error in text handler:', err);
    try {
      await ctx.reply('⚠️ Something went wrong while processing your message.');
    } catch (_) {}
  }
});

// --- CANCEL COMMAND ---
bot.command('cancel', (ctx) => {
  ctx.session = {};
  ctx.reply('🚫 Current process cancelled. Type /generate to start again.');
});

// --- HEARTBEAT ROUTES (for UptimeRobot) ---
app.get('/', (req, res) => {
  const uptime = ((Date.now() - startTime) / 1000).toFixed(0);
  res.send(`✅ CoverCraft Bot is alive and running! Uptime: ${uptime}s`);
});

app.get('/heartbeat', (req, res) => {
  const uptime = ((Date.now() - startTime) / 1000).toFixed(0);
  res.send(`💓 Heartbeat OK — uptime ${uptime}s`);
});

// --- TELEGRAM WEBHOOK SETUP ---
const webhookPath = `/webhook/${TOKEN}`;
const webhookUrl = `${BASE_URL}${webhookPath}`;

app.use(bot.webhookCallback(webhookPath));

// --- START SERVER WITH AUTO-RECOVERY ---
async function startServer() {
  app.listen(PORT, async () => {
    console.log(`🌐 Express server running on port ${PORT}`);

    try {
      await bot.telegram.setWebhook(webhookUrl);
      console.log(`✅ Webhook successfully set: ${webhookUrl}`);
      console.log('🤖 CoverCraft Bot is live in webhook mode!');
    } catch (err) {
      console.error('⚠️ Failed to set webhook:', err.message);
      setTimeout(startServer, 5000); // retry in 5s if webhook setup fails
    }
  });
}
startServer();

// --- GRACEFUL SHUTDOWN ---
process.once('SIGINT', async () => {
  console.log('🛑 SIGINT received — deleting webhook...');
  await bot.telegram.deleteWebhook();
  process.exit(0);
});
process.once('SIGTERM', async () => {
  console.log('🛑 SIGTERM received — deleting webhook...');
  await bot.telegram.deleteWebhook();
  process.exit(0);
});

// --- UNHANDLED ERRORS AUTO-RECOVER ---
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  // Don’t exit — stay alive
});
