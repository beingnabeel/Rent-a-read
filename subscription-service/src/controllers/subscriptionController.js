const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const PlanFrequencyType = require("../models/planFrequencyType");
const PlanOptionType = require("../models/planOptionType");
const Subscription = require("../models/subscription");
const APIFeatures = require("../utils/apiFeatures");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const stripeService = require("../services/stripeService");
const { response } = require("../../app");
const PromotionCode = require("../models/promotionCode");

const calculateEndDate = (startDate, durationInMonths) => {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + durationInMonths);
  return date;
};

// Add this helper function
const getSessionDetails = async (sessionId) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    console.error("Error retrieving session:", error);
    throw error;
  }
};

exports.createSubscription = catchAsync(async (req, res, next) => {
  const { userId, planFrequencyTypeId, planOptionTypeId, paymentId } = req.body;

  // Get plan details
  const planFrequency = await PlanFrequencyType.findById(planFrequencyTypeId);
  const planOption = await PlanOptionType.findById(planOptionTypeId);

  if (!planFrequency) {
    return next(new AppError("Invalid plan frequency type ID", 400));
  }

  if (!planOption) {
    return next(new AppError("Invalid plan option type ID", 400));
  }

  // Validate books count compatibility
  if (planFrequency.booksCount > planOption.maxNoOfBooks) {
    return next(
      new AppError(
        "Selected plans are not compatible. Frequency plan's books count exceeds option plan's maximum allowed books.",
        400
      )
    );
  }

  // Calculate total price
  const calculatedPlanPrice = planOption.price + planFrequency.registrationFee;

  // Calculate end date based on durationInMonths
  const startDate = new Date();
  const endDate = calculateEndDate(startDate, planOption.durationInMonths);

  const subscription = await Subscription.create({
    userId,
    planFrequencyTypeId,
    planOptionTypeId,
    calculatedPlanPrice,
    maxBooksAllowed: planFrequency.booksCount,
    startDate,
    endDate,
    paymentId,
  });

  res.status(201).json({
    status: "success",
    data: {
      subscription,
    },
  });
});

exports.getSubscription = catchAsync(async (req, res, next) => {
  const subscription = await Subscription.findById(req.params.id);

  if (!subscription) {
    return next(new AppError("No subscription found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      subscription,
    },
  });
});

exports.getAllSubscriptions = catchAsync(async (req, res, next) => {
  console.log("Request query: ", req.query);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  let query = Subscription.find();
  const features = new APIFeatures(query, req.query).filter().search();

  const totalDocuments = await Subscription.countDocuments(
    features.query.getFilter()
  );

  features.sort().limitFields().paginate();
  const subscriptions = await features.query;

  if (!subscriptions) {
    return res.status(200).json({
      data: [],
      pageNumber: page,
      pageSize: limit,
      totalPages: 0,
      totalDocuments: 0,
      first: true,
      last: true,
      numberOfDocuments: 0,
    });
  }

  const totalPages = Math.ceil(totalDocuments / limit);
  const formattedResponse = {
    data: subscriptions,
    pageNumber: page,
    pageSize: limit,
    totalPages: totalPages,
    totalDocuments: totalDocuments,
    first: page === 1,
    last: page === totalPages,
    numberOfDocuments: subscriptions.length,
  };

  res.status(200).json({
    status: "success",
    data: formattedResponse,
  });
});

exports.deleteSubscription = catchAsync(async (req, res, next) => {
  const subscription = await Subscription.findByIdAndUpdate(
    req.params.id,
    { status: "INACTIVE" },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!subscription) {
    return next(new AppError("No subscription found with that ID", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});

exports.initializeSubscription = catchAsync(async (req, res, next) => {
  const {
    userId,
    planFrequencyTypeId,
    planOptionTypeId,
    email,
    name,
    promotionCode,
  } = req.body;

  // Check for existing active subscription
  const existingSubscription = await Subscription.findOne({
    userId,
    status: "ACTIVE",
    paymentStatus: { $in: ["succeeded", "paid"] },
    endDate: { $gt: new Date() }, // Check if subscription hasn't expired
  });

  if (existingSubscription) {
    const endDate = new Date(existingSubscription.endDate).toLocaleDateString();
    return next(
      new AppError(
        `You already have an active subscription that expires on ${endDate}. Please wait for your current subscription to end or cancel it before purchasing a new one.`,
        400
      )
    );
  }

  // Get plan details with explicit population
  const planFrequency = await PlanFrequencyType.findById(planFrequencyTypeId)
    .populate("planOptionTypeIds")
    .exec();

  const planOption = await PlanOptionType.findById(planOptionTypeId);

  if (!planFrequency || !planOption) {
    return next(new AppError("Invalid plan selection", 400));
  }

  // Validate plan option compatibility
  const isValidPlanOption = planFrequency.planOptionTypeIds.some(
    (planOpt) => planOpt._id.toString() === planOptionTypeId
  );

  if (!isValidPlanOption) {
    return next(
      new AppError(
        "Selected plan option is not compatible with the chosen frequency plan",
        400
      )
    );
  }

  // Calculate original price
  const originalPrice = planOption.price + planFrequency.registrationFee;
  let finalPrice = originalPrice;
  let discountAmount = 0;
  let appliedPromotionCodeId = null;
  let promoCode = null;
  let stripeCustomer;
  let session;

  try {
    // Create or get Stripe customer
    stripeCustomer = await stripeService.createStripeCustomer(email, name);

    // Handle promotion code if provided
    if (promotionCode) {
      promoCode = await PromotionCode.findOne({
        code: promotionCode,
        active: true,
      }).populate("couponId");

      if (!promoCode) {
        return next(new AppError("Invalid or inactive promotion code", 400));
      }

      if (promoCode.expiresAt && new Date(promoCode.expiresAt) < new Date()) {
        return next(new AppError("Promotion code has expired", 400));
      }

      appliedPromotionCodeId = promoCode._id;
    }

    // Get the client URL with fallback
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

    // Create Stripe Checkout Session
    session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `${planOption.title} - ${planFrequency.name}`,
            },
            unit_amount: originalPrice * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      discounts: promoCode
        ? [
            {
              promotion_code: promoCode.stripePromotionCodeId,
            },
          ]
        : [],
      success_url: `${clientUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/subscription/cancel`,
    });

    // Create subscription record
    const subscription = await Subscription.create({
      userId,
      planFrequencyTypeId,
      planOptionTypeId,
      calculatedPlanPrice: finalPrice,
      maxBooksAllowed: planFrequency.booksCount,
      stripeSessionId: session.id,
      stripeSubscriptionId: "pending",
      stripePaymentIntentId: "pending",
      paymentStatus: "pending",
      startDate: new Date(),
      endDate: calculateEndDate(new Date(), planOption.durationInMonths),
      appliedPromotionCodeId,
      discountAmount,
      originalPrice,
      finalPrice,
    });

    res.status(200).json({
      status: "success",
      data: {
        subscription,
        sessionId: session.id,
        checkoutUrl: session.url,
      },
    });
  } catch (error) {
    if (error.message.includes("Invalid URL")) {
      return next(
        new AppError(
          "Client URL is not properly configured. Please check environment variables.",
          500
        )
      );
    }
    return next(
      new AppError(
        `Error creating subscription: ${error.message}`,
        error.statusCode || 500
      )
    );
  }
});

exports.confirmSubscription = catchAsync(async (req, res, next) => {
  const { sessionId } = req.body;

  const subscription = await Subscription.findOneAndUpdate(
    { stripeSessionId: sessionId },
    {
      paymentStatus: "succeeded",
    },
    { new: true }
  );

  if (!subscription) {
    return next(
      new AppError("No subscription found with that session ID", 404)
    );
  }

  res.status(200).json({
    status: "success",
    data: {
      subscription,
    },
  });
});

// Cancel subscription
exports.cancelSubscription = catchAsync(async (req, res, next) => {
  const { subscriptionId } = req.params;

  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    return next(new AppError("Subscription not found", 404));
  }

  if (subscription.stripeSubscriptionId) {
    await stripeService.cancelStripeSubscription(
      subscription.stripeSubscriptionId
    );
  }

  subscription.status = "CANCELLED";
  subscription.cancelledAt = new Date();
  await subscription.save();

  res.status(200).json({
    status: "success",
    data: {
      subscription,
    },
  });
});

exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log("Webhook Event Type:", event.type);
    console.log(
      "Webhook Event Data:",
      JSON.stringify(event.data.object, null, 2)
    );

    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        console.log("Processing checkout.session.completed");
        console.log("Session ID:", session.id);

        // Update subscription in database
        const updatedSubscription = await Subscription.findOneAndUpdate(
          { stripeSessionId: session.id },
          {
            paymentStatus: "succeeded",
            stripePaymentIntentId: session.payment_intent,
            stripeSubscriptionId: session.subscription || "one-time-payment",
          },
          { new: true }
        );

        console.log("Updated subscription:", updatedSubscription);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

// Add new endpoint
exports.getSessionDetails = catchAsync(async (req, res, next) => {
  const { sessionId } = req.params;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "subscription"],
    });

    // Update subscription with payment intent details
    const subscription = await Subscription.findOneAndUpdate(
      { stripeSessionId: sessionId },
      {
        stripePaymentIntentId: session.payment_intent?.id || "pending",
        paymentStatus: session.payment_status,
        stripeSubscriptionId: session.subscription?.id || "one_time_payment",
      },
      { new: true }
    );

    if (!subscription) {
      return next(
        new AppError("No subscription found with that session ID", 404)
      );
    }

    res.status(200).json({
      status: "success",
      data: {
        subscription,
        session: {
          id: session.id,
          paymentStatus: session.payment_status,
          paymentIntentId: session.payment_intent?.id,
          subscriptionId: session.subscription?.id,
          customerEmail: session.customer_email,
          amountTotal: session.amount_total,
        },
      },
    });
  } catch (error) {
    return next(
      new AppError(`Error fetching session details: ${error.message}`, 400)
    );
  }
});

// router.post(
//   "/subscriptions/confirm-payment",
//   validator(subscriptionValidator.confirmPaymentSchema),
//   subscriptionController.confirmSubscriptionPayment
// );
// // Add other CRUD operations here...

exports.getUserActiveSubscription = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  const subscription = await Subscription.findOne({
    userId,
    status: "ACTIVE",
    paymentStatus: { $in: ["succeeded", "paid"] },
    endDate: { $gt: new Date() },
  });

  if (!subscription) {
    return next(
      new AppError("No active subscription found for this user", 404)
    );
  }

  res.status(200).json({
    status: "success",
    data: {
      subscription,
    },
  });
});
