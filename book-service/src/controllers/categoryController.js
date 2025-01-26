const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Category = require("../models/categoryModel");
const APIFeatures = require("../utils/apiFeatures");
const ParentCategory = require("../models/parentCategoryModel");
const { logger } = require("../utils/logger");

exports.getAllCategories = catchAsync(async (req, res, next) => {
  logger.info('Fetching all categories', {
    query: req.query,
    page: req.query.page || 1,
    limit: req.query.limit || 10
  });

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  let query = Category.find().populate("parentCategoryId", "title");

  try {
    const features = new APIFeatures(query, req.query).filter().search();
    const totalElements = await Category.countDocuments(features.query.getFilter());
    features.sort().limitFields().paginate();
    const categories = await features.query;

    if (!categories || categories.length === 0) {
      logger.warn('No categories found for the given criteria', {
        query: req.query,
        filter: features.query.getFilter()
      });
    }

    const totalPages = Math.ceil(totalElements / limit);
    const response = {
      content: categories.map((cat) => ({
        id: cat._id,
        title: cat.title,
        description: cat.description,
        parentCategoryId: cat.parentCategoryId._id,
        parentCategory: cat.parentCategoryId.title,
        status: cat.status,
        createdAt: cat.createdAt,
        createdBy: null,
        updatedAt: cat.updatedAt,
        updatedBy: null,
      })),
      pageNumber: page,
      pageSize: limit,
      totalPages,
      totalElements,
      first: page === 1,
      last: page === totalPages,
      numberOfElements: categories.length,
    };

    logger.info('Categories fetched successfully', {
      count: categories.length,
      totalElements,
      page,
      limit
    });

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error fetching categories', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });
    return next(new AppError('Failed to fetch categories', 500));
  }
});

exports.getCategoriesByParent = catchAsync(async (req, res, next) => {
  const parentCategoryId = req.params.parentId;

  logger.info('Fetching categories by parent', {
    parentCategoryId,
    query: req.query
  });

  // Validate if the parent category exists
  const parentCategory = await ParentCategory.findById(parentCategoryId);
  if (!parentCategory) {
    logger.error('Parent category not found', { parentCategoryId });
    return next(new AppError("No parent category found with that ID", 404));
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    let query = Category.find({ parentCategoryId: parentCategoryId });

    const features = new APIFeatures(query, req.query).filter().search();
    const totalElements = await Category.countDocuments(features.query.getFilter());
    features.sort().limitFields().paginate();

    const categories = await features.query.populate("parentCategoryId", "title");

    if (!categories || categories.length === 0) {
      logger.warn('No categories found for the parent category', {
        parentCategoryId,
        query: req.query
      });
    }

    const totalPages = Math.ceil(totalElements / limit);
    const response = {
      content: categories.map((cat) => ({
        id: cat._id,
        title: cat.title,
        description: cat.description,
        parentCategoryId: cat.parentCategoryId._id,
        parentCategory: cat.parentCategoryId.title,
        status: cat.status,
        createdAt: cat.createdAt,
        createdBy: null,
        updatedAt: cat.updatedAt,
        updatedBy: null,
      })),
      pageNumber: page,
      pageSize: limit,
      totalPages,
      totalElements,
      first: page === 1,
      last: page === totalPages,
      numberOfElements: categories.length,
    };

    logger.info('Categories by parent fetched successfully', {
      parentCategoryId,
      count: categories.length,
      totalElements
    });

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error fetching categories by parent', {
      error: error.message,
      stack: error.stack,
      parentCategoryId,
      query: req.query
    });
    return next(new AppError('Failed to fetch categories by parent', 500));
  }
});

exports.createCategory = catchAsync(async (req, res, next) => {
  logger.info('Creating new category', {
    categoryData: req.body
  });

  try {
    // Validate required fields
    if (!req.body.title || !req.body.parentCategoryId) {
      logger.error('Missing required fields for category creation', {
        providedFields: Object.keys(req.body)
      });
      return next(new AppError('Title and parent category ID are required', 400));
    }

    // Validate parent category exists
    const parentCategory = await ParentCategory.findById(req.body.parentCategoryId);
    if (!parentCategory) {
      logger.error('Invalid parent category ID', {
        parentCategoryId: req.body.parentCategoryId
      });
      return next(new AppError('Invalid parent category ID', 400));
    }

    const newCategory = await Category.create(req.body);

    logger.info('Category created successfully', {
      categoryId: newCategory._id,
      title: newCategory.title
    });

    res.status(201).json({
      status: "success",
      data: {
        category: newCategory,
      },
    });
  } catch (error) {
    logger.error('Error creating category', {
      error: error.message,
      stack: error.stack,
      categoryData: req.body
    });
    return next(new AppError('Failed to create category', 500));
  }
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  logger.info('Updating category', {
    categoryId: req.params.id,
    categoryData: req.body
  });

  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      logger.error('Category not found', { categoryId: req.params.id });
      return next(new AppError('No category found with that ID', 404));
    }

    logger.info('Category updated successfully', {
      categoryId: category._id,
      title: category.title
    });

    res.status(200).json({
      status: "success",
      data: {
        category,
      },
    });
  } catch (error) {
    logger.error('Error updating category', {
      error: error.message,
      stack: error.stack,
      categoryId: req.params.id,
      categoryData: req.body
    });
    return next(new AppError('Failed to update category', 500));
  }
});

exports.getCategoryById = catchAsync(async (req, res, next) => {
  logger.info('Fetching category by ID', {
    categoryId: req.params.id
  });

  try {
    const category = await Category.findById(req.params.id).populate("parentCategoryId", "title");

    if (!category) {
      logger.error('Category not found', { categoryId: req.params.id });
      return next(new AppError('No category found with that ID', 404));
    }

    const response = {
      id: category._id,
      title: category.title,
      description: category.description,
      parentCategoryId: category.parentCategoryId._id,
      parentCategory: category.parentCategoryId.title,
      status: category.status,
      createdAt: category.createdAt,
      createdBy: null,
      updatedAt: category.updatedAt,
      updatedBy: null,
    };

    logger.info('Category fetched successfully', {
      categoryId: category._id,
      title: category.title
    });

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error fetching category by ID', {
      error: error.message,
      stack: error.stack,
      categoryId: req.params.id
    });
    return next(new AppError('Failed to fetch category by ID', 500));
  }
});
