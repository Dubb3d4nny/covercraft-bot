require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const generateCmd = require('./commands/generate');

const PORT = process.env.PORT || 3000;
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Uptime logging
console.log('🚀 CoverCraft Bot is starting...');
let startTime = Date.now();

// --- EXPRESS HEARTBEAT SERVER (SAFE FOR UPTIMEROBOT) ---
const app = express();

// Health route for uptime monitoring
app.get('/', (req, res) => {
  const uptime = ((Date.now() - startTime) / 1000).toFixed(0);
  res.send(`✅ CoverCraft Bot is alive and running! Uptime: ${uptime}s`);
});

// Keep your server alive on Render
app.listen(PORT, () => console.log(`🌐 Heartbeat server running on port ${PORT}`));

// --- TELEGRAM BOT COMMANDS ---
bot.start((ctx) => {
  ctx.reply(`👋 Welcome to CoverCraft!\nYou get 10 free covers.\nType /generate to create your first book cover.`);
});

bot.command('generate', generateCmd.handler);

// --- GRACEFUL SHUTDOWN ---
process.once('SIGINT', () => {
  console.log('🛑 SIGINT received, stopping bot...');
  bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('🛑 SIGTERM received, stopping bot...');
  bot.stop('SIGTERM');
  process.exit(0);
});

// --- LAUNCH THE BOT ---
bot.launch();
console.log('🤖 CoverCraft Bot is running and ready!');