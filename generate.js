const db = require('../db/firebase');
const fetch = require('node-fetch');
const promptTemplate = require('../utils/promptTemplate');

const FLW_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
const CURRENCY = "USD"; // $1 per cover

// Helper: create a Flutterwave payment link
async function createFlutterwavePayment(userId, userName, email) {
  const tx_ref = `cover_${userId}_${Date.now()}`;

  const body = {
    tx_ref,
    amount: "1",
    currency: CURRENCY,
    redirect_url: "https://your-redirect-url.com", // can be a dummy URL for Telegram testing
    payment_type: "card",
    customer: {
      email: email || "no-reply@example.com",
      name: userName || "User"
    },
    customizations: {
      title: "CoverCraft Payment",
      description: "Payment for extra book cover"
    }
  };

  const res = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FLW_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  return data.data ? data.data.link : null; // returns checkout_url
}

exports.handler = async (ctx) => {
  const chatId = ctx.from.id.toString();
  const user = await db.getUser(chatId);

  // Check if user exceeded 10 free covers
  if (user.creditsUsed >= 10 && user.balance <= 0) {
    const paymentUrl = await createFlutterwavePayment(chatId, ctx.from.first_name, ctx.from.username);

    return ctx.reply(
      `You’ve used your 10 free covers. Pay $1 to generate more.`,
      { reply_markup: { inline_keyboard: [[{ text: "Pay $1", url: paymentUrl }]] } }
    );
  }

  // Ask for book title
  ctx.reply('Please reply with your book title.');

  // Listener for user reply
  const listener = async (msgCtx) => {
    const title = msgCtx.message.text;
    const prompt = promptTemplate({ title, author: ctx.from.first_name, genre: 'Unknown', style: 'Minimalist' });

    // Placeholder image for now
    const imageUrl = `https://via.placeholder.com/512x512.png?text=${encodeURIComponent(title)}`;

    // Increment credits
    await db.incrementCredits(chatId);

    ctx.replyWithPhoto({ url: imageUrl }, {
      caption: `✅ Cover for "${title}" generated!\nUsed: ${user.creditsUsed + 1}/10 free`
    });

    // Remove listener to avoid multiple triggers
    ctx.telegram.off('text', listener);
  };

  ctx.telegram.on('text', listener);
};
