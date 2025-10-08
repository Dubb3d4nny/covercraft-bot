require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const generateCmd = require('./commands/generate');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Start command
bot.start((ctx) => ctx.reply(`Welcome to CoverCraft! Send /generate to create a book cover. You get 10 free covers.`));

// Generate command
bot.command('generate', generateCmd.handler);

// Launch bot
bot.launch();
console.log('CoverCraft Bot is running...');
