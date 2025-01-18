const Joi = require("joi");

exports.createCouponSchema = Joi.object({
  code: Joi.string().required(),
  type: Joi.string().valid("percentage", "fixed_amount").required(),
  amount: Joi.number()
    .min(0)
    .when("type", {
      is: "percentage",
      then: Joi.number().max(100),
    })
    .required(),
  duration: Joi.string().valid("once", "repeating", "forever").required(),
  durationInMonths: Joi.number().when("duration", {
    is: "repeating",
    then: Joi.required(),
  }),
  maxRedemptions: Joi.number().min(1),
  expiresAt: Joi.date().greater("now"),
});
