const db = require('../db/firebase');
const promptTemplate = require('../utils/promptTemplate');
const flutterwave = require('../services/flutterwave');

exports.handler = async (ctx) => {
  const chatId = ctx.from.id.toString();
  const user = await db.getUser(chatId);

  // Check if user exceeded 10 free covers
  if (user.creditsUsed >= 10 && (!user.balance || user.balance <= 0)) {
    const paymentUrl = await flutterwave.createPayment(chatId, ctx.from.first_name, ctx.from.username);

    return ctx.reply(
      `You’ve used your 10 free covers. Pay $1 to generate more.`,
      { reply_markup: { inline_keyboard: [[{ text: "Pay $1", url: paymentUrl }]] } }
    );
  }

  // Ask user for book title
  ctx.reply('Please reply with your book title.');

  // Listener for user reply
  const listener = async (msgCtx) => {
    const title = msgCtx.message.text;

    // Build prompt for future AI integration
    const prompt = promptTemplate({
      title,
      author: ctx.from.first_name,
      genre: 'Unknown',
      style: 'Minimalist'
    });

    // Placeholder image for now
    const imageUrl = `https://via.placeholder.com/512x512.png?text=${encodeURIComponent(title)}`;

    // Increment credits
    await db.incrementCredits(chatId);

    // Reply with the generated cover
    ctx.replyWithPhoto({ url: imageUrl }, {
      caption: `✅ Cover for "${title}" generated!\nUsed: ${user.creditsUsed + 1}/10 free`
    });

    // Remove listener to avoid multiple triggers
    ctx.telegram.off('text', listener);
  };

  ctx.telegram.on('text', listener);
};
