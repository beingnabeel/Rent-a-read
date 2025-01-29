const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      required: [true, "Subscription must belong to a user"],
    },
    planFrequencyTypeId: {
      type: mongoose.Schema.ObjectId,
      ref: "PlanFrequencyType",
      required: [true, "Subscription must have a frequency type"],
    },
    planOptionTypeId: {
      type: mongoose.Schema.ObjectId,
      ref: "PlanOptionType",
      required: [true, "Subscription must have an option type"],
    },
    calculatedPlanPrice: {
      type: Number,
      required: [true, "Subscription must have a calculated price"],
    },
    maxBooksAllowed: {
      type: Number,
      required: [true, "Subscription must specify maximum books allowed"],
    },
    // Add this field to your schema
    stripeSessionId: {
      type: String,
      required: [true, "Stripe session ID is required"],
    },

    // Update these fields in your schema
    stripeSubscriptionId: {
      type: String,
      required: [true, "Stripe subscription ID is required"],
      default: "pending",
    },
    stripePaymentIntentId: {
      type: String,
      required: [true, "Stripe payment intent ID is required"],
      default: "pending",
    },
    stripeClientSecret: String,
    paymentStatus: {
      type: String,
      enum: ["pending", "succeeded", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentMode: {
      type: String,
      default: "online",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: [true, "Subscription must have an end date"],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "CANCELLED", "EXPIRED"],
      default: "ACTIVE",
    },
    cancelledAt: Date,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,

    // Add new fields for promotions
    appliedPromotionCodeId: {
      type: mongoose.Schema.ObjectId,
      ref: "PromotionCode",
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    originalPrice: {
      type: Number,
      required: [true, "Original price is required"],
    },
    finalPrice: {
      type: Number,
      required: [true, "Final price is required"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Populate references automatically
subscriptionSchema.pre(/^find/, function (next) {
  this.populate({
    path: "planFrequencyTypeId",
    select: "name frequency booksCount registrationFee",
  }).populate({
    path: "planOptionTypeId",
    select: "title price type durationInMonths maxNoOfBooks",
  });
  next();
});

const Subscription = mongoose.model("Subscription", subscriptionSchema);
module.exports = Subscription;
