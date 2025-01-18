const Joi = require("joi");

exports.createPlanFrequencyTypeSchema = Joi.object({
  name: Joi.string().required(),
  frequency: Joi.string()
    .valid("Weekly", "Bi-weekly", "Monthly", "Semi-Monthly", "Quarterly")
    .required(),
  planOptionTypeIds: Joi.array().items(Joi.string()).min(1).required(),
  booksCount: Joi.number().required().min(1).messages({
    "number.min": "Books count must be at least 1",
  }),
  maxBooksCount: Joi.number().required().min(Joi.ref("booksCount")).messages({
    "number.min":
      "Maximum books count must be greater than or equal to books count",
  }),
  registrationFee: Joi.number().required().min(0).messages({
    "number.min": "Registration fee cannot be negative",
  }),
  status: Joi.string().valid("ACTIVE", "INACTIVE"),
});

exports.createPlanOptionTypeSchema = Joi.object({
  title: Joi.string().required(),
  price: Joi.number().required().min(0),
  type: Joi.string()
    .valid("trial", "quarterly", "half-yearly", "annually")
    .required(),
  durationInMonths: Joi.number().required().min(1).max(12),
  status: Joi.string().valid("ACTIVE", "INACTIVE"),
}).custom((value, helpers) => {
  const { type, durationInMonths } = value;
  const validDurations = {
    trial: 1,
    quarterly: 4,
    "half-yearly": 6,
    annually: 12,
  };

  if (durationInMonths !== validDurations[type]) {
    return helpers.error("any.invalid", {
      message: `Duration in months must be ${validDurations[type]} for ${type} plan type`,
    });
  }
  return value;
});

exports.createSubscriptionSchema = Joi.object({
  userId: Joi.string().required(),
  planFrequencyTypeId: Joi.string().required(),
  planOptionTypeId: Joi.string().required(),
  paymentId: Joi.string().required(),
  paymentMode: Joi.string().valid("online", "offline"),
  status: Joi.string().valid("ACTIVE", "INACTIVE"),
});

exports.updatePlanOptionTypeSchema = Joi.object({
  title: Joi.string(),
  price: Joi.number().min(0),
  type: Joi.string().valid("trial", "quarterly", "half-yearly", "annually"),
  durationInMonths: Joi.number().min(1).max(12),
  maxNoOfBooks: Joi.number().min(1),
  status: Joi.string().valid("ACTIVE", "INACTIVE"),
}).custom((value, helpers) => {
  const { type, durationInMonths } = value;
  if (type && durationInMonths) {
    const validDurations = {
      trial: 1,
      quarterly: 4,
      "half-yearly": 6,
      annually: 12,
    };

    if (durationInMonths !== validDurations[type]) {
      return helpers.error("any.invalid", {
        message: `Duration in months must be ${validDurations[type]} for ${type} plan type`,
      });
    }
  }
  return value;
});

exports.updatePlanFrequencyTypeSchema = Joi.object({
  name: Joi.string(),
  frequency: Joi.string().valid(
    "Weekly",
    "Bi-weekly",
    "Monthly",
    "Semi-Monthly",
    "Quarterly"
  ),
  booksCount: Joi.number().min(1).max(50).messages({
    "number.min": "Books count must be at least 1",
    "number.max": "Books count cannot exceed 50",
  }),
  registrationFee: Joi.number().min(0).messages({
    "number.min": "Registration fee cannot be negative",
  }),
  status: Joi.string().valid("ACTIVE", "INACTIVE"),
});

exports.initializeSubscriptionSchema = Joi.object({
  userId: Joi.string().required(),
  planFrequencyTypeId: Joi.string().required(),
  planOptionTypeId: Joi.string().required(),
  email: Joi.string().email().required(),
  name: Joi.string().required(),
  promotionCode: Joi.string()
    .pattern(/^[a-zA-Z0-9-]+$/)
    .message("Promotion code can only contain letters, numbers, and hyphens"),
});

exports.confirmPaymentSchema = Joi.object({
  sessionId: Joi.string().required(),
});

// Add new validation schema
exports.getSessionDetailsSchema = Joi.object({
  sessionId: Joi.string().required(),
});
