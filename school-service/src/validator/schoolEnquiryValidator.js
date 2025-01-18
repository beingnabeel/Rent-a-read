const Joi = require("joi");

const schoolEnquirySchema = Joi.object({
  name: Joi.string().min(2).max(50).required().trim().messages({
    "string.base": "Name must be a string",
    "string.empty": "Name is required",
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name cannot exceed 50 characters",
    "any.required": "Name is required",
  }),

  designation: Joi.string().max(50).trim().allow("").messages({
    "string.base": "Designation must be a string",
    "string.max": "Designation cannot exceed 50 characters",
  }),

  mobile: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
      "string.base": "Mobile number must be a string",
      "string.empty": "Mobile number is required",
      "string.pattern.base": "Invalid Indian mobile number",
      "any.required": "Mobile number is required",
    }),

  email: Joi.string().email().required().lowercase().trim().messages({
    "string.base": "Email must be a string",
    "string.email": "Invalid email address",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),

  schoolName: Joi.string().min(2).max(100).required().trim().messages({
    "string.base": "School name must be a string",
    "string.empty": "School name is required",
    "string.min": "School name must be at least 2 characters long",
    "string.max": "School name cannot exceed 100 characters",
    "any.required": "School name is required",
  }),

  address: Joi.string().min(5).max(200).required().trim().messages({
    "string.base": "Address must be a string",
    "string.empty": "Address is required",
    "string.min": "Address must be at least 5 characters long",
    "string.max": "Address cannot exceed 200 characters",
    "any.required": "Address is required",
  }),
});

const validateSchoolEnquiry = (req, res, next) => {
  const { error } = schoolEnquirySchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    return res.status(400).json({
      status: "fail",
      message: "Invalid input data",
      errors: errorMessages,
    });
  }

  next();
};

module.exports = validateSchoolEnquiry;
