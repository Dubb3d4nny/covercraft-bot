const db = require('../db/firebase');
const flutterwave = require('../services/flutterwave');
const promptTemplate = require('../utils/promptTemplate');

exports.handler = async (ctx) => {
  const chatId = ctx.from.id.toString();
  const user = await db.getUser(chatId);

  // Check if user exceeded 10 free covers
  if (user.creditsUsed >= 10 && user.balance <= 0) {
    const payment = await flutterwave.createPayment({
      amount: 1,
      email: ctx.from.username || 'no-reply@example.com',
      tx_ref: `cover_${chatId}_${Date.now()}`
    });

    return ctx.reply(
      `You used your 10 free covers. Pay $1 to generate more.`,
      Markup.inlineKeyboard([
        Markup.urlButton('Pay $1', payment.checkout_url)
      ])
    );
  }

  // Ask for book title
  ctx.reply('Please reply with your book title.');

  const listener = async (msgCtx) => {
    const title = msgCtx.message.text;
    const prompt = promptTemplate({ title, author: ctx.from.first_name, genre: 'Unknown', style: 'Minimalist' });

    // Placeholder: generate image using a placeholder URL
    const imageUrl = `https://via.placeholder.com/512x512.png?text=${encodeURIComponent(title)}`;

    await db.incrementCredits(chatId);

    ctx.replyWithPhoto({ url: imageUrl }, { caption: `✅ Cover for "${title}" generated!\nUsed: ${user.creditsUsed + 1}/10 free` });

    // Remove this listener after use to avoid multiple triggers
    ctx.telegram.off('text', listener);
  };

  ctx.telegram.on('text', listener);
};
