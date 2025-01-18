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

exports.getAllParentCategories = catchAsync(async (req, res, next) => {
  console.log("Request query: ", req.query);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  let query = ParentCategory.find();

  console.log("Initial MongoDB query: ", query.getFilter());
  const features = new APIFeatures(query, req.query).filter().search();
  const totalElements = await ParentCategory.countDocuments(
    features.query.getFilter()
  );
  features.sort().limitFields().paginate();
  const parentCategories = await features.query;
  const totalPages = Math.ceil(totalElements / limit);

  const parentCategoriesWithSignedUrls = await Promise.all(
    parentCategories.map(async (category) => {
      const categoryObject = category.toObject();

      if (categoryObject.imageUrl) {
        try {
          // Here we are extracting the key from the full URL
          const urlParts = new URL(categoryObject.imageUrl);
          const imageKey = urlParts.pathname.slice(1); // Remove the leading '/'

          const signedImageUrl = await getImageSignedUrl(imageKey);
          categoryObject.imageUrl = signedImageUrl;
        } catch (error) {
          console.error("Error generating signed URL:", error);
          // Leave the original URL if signing fails
          categoryObject.imageUrl = category.imageUrl;
        }
      }

      return categoryObject;
    })
  );

  const formattedResponse = {
    content: parentCategoriesWithSignedUrls,
    pageNumber: page,
    pageSize: limit,
    totalPages,
    totalElements,
    first: page === 1,
    last: page === totalPages,
    numberOfElements: parentCategories.length,
  };
  res.status(200).json(formattedResponse);
});

exports.getAllParentCategoriesWithCategories = catchAsync(
  async (req, res, next) => {
    const parentCategories = await ParentCategory.find(
      { status: "ACTIVE" },
      "id title" // Only select id and title fields
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

    res.status(200).json({
      status: "success",
      data: {
        parentCategories: populatedParentCategories,
      },
    });
  }
);

exports.getAllActiveParentCategories = catchAsync(async (req, res, next) => {
  const parentCategories = await ParentCategory.find({ status: "ACTIVE" });

  //here we are Generate signed URLs for images
  const parentCategoriesWithSignedUrls = await Promise.all(
    parentCategories.map(async (category) => {
      const categoryObject = category.toObject();

      if (categoryObject.imageUrl) {
        try {
          //here we are extracting the key from the full URL
          const urlParts = new URL(categoryObject.imageUrl);
          const imageKey = urlParts.pathname.slice(1); // Remove the leading '/'

          const signedImageUrl = await getImageSignedUrl(imageKey);
          categoryObject.imageUrl = signedImageUrl;
        } catch (error) {
          console.error(
            `Error generating signed URL for category ${category._id}:`,
            error
          );
          // Keep the original URL if signing fails
          categoryObject.imageUrl = category.imageUrl;
        }
      }

      return categoryObject;
    })
  );

  res.status(200).json({
    status: "success",
    data: {
      parentCategories: parentCategoriesWithSignedUrls,
      count: parentCategoriesWithSignedUrls.length,
    },
  });
});

exports.createParentCategory = catchAsync(async (req, res, next) => {
  // Validate that an image file is uploaded
  if (!req.file || !req.file.location) {
    return next(new AppError("Image upload failed", 400));
  }

  const { title, description = "NA", status = "ACTIVE" } = req.body;

  const imageUrl = req.file.location;

  let newParentCategory;
  try {
    newParentCategory = await ParentCategory.create({
      title,
      description,
      imageUrl,
      status,
    });
  } catch (err) {
    // if category creation fails, here we are trying to delete the uploaded image
    await deleteImage(req.file.key);
    // Handle database errors
    return next(new AppError("Failed to create parent category", 500));
  }

  // Send success response
  res.status(201).json({
    status: "success",
    data: {
      parentCategory: newParentCategory,
    },
  });
});

exports.getParentCategoryById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid parent-category ID", 404));
  }

  const parentCategory = await ParentCategory.findById(id);
  if (!parentCategory) {
    return next(new AppError("No parent category found with that ID", 404));
  }

  const signedImageUrl = await getImageSignedUrl(
    parentCategory.imageUrl.split(".com/")[1]
  );
  parentCategory.imageUrl = signedImageUrl;

  res.status(200).json({
    status: "success",
    data: {
      parentCategory,
    },
  });
});

///     updated version handling the case where the category updation is failed.
exports.updateParentCategory = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid parent-category ID", 400));
  }

  const parentCategory = await ParentCategory.findById(id);
  if (!parentCategory) {
    return next(new AppError("No parent category found with that ID", 404));
  }

  // Prepare update data
  const updateData = { ...(req.validatedBody || {}), ...req.body };

  let newImageKey;
  // Handle image update
  if (req.file) {
    // Here we are checking if the new image name is the same as the old one
    const oldImageName = parentCategory.imageUrl
      ? parentCategory.imageUrl.split("/").pop()
      : "";
    const newImageName = req.file.originalname;

    if (oldImageName === newImageName) {
      return next(
        new AppError(
          "Please change the name of the image or upload a different image",
          400
        )
      );
    }

    //here we are deleting the old image from S3 if exists
    if (parentCategory.imageUrl) {
      try {
        const oldImageKey = parentCategory.imageUrl.split(".com/")[1];
        await deleteImage(oldImageKey);
      } catch (error) {
        console.error("Error deleting old image:", error);
      }
    }

    //here we are adding the new image URL to update data
    newImageKey = req.file.key;
    updateData.imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${newImageKey}`;
  }

  //here we are performing the update
  let updatedParentCategory;
  try {
    updatedParentCategory = await ParentCategory.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedParentCategory) {
      throw new Error("Failed to update parent category");
    }
  } catch (err) {
    // If category update fails, here we are deleting the newly uploaded image
    if (newImageKey) {
      try {
        await deleteImage(newImageKey);
      } catch (deleteError) {
        console.error(
          "Error deleting new image after update failure:",
          deleteError
        );
      }
    }
    //here we are handling the database errors
    return next(new AppError("Failed to update parent category", 500));
  }

  res.status(200).json({
    status: "success",
    data: {
      parentCategory: updatedParentCategory,
    },
  });
});
