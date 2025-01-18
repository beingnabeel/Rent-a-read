const Joi = require("joi");
const AppError = require("../utils/appError");
const { deleteImage } = require("../utils/s3Upload");

const ParentCategory = require("../models/parentCategoryModel");

const createParentCategorySchema = Joi.object({
  title: Joi.string().min(2).max(100).trim().required().messages({
    "string.base": "Title must be a string",
    "string.empty": "Title is required",
    "string.min": "Title must be at least 2 characters long",
    "string.max": "Title cannot exceed 100 characters",
    "any.required": "Title is required",
  }),
  description: Joi.string().max(500).trim().default("NA").messages({
    "string.base": "Description must be a string",
    "string.max": "Description cannot exceed 500 characters",
  }),
  status: Joi.string().valid("ACTIVE", "INACTIVE").default("ACTIVE").messages({
    "any.only": "Status must be either ACTIVE or INACTIVE",
  }),
});

const updateParentCategorySchema = Joi.object({
  title: Joi.string().min(2).max(100).trim().messages({
    "string.base": "Title must be a string",
    "string.empty": "Title cannot be empty",
    "string.min": "Title must be at least 2 characters long",
    "string.max": "Title cannot exceed 100 characters",
  }),
  description: Joi.string().max(500).trim().messages({
    "string.base": "Description must be a string",
    "string.max": "Description cannot exceed 500 characters",
  }),
  status: Joi.string().valid("ACTIVE", "INACTIVE").messages({
    "any.only": "Status must be either ACTIVE or INACTIVE",
  }),
});

exports.validateCreateParentCategory = async (req, res, next) => {
  try {
    // Log the entire request body and file for debugging
    console.log("Request Body:", req.body);
    console.log("Request File:", req.file);

    // Ensure body exists and is an object
    const body = req.body || {};

    // Validate the extracted fields
    const { error, value } = createParentCategorySchema.validate(
      {
        title: body.title,
        description: body.description,
        status: body.status,
      },
      { abortEarly: false }
    );

    // If validation fails, handle errors
    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.context.key,
        message: detail.message,
      }));

      // If a file was uploaded, delete it
      if (req.file) {
        await deleteImage(req.file.key);
      }

      return res.status(400).json({
        status: "fail",
        message: "Validation error",
        errors,
      });
    }

    // Check if a parent category with the same title already exists
    const existingParentCategory = await ParentCategory.findOne({
      title: value.title,
    });
    if (existingParentCategory) {
      // If a file was uploaded, delete it
      if (req.file) {
        await deleteImage(req.file.key);
      }

      return res.status(400).json({
        status: "fail",
        message: "A parent category with this title already exists",
      });
    }

    // Validate that an image file is uploaded
    if (!req.file) {
      return res.status(400).json({
        status: "fail",
        message: "Image is required",
      });
    }

    // Attach validated values to request for next middleware
    req.validatedBody = value;
    next();
  } catch (error) {
    // If a file was uploaded, delete it
    if (req.file) {
      await deleteImage(req.file.key);
    }

    next(error);
  }
};

//          UPDATED VALIDATE PARENT CATEGORY UPDATES
exports.validateUpdateParentCategory = async (req, res, next) => {
  try {
    // Log the entire request body and file for debugging
    console.log("Update Request Body:", req.body);
    console.log("Update Request File:", req.file);

    // Check if there are any updates (body fields or file)
    const hasBodyUpdates = Object.keys(req.body).length > 0;
    const hasFileUpdate = !!req.file;

    // If no updates at all, return error
    if (!hasBodyUpdates && !hasFileUpdate) {
      return res.status(400).json({
        status: "fail",
        message: "No update data provided",
      });
    }

    // Separate validation for update to allow partial updates
    const updateFields = { ...req.body };
    delete updateFields.imageUrl; // Remove imageUrl from validation

    // Only validate body fields if present
    if (hasBodyUpdates) {
      const { error, value } = updateParentCategorySchema.validate(
        updateFields,
        {
          abortEarly: false,
          allowUnknown: true,
        }
      );

      // If validation fails, delete the uploaded file if exists
      if (error) {
        if (req.file) {
          await deleteImage(req.file.key);
        }

        const errors = error.details.map((detail) => ({
          field: detail.context.key,
          message: detail.message,
        }));

        return res.status(400).json({
          status: "fail",
          message: "Validation error",
          errors,
        });
      }

      // Check for duplicate title (excluding current category)
      if (req.body.title) {
        const existingParentCategory = await ParentCategory.findOne({
          title: req.body.title,
          _id: { $ne: req.params.id },
        });

        if (existingParentCategory) {
          // Delete uploaded file if it exists
          if (req.file) {
            await deleteImage(req.file.key);
          }

          return res.status(400).json({
            status: "fail",
            message: "A parent category with this title already exists",
          });
        }
      }

      // Attach validated values to request for next middleware
      req.validatedBody = value;
    }

    next();
  } catch (error) {
    // Delete uploaded file if exists in case of any unexpected error
    if (req.file) {
      await deleteImage(req.file.key);
    }
    next(error);
  }
};
