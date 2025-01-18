const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon must have a code"],
      unique: true,
      uppercase: true,
    },
    type: {
      type: String,
      required: [true, "Coupon must have a type"],
      enum: ["percentage", "fixed_amount"],
    },
    amount: {
      type: Number,
      required: [true, "Coupon must have an amount"],
      min: [0, "Amount cannot be negative"],
    },
    duration: {
      type: String,
      required: [true, "Coupon must have a duration"],
      enum: ["once", "repeating", "forever"],
    },
    durationInMonths: {
      type: Number,
      validate: {
        validator: function (val) {
          return this.duration !== "repeating" || val > 0;
        },
        message: "Duration in months required for repeating coupons",
      },
    },
    maxRedemptions: {
      type: Number,
      min: [1, "Max redemptions must be at least 1"],
    },
    expiresAt: Date,
    stripeCouponId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = Coupon;
