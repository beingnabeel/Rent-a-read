const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const Coupon = require("../models/coupon");

exports.createCoupon = catchAsync(async (req, res, next) => {
  const {
    code,
    type,
    amount,
    duration,
    durationInMonths,
    maxRedemptions,
    expiresAt,
  } = req.body;

  // Create coupon in Stripe
  const stripeCoupon = await stripe.coupons.create({
    name: code,
    percent_off: type === "percentage" ? amount : undefined,
    amount_off: type === "fixed_amount" ? amount * 100 : undefined, // Convert to cents
    duration,
    duration_in_months: durationInMonths,
    max_redemptions: maxRedemptions,
    currency: type === "fixed_amount" ? "inr" : undefined,
    redeem_by: expiresAt
      ? Math.floor(new Date(expiresAt).getTime() / 1000)
      : undefined,
  });

  // Create coupon in database
  const coupon = await Coupon.create({
    code,
    type,
    amount,
    duration,
    durationInMonths,
    maxRedemptions,
    expiresAt,
    stripeCouponId: stripeCoupon.id,
  });

  res.status(201).json({
    status: "success",
    data: { coupon },
  });
});

exports.getAllCoupons = catchAsync(async (req, res, next) => {
  const coupons = await Coupon.find();

  res.status(200).json({
    status: "success",
    results: coupons.length,
    data: { coupons },
  });
});

exports.getCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return next(new AppError("No coupon found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: { coupon },
  });
});

exports.deleteCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return next(new AppError("No coupon found with that ID", 404));
  }

  // Delete from Stripe
  await stripe.coupons.del(coupon.stripeCouponId);

  // Delete from database
  await Coupon.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: "success",
    data: null,
  });
});
