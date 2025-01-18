import asyncHandler from "express-async-handler";
import { uploadToS3 } from "../utils/s3Uploader.js";
import Category from "../models/ebookCategorySchema.js";
import logger from "../utils/logger.js";
import { CATEGORY_ERRORS, STATUS_CODES } from "../utils/constant.js";
import ErrorResponse from "../utils/errorResponse.js";
import dotenv from "dotenv";
dotenv.config();

// @desc    Create a new category with image upload to S3
// @route   POST /api/category/createCategory
// @access  Private
const createCategory = asyncHandler(async (req, res, next) => {
  const { title, description } = req.body;

  // Check if the file exists
  if (!req.files || !req.files.imageUrl) {
    return next(
      new ErrorResponse(STATUS_CODES.BAD_REQUEST, CATEGORY_ERRORS.NO_FILE_FOUND)
    );
  }

  try {
    // Proceed with category creation logic
    const imageUrl = await uploadToS3(req.files.imageUrl[0], "categories");
    const category = await Category.create({ title, description, imageUrl });

    res.status(STATUS_CODES.CREATED).json({
      success: true,
      message: CATEGORY_ERRORS.CATEGORY_CREATED,
      category,
    });
  } catch (error) {
    logger.error(`Error creating category: ${error.message}`);
    next(
      new ErrorResponse(STATUS_CODES.SERVER_ERROR, "Category creation failed")
    );
  }
});

// @desc    Get all categories
// @route   GET /api/category
// @access  Public
const getAllCategories = asyncHandler(async (req, res, next) => {
  try {
    logger.info(`Fetching all categories`);

    // Use advancedResults if it exists
    if (res.advancedResults) {
      return res.status(STATUS_CODES.OK).json(res.advancedResults);
    }

    // Fallback logic if advancedResults is not used
    const categories = await Category.find();

    return res.status(STATUS_CODES.OK).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    logger.error(`Error fetching categories: ${error.message}`);
    return next(
      new ErrorResponse(
        STATUS_CODES.SERVER_ERROR,
        CATEGORY_ERRORS.CATEGORIES_FETCH_ERROR
      )
    );
  }
});

// @desc    Get a single category by ID
// @route   GET /api/category/:id
// @access  Public
const getCategoryById = asyncHandler(async (req, res, next) => {
  try {
    const id = req.params.id;
    logger.info(`Fetching category with ID: ${id}`);

    const category = await Category.findById(id);

    if (!category) {
      return next(
        new ErrorResponse(
          STATUS_CODES.NOT_FOUND,
          CATEGORY_ERRORS.CATEGORY_NOT_FOUND
        )
      );
    }

    return res.status(STATUS_CODES.OK).json({
      success: true,
      category,
    });
  } catch (error) {
    logger.error(`Error fetching category: ${error.message}`);
    return next(
      new ErrorResponse(
        STATUS_CODES.SERVER_ERROR,
        CATEGORY_ERRORS.CATEGORY_FETCH_ERROR
      )
    );
  }
});

// @desc    Update a category
// @route   PUT /api/category/:id
// @access  Private
const updateCategory = asyncHandler(async (req, res, next) => {
  try {
    const id = req.params.id;
    let updates = req.body;

    logger.debug(`Update ID: ${id}`);
    logger.debug(`Update Data: ${JSON.stringify(updates)}`);
    logger.debug(
      `Uploaded File: ${req.files ? req.files.imageUrl : "No file uploaded"}`
    );

    // If a file is provided, upload it and update the imageUrl
    if (req.files && req.files.imageUrl) {
      try {
        logger.info(`Uploading new image for category ID: ${id}`);
        const imageUrl = await uploadToS3(req.files.imageUrl[0], "categories");
        updates.imageUrl = imageUrl;
        logger.debug(`New Image URL: ${imageUrl}`);
      } catch (uploadError) {
        logger.error(`Error uploading file to S3: ${uploadError.message}`);
        return next(
          new ErrorResponse(
            STATUS_CODES.SERVER_ERROR,
            CATEGORY_ERRORS.IMAGE_UPLOAD_ERROR
          )
        );
      }
    } else {
      logger.warn(
        `No file uploaded for category ID: ${id}. Skipping image update.`
      );
    }

    // Update the category in the database
    const category = await Category.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      return next(
        new ErrorResponse(
          STATUS_CODES.NOT_FOUND,
          CATEGORY_ERRORS.CATEGORY_NOT_FOUND
        )
      );
    }

    logger.debug(`Category updated successfully: ${JSON.stringify(category)}`);

    return res.status(STATUS_CODES.OK).json({
      success: true,
      message: CATEGORY_ERRORS.CATEGORY_UPDATED,
      category,
    });
  } catch (error) {
    logger.error(`Error updating category: ${error.message}`);
    return next(
      new ErrorResponse(
        STATUS_CODES.SERVER_ERROR,
        CATEGORY_ERRORS.CATEGORY_UPDATE_ERROR
      )
    );
  }
});

// @desc    Soft delete a category (update status to INACTIVE)
// @route   DELETE /api/category/:id
// @access  Private
const deleteCategory = asyncHandler(async (req, res, next) => {
  try {
    const id = req.params.id; // Extract ID from request parameters
    logger.info(`Deleting category with ID: ${id}`);

    // Find the category by ID and delete it permanently
    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return next(
        new ErrorResponse(
          STATUS_CODES.NOT_FOUND,
          CATEGORY_ERRORS.CATEGORY_NOT_FOUND
        )
      );
    }

    logger.debug(`Category deleted successfully: ${id}`);

    return res.status(STATUS_CODES.OK).json({
      success: true,
      message: "Category deleted successfully.",
    });
  } catch (error) {
    logger.error(`Error deleting category: ${error.message}`);
    return next(
      new ErrorResponse(STATUS_CODES.SERVER_ERROR, "Error deleting category.")
    );
  }
});

// Export all controllers
export {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
