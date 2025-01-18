const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const stripeService = require("../services/stripeService");

exports.createStripeCustomer = async (email, name) => {
  return await stripe.customers.create({
    email,
    name,
  });
};

exports.createStripeProduct = async (name) => {
  return await stripe.products.create({
    name,
  });
};

exports.createStripePrice = async (amount, productId, nickname) => {
  return await stripe.prices.create({
    unit_amount: amount * 100, // Convert to cents
    currency: "inr",
    recurring: {
      interval: "month",
    },
    product: productId,
    nickname,
  });
};

exports.createStripeSubscription = async (customerId, priceId) => {
  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payment_intent"],
  });
};

exports.cancelStripeSubscription = async (subscriptionId) => {
  return await stripe.subscriptions.cancel(subscriptionId);
};

exports.createPaymentIntent = async (amount, customerId) => {
  return await stripe.paymentIntents.create({
    amount: amount * 100,
    currency: "inr",
    customer: customerId,
    payment_method_types: ["card"],
  });
};

exports.retrievePaymentIntent = async (paymentIntentId) => {
  return await stripe.paymentIntents.retrieve(paymentIntentId);
};
