const Joi = require("joi");
const AppError = require("../utils/appError");
const Category = require("../models/categoryModel");
const ParentCategory = require("../models/parentCategoryModel");

const categorySchema = Joi.object({
  title: Joi.string().min(2).max(100).trim().required(),
  description: Joi.string().max(500).trim().default("NA"),
  status: Joi.string().valid("ACTIVE", "INACTIVE").default("ACTIVE"),
  parentCategoryId: Joi.string().required(),
});

const validateSchema = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.context.label,
      message: detail.message,
    }));
    return res.status(400).json({
      status: "fail",
      message: "Validation error",
      errors,
    });
  }
  next();
};

const checkUniqueTitleAndParentCategory = async (req, res, next) => {
  try {
    const { title, parentCategoryId } = req.body;
    const categoryId = req.params.id; // For update operations

    // Check if the category title already exists
    const titleQuery = { title };
    if (categoryId) {
      titleQuery._id = { $ne: categoryId };
    }
    const existingCategory = await Category.findOne(titleQuery);
    if (existingCategory) {
      return next(
        new AppError("A category with this title already exists", 400)
      );
    }

    // Check if the parent category exists
    if (parentCategoryId) {
      const parentCategory = await ParentCategory.findById(parentCategoryId);
      if (!parentCategory) {
        return next(new AppError("Invalid parent category ID", 400));
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

exports.validateCreateCategory = [
  validateSchema(categorySchema),
  checkUniqueTitleAndParentCategory,
];

exports.validateUpdateCategory = [
  validateSchema(
    categorySchema.fork(Object.keys(categorySchema.describe().keys), (field) =>
      field.optional()
    )
  ),
  checkUniqueTitleAndParentCategory,
];
