const mongoose = require("mongoose");
const {
  uploadImage,
  deleteImage,
  getImageSignedUrl,
} = require("../utils/s3Upload");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const ParentCategory = require("../models/parentCategoryModel");
const APIFeatures = require("../utils/apiFeatures");
const Category = require("../models/categoryModel");
const { logger } = require("../utils/logger");

exports.getAllParentCategories = catchAsync(async (req, res, next) => {
  logger.info("Fetching all parent categories", {
    query: req.query,
    page: req.query.page || 1,
    limit: req.query.limit || 10,
  });

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    let query = ParentCategory.find();

    const features = new APIFeatures(query, req.query).filter().search();
    const totalElements = await ParentCategory.countDocuments(
      features.query.getFilter()
    );
    features.sort().limitFields().paginate();
    const parentCategories = await features.query;

    if (!parentCategories || parentCategories.length === 0) {
      logger.warn("No parent categories found for the given criteria", {
        query: req.query,
        filter: features.query.getFilter(),
      });
    }

    const totalPages = Math.ceil(totalElements / limit);

    const parentCategoriesWithSignedUrls = await Promise.all(
      parentCategories.map(async (category) => {
        const categoryObject = category.toObject();

        if (categoryObject.imageUrl) {
          try {
            const urlParts = new URL(categoryObject.imageUrl);
            const imageKey = urlParts.pathname.slice(1);

            const signedImageUrl = await getImageSignedUrl(imageKey);
            categoryObject.imageUrl = signedImageUrl;
          } catch (error) {
            logger.error(
              "Error generating signed URL for parent category image",
              {
                categoryId: category._id,
                imageUrl: categoryObject.imageUrl,
                error: error.message,
              }
            );
            categoryObject.imageUrl = category.imageUrl;
          }
        }

        return {
          ...categoryObject,
          createdBy: null,
          updatedBy: null,
        };
      })
    );

    logger.info("Parent categories fetched successfully", {
      count: parentCategories.length,
      totalElements,
      page,
      limit,
    });

    res.status(200).json({
      content: parentCategoriesWithSignedUrls,
      pageNumber: page,
      pageSize: limit,
      totalPages,
      totalElements,
      first: page === 1,
      last: page === totalPages,
      numberOfElements: parentCategories.length,
    });
  } catch (error) {
    logger.error("Error fetching parent categories", {
      error: error.message,
      stack: error.stack,
      query: req.query,
    });
    return next(new AppError("Failed to fetch parent categories", 500));
  }
});

exports.getAllParentCategoriesWithCategories = catchAsync(
  async (req, res, next) => {
    logger.info("Fetching all parent categories with categories");

    try {
      const parentCategories = await ParentCategory.find(
        { status: "ACTIVE" },
        "id title"
      ).lean();

      const populatedParentCategories = await Promise.all(
        parentCategories.map(async (parentCategory) => {
          const categories = await Category.find(
            {
              parentCategoryId: parentCategory._id,
              status: "ACTIVE",
            },
            "id title"
          ).lean();

          return {
            id: parentCategory._id,
            title: parentCategory.title,
            categories: categories.map((category) => ({
              id: category._id,
              title: category.title,
            })),
          };
        })
      );

      logger.info("Parent categories with categories fetched successfully", {
        count: parentCategories.length,
      });

      res.status(200).json({
        status: "success",
        data: {
          parentCategories: populatedParentCategories,
        },
      });
    } catch (error) {
      logger.error("Error fetching parent categories with categories", {
        error: error.message,
        stack: error.stack,
      });
      return next(
        new AppError("Failed to fetch parent categories with categories", 500)
      );
    }
  }
);

exports.getAllActiveParentCategories = catchAsync(async (req, res, next) => {
  logger.info("Fetching all active parent categories");

  try {
    const parentCategories = await ParentCategory.find({ status: "ACTIVE" });

    const parentCategoriesWithSignedUrls = await Promise.all(
      parentCategories.map(async (category) => {
        const categoryObject = category.toObject();

        if (categoryObject.imageUrl) {
          try {
            const urlParts = new URL(categoryObject.imageUrl);
            const imageKey = urlParts.pathname.slice(1);

            const signedImageUrl = await getImageSignedUrl(imageKey);
            categoryObject.imageUrl = signedImageUrl;
          } catch (error) {
            logger.error(
              "Error generating signed URL for parent category image",
              {
                categoryId: category._id,
                imageUrl: categoryObject.imageUrl,
                error: error.message,
              }
            );
            categoryObject.imageUrl = category.imageUrl;
          }
        }

        return categoryObject;
      })
    );

    logger.info("Active parent categories fetched successfully", {
      count: parentCategories.length,
    });

    res.status(200).json({
      status: "success",
      data: {
        parentCategories: parentCategoriesWithSignedUrls,
        count: parentCategoriesWithSignedUrls.length,
      },
    });
  } catch (error) {
    logger.error("Error fetching active parent categories", {
      error: error.message,
      stack: error.stack,
    });
    return next(new AppError("Failed to fetch active parent categories", 500));
  }
});

exports.createParentCategory = catchAsync(async (req, res, next) => {
  logger.info("Creating new parent category", {
    categoryData: { ...req.body, image: req.file ? "Present" : "Not present" },
  });

  // Validate that an image file is uploaded
  if (!req.file || !req.file.location) {
    logger.error("Image upload failed during parent category creation", {
      file: req.file,
      body: req.body,
    });
    return next(new AppError("Image upload failed", 400));
  }

  try {
    // Validate required fields
    if (!req.body.title) {
      logger.error("Missing required fields for parent category creation", {
        providedFields: Object.keys(req.body),
      });
      return next(new AppError("Title is required", 400));
    }

    const newParentCategory = await ParentCategory.create({
      ...req.body,
      imageUrl: req.file.location,
    });

    logger.info("Parent category created successfully", {
      categoryId: newParentCategory._id,
      title: newParentCategory.title,
    });

    res.status(201).json({
      status: "success",
      data: {
        parentCategory: newParentCategory,
      },
    });
  } catch (error) {
    // Cleanup uploaded image if category creation fails
    if (req.file && req.file.key) {
      try {
        await deleteImage(req.file.key);
        logger.info(
          "Cleaned up uploaded image after failed parent category creation",
          {
            imageKey: req.file.key,
          }
        );
      } catch (deleteError) {
        logger.error(
          "Failed to cleanup image after parent category creation error",
          {
            imageKey: req.file.key,
            error: deleteError.message,
          }
        );
      }
    }

    logger.error("Error creating parent category", {
      error: error.message,
      stack: error.stack,
      categoryData: req.body,
    });
    return next(new AppError("Failed to create parent category", 500));
  }
});

exports.updateParentCategory = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  logger.info("Updating parent category", {
    categoryId: id,
    updateData: { ...req.body, image: req.file ? "Present" : "Not present" },
  });

  try {
    const parentCategory = await ParentCategory.findById(id);
    if (!parentCategory) {
      logger.error("Parent category not found", { categoryId: id });
      return next(new AppError("No parent category found with that ID", 404));
    }

    const updateData = { ...req.body };
    let newImageKey = null;

    if (req.file && req.file.location) {
      updateData.imageUrl = req.file.location;
      newImageKey = req.file.key;
    }

    const updatedParentCategory = await ParentCategory.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedParentCategory) {
      if (newImageKey) {
        await deleteImage(newImageKey);
        logger.info("Cleaned up new image after failed update", {
          imageKey: newImageKey,
        });
      }
      logger.error("Failed to update parent category", { categoryId: id });
      return next(new AppError("Failed to update parent category", 500));
    }

    // Delete old image if a new one was uploaded
    if (req.file && parentCategory.imageUrl) {
      try {
        const oldImageKey = new URL(parentCategory.imageUrl).pathname.slice(1);
        await deleteImage(oldImageKey);
        logger.info("Deleted old image after successful update", {
          imageKey: oldImageKey,
        });
      } catch (error) {
        logger.error("Failed to delete old image after update", {
          imageUrl: parentCategory.imageUrl,
          error: error.message,
        });
      }
    }

    logger.info("Parent category updated successfully", {
      categoryId: updatedParentCategory._id,
      title: updatedParentCategory.title,
    });

    res.status(200).json({
      status: "success",
      data: {
        parentCategory: updatedParentCategory,
      },
    });
  } catch (error) {
    if (req.file && req.file.key) {
      try {
        await deleteImage(req.file.key);
        logger.info("Cleaned up new image after update error", {
          imageKey: req.file.key,
        });
      } catch (deleteError) {
        logger.error("Failed to cleanup new image after update error", {
          imageKey: req.file.key,
          error: deleteError.message,
        });
      }
    }

    logger.error("Error updating parent category", {
      error: error.message,
      stack: error.stack,
      categoryId: id,
      updateData: req.body,
    });
    return next(new AppError("Failed to update parent category", 500));
  }
});

exports.getParentCategoryById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  logger.info("Fetching parent category by ID", { categoryId: id });

  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.error("Invalid parent category ID", { id });
    return next(new AppError("Invalid parent category ID", 404));
  }

  try {
    const parentCategory = await ParentCategory.findById(id);
    if (!parentCategory) {
      logger.error("Parent category not found", { categoryId: id });
      return next(new AppError("No parent category found with that ID", 404));
    }

    const categoryObject = parentCategory.toObject();

    if (categoryObject.imageUrl) {
      try {
        const urlParts = new URL(categoryObject.imageUrl);
        const imageKey = urlParts.pathname.slice(1);
        const signedImageUrl = await getImageSignedUrl(imageKey);
        categoryObject.imageUrl = signedImageUrl;
      } catch (error) {
        logger.error("Error generating signed URL for parent category image", {
          categoryId: id,
          imageUrl: categoryObject.imageUrl,
          error: error.message,
        });
      }
    }

    logger.info("Parent category fetched successfully", {
      categoryId: id,
      title: categoryObject.title,
    });

    res.status(200).json({
      status: "success",
      data: {
        parentCategory: {
          ...categoryObject,
          createdBy: null,
          updatedBy: null,
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching parent category", {
      error: error.message,
      stack: error.stack,
      categoryId: id,
    });
    return next(new AppError("Failed to fetch parent category", 500));
  }
});
