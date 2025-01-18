const Joi = require("joi");
const language = require("../models/languageModel");
const AppError = require("../utils/appError");

const languageSchema = Joi.object({
  name: Joi.string().min(2).max(50).trim().required().messages({
    "string.base": "Name must be a string",
    "string.empty": "Name is required",
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name cannot exceed 50 characters",
    "any.required": "Name is required",
  }),

  code: Joi.string()
    .min(2)
    .max(3)
    .trim()
    .uppercase()
    .pattern(/^[A-Z]{2,3}$/)
    .required()
    .messages({
      "string.base": "Code must be a string",
      "string.empty": "Code is required",
      "string.min": "Code must be at least 2 characters long",
      "string.max": "Code cannot exceed 3 characters",
      "string.pattern.base": "Code must be 2 or 3 uppercase letters",
      "any.required": "Code is required",
    }),

  status: Joi.string().valid("ACTIVE", "INACTIVE").default("ACTIVE").messages({
    "any.only": "Status must be either ACTIVE or INACTIVE",
  }),
});

exports.validateCreateLanguage = async (req, res, next) => {
  try {
    const { error } = languageSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({ errors });
    }

    // Check if language code already exists
    const existingLanguage = await language.findOne({ code: req.body.code });
    if (existingLanguage) {
      return next(new AppError("Language code already exists.", 400));
    }

    next();
  } catch (err) {
    next(err);
  }
};

exports.validateUpdateLanguage = async (req, res, next) => {
  try {
    const updateSchema = languageSchema
      .keys({
        name: Joi.string().min(2).max(50).trim(),
        code: Joi.string()
          .min(2)
          .max(3)
          .trim()
          .uppercase()
          .pattern(/^[A-Z]{2,3}$/),
        status: Joi.string().valid("ACTIVE", "INACTIVE"),
      })
      .min(1); // Ensure at least one field is present for update

    const { error } = updateSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({ errors });
    }

    // If code is being updated, check if it already exists
    if (req.body.code) {
      const existingLanguage = await language.findOne({
        code: req.body.code,
        _id: { $ne: req.params.id },
      });
      if (existingLanguage) {
        return next(new AppError("Language code already exists.", 400));
      }
    }

    next();
  } catch (err) {
    next(err);
  }
};
