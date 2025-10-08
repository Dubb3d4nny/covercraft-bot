const db = require('../db/firebase');
const flutterwave = require('../services/flutterwave');

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

  // Placeholder flow for asking book details
  ctx.reply('Please reply with your book title.');
  ctx.telegram.once('text', async (msgCtx) => {
    const title = msgCtx.message.text;
    ctx.reply(`Great! Generating your cover for "${title}"...`);

    // Here you would call AI image generation + overlay logic
    // For now, just simulate success
    await db.incrementCredits(chatId);

    ctx.reply(`✅ Cover for "${title}" generated! (placeholder image)`);
  });
};
