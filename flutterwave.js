exports.createPayment = async ({ amount, email, tx_ref }) => {
  // Sandbox / placeholder payment
  return {
    checkout_url: `https://flutterwave.com/pay/placeholder_${tx_ref}`,
    id: tx_ref
  };
};

exports.handleWebhook = async (payload) => {
  // Optional: simulate credit update after payment
  return true;
};
