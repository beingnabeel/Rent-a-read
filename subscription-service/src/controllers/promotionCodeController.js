const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const PromotionCode = require("../models/promotionCode");
const Coupon = require("../models/coupon");

exports.createPromotionCode = catchAsync(async (req, res, next) => {
  const {
    code,
    couponId,
    maxRedemptions,
    expiresAt,
    firstTimeTransaction,
    metadata,
  } = req.body;

  // Find the associated coupon
  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    return next(new AppError("Coupon not found", 404));
  }

  // Create promotion code in Stripe
  const promotionCode = await stripe.promotionCodes.create({
    coupon: coupon.stripeCouponId,
    code,
    max_redemptions: maxRedemptions,
    expires_at: expiresAt
      ? Math.floor(new Date(expiresAt).getTime() / 1000)
      : undefined,
    restrictions: {
      first_time_transaction: firstTimeTransaction,
    },
    metadata,
  });

  // Create promotion code in database
  const newPromotionCode = await PromotionCode.create({
    code,
    couponId,
    stripePromotionCodeId: promotionCode.id,
    maxRedemptions,
    firstTimeTransaction,
    expiresAt,
    metadata,
  });

  res.status(201).json({
    status: "success",
    data: {
      promotionCode: newPromotionCode,
    },
  });
});

exports.getAllPromotionCodes = catchAsync(async (req, res) => {
  const promotionCodes = await PromotionCode.find();

  res.status(200).json({
    status: "success",
    results: promotionCodes.length,
    data: {
      promotionCodes,
    },
  });
});

exports.getPromotionCode = catchAsync(async (req, res, next) => {
  const promotionCode = await PromotionCode.findById(req.params.id);

  if (!promotionCode) {
    return next(new AppError("Promotion code not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      promotionCode,
    },
  });
});

exports.updatePromotionCode = catchAsync(async (req, res, next) => {
  const promotionCode = await PromotionCode.findById(req.params.id);

  if (!promotionCode) {
    return next(new AppError("Promotion code not found", 404));
  }

  // Update in Stripe
  await stripe.promotionCodes.update(promotionCode.stripePromotionCodeId, {
    active: req.body.active,
  });

  // Update in database
  const updatedPromotionCode = await PromotionCode.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    status: "success",
    data: {
      promotionCode: updatedPromotionCode,
    },
  });
});
