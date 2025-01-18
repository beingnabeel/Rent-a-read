const Joi = require("joi");
const AppError = require("../utils/appError");

exports.validateQuantityUpdate = (req, res, next) => {
  const schema = Joi.object({
    totalQuantity: Joi.number().integer().min(0),
    availableQuantity: Joi.number().integer().min(0),
    noOfLostBook: Joi.number().integer().min(0),
  }).required();

  const { error, value } = schema.validate(req.body);

  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  req.validatedBody = value;
  next();
};

// Add this validation schema
const addBookToSchoolSchema = Joi.object({
  totalQuantity: Joi.number().integer().min(1).required().messages({
    "number.base": "Total quantity must be a number",
    "number.integer": "Total quantity must be an integer",
    "number.min": "Total quantity must be at least 1",
    "any.required": "Total quantity is required",
  }),
});

exports.validateAddBookToSchool = (req, res, next) => {
  const { error } = addBookToSchoolSchema.validate(req.body);

  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  next();
};

// Add this validation schema
const updateSchoolBookTotalQuantitySchema = Joi.object({
  totalQuantity: Joi.number().integer().min(0).required().messages({
    "number.base": "Total quantity must be a number",
    "number.integer": "Total quantity must be an integer",
    "number.min": "Total quantity cannot be negative",
    "any.required": "Total quantity is required",
  }),
});

exports.validateUpdateSchoolBookTotalQuantity = (req, res, next) => {
  const { error } = updateSchoolBookTotalQuantitySchema.validate(req.body);

  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  next();
};

// Add this validation schema
const updateSchoolBookAvailableQuantitySchema = Joi.object({
  availableQuantity: Joi.number().integer().min(0).required().messages({
    "number.base": "Available quantity must be a number",
    "number.integer": "Available quantity must be an integer",
    "number.min": "Available quantity cannot be negative",
    "any.required": "Available quantity is required",
  }),
});

exports.validateUpdateSchoolBookAvailableQuantity = (req, res, next) => {
  const { error } = updateSchoolBookAvailableQuantitySchema.validate(req.body);

  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  next();
};
