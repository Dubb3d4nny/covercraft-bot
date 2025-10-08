const fetch = require('node-fetch');

exports.createPayment = async ({ amount, email, tx_ref }) => {
  // Placeholder: you will replace with your real Flutterwave keys
  return {
    checkout_url: `https://flutterwave.com/pay/placeholder_${tx_ref}`,
    id: tx_ref
  };
};

exports.handleWebhook = async (payload) => {
  // Placeholder: handle webhook and update user credits in db
  return true;
};
