const mongoose = require("mongoose");

const promotionCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Promotion code must have a code"],
      unique: true,
      uppercase: true,
    },
    couponId: {
      type: mongoose.Schema.ObjectId,
      ref: "Coupon",
      required: [true, "Promotion code must be associated with a coupon"],
    },
    stripePromotionCodeId: {
      type: String,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    maxRedemptions: Number,
    firstTimeTransaction: {
      type: Boolean,
      default: false,
    },
    expiresAt: Date,
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

promotionCodeSchema.pre(/^find/, function (next) {
  this.populate({
    path: "couponId",
    select: "code type amount duration",
  });
  next();
});

const PromotionCode = mongoose.model("PromotionCode", promotionCodeSchema);
module.exports = PromotionCode;
