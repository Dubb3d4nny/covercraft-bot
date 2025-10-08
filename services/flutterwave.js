
const fetch = require('node-fetch');

const SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || '';
const CURRENCY = "USD"; // $1 per cover

/**
 * Create a Flutterwave payment link
 * @param {string} userId - Telegram user ID
 * @param {string} userName - Telegram user's name
 * @param {string} email - Telegram user's email (optional)
 * @returns {string|null} checkout_url
 */
async function createPayment(userId, userName, email) {
  if (!SECRET_KEY) throw new Error("FLUTTERWAVE_SECRET_KEY is not set in environment variables.");

  const tx_ref = `cover_${userId}_${Date.now()}`;

  const body = {
    tx_ref,
    amount: "1",
    currency: CURRENCY,
    redirect_url: "https://your-redirect-url.com", // dummy or your site
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

  try {
    const res = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.status === 'success' && data.data) {
      return data.data.link; // checkout_url
    } else {
      console.error('Flutterwave API error:', data);
      return null;
    }
  } catch (err) {
    console.error('Flutterwave fetch error:', err);
    return null;
  }
}

module.exports = { createPayment };
