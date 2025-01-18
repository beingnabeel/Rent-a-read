const Joi = require("joi");

exports.createPromotionCodeSchema = Joi.object({
  code: Joi.string()
    .pattern(/^[a-zA-Z0-9-]+$/)
    .message("Promotion code can only contain letters, numbers, and hyphens")
    .required(),
  couponId: Joi.string().required(),
  maxRedemptions: Joi.number().min(1),
  firstTimeTransaction: Joi.boolean(),
  expiresAt: Joi.date().greater("now"),
  metadata: Joi.object(),
});

exports.updatePromotionCodeSchema = Joi.object({
  active: Joi.boolean(),
  maxRedemptions: Joi.number().min(1),
  metadata: Joi.object(),
});
