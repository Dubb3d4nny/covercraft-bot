// index.js — CoverCraft Webhook + Heartbeat Edition
require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const generateCmd = require('./commands/generate');

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TELEGRAM_TOKEN;
const BASE_URL = process.env.BASE_URL; // e.g. https://covercraft.onrender.com

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

// --- BOT COMMANDS ---
bot.start((ctx) =>
  ctx.reply(
    `👋 Welcome to CoverCraft!\nYou get 10 free covers.\nType /generate to create your first book cover.`
  )
);
bot.command('generate', generateCmd.handler);

// --- HEARTBEAT + HEALTH ROUTES (for UptimeRobot) ---
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

// Connect Telegraf to Express for incoming Telegram updates
app.use(bot.webhookCallback(webhookPath));

// Start HTTP server
app.listen(PORT, async () => {
  console.log(`🌐 Express server running on port ${PORT}`);

  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`✅ Webhook successfully set: ${webhookUrl}`);
    console.log('🤖 CoverCraft Bot is now live in webhook mode!');
  } catch (err) {
    console.error('⚠️ Failed to set webhook:', err.message);
    process.exit(1);
  }
});

// --- GRACEFUL SHUTDOWN HANDLING ---
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
