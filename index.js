require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const generateCmd = require('./commands/generate');
const express = require('express');

const PORT = process.env.PORT || 3000;
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Uptime logging
console.log('CoverCraft Bot is starting...');
let startTime = Date.now();

// Express server for heartbeat / monitoring
const app = express();

app.get('/heartbeat', (req, res) => {
  const uptime = ((Date.now() - startTime) / 1000).toFixed(0);
  res.send(`CoverCraft Bot is alive! Uptime: ${uptime} seconds`);
});

app.listen(PORT, () => console.log(`Heartbeat server running on port ${PORT}`));

// Telegram bot setup
bot.start((ctx) => ctx.reply(`Welcome to CoverCraft! You get 10 free covers. Send /generate to create a book cover.`));

bot.command('generate', generateCmd.handler);

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('SIGINT received, stopping bot...');
  bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('SIGTERM received, stopping bot...');
  bot.stop('SIGTERM');
  process.exit(0);
});

// Launch bot
bot.launch();
console.log('CoverCraft Bot is running...');
