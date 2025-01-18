const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Category = require("../models/categoryModel");
const APIFeatures = require("../utils/apiFeatures");
const ParentCategory = require("../models/parentCategoryModel");

exports.getAllCategories = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  let query = Category.find().populate("parentCategoryId", "title");

  const features = new APIFeatures(query, req.query).filter().search();
  const totalElements = await Category.countDocuments(
    features.query.getFilter()
  );
  features.sort().limitFields().paginate();
  const categories = await features.query;
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

  res.status(200).json(response);
});

exports.getCategoriesByParent = catchAsync(async (req, res, next) => {
  const parentCategoryId = req.params.parentId;

  // Validate if the parent category exists
  const parentCategory = await ParentCategory.findById(parentCategoryId);
  if (!parentCategory) {
    return next(new AppError("No parent category found with that ID", 404));
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  let query = Category.find({ parentCategoryId: parentCategoryId });

  const features = new APIFeatures(query, req.query).filter().search();
  const totalElements = await Category.countDocuments(
    features.query.getFilter()
  );
  features.sort().limitFields().paginate();

  const categories = await features.query.populate("parentCategoryId", "title");
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

  res.status(200).json(response);
});

exports.createCategory = catchAsync(async (req, res, next) => {
  const newCategory = await Category.create(req.body);
  res.status(201).json({
    status: "success",
    data: {
      category: newCategory,
    },
  });
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!category) {
    return next(new AppError("No category found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      category,
    },
  });
});

exports.getCategoryById = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id).populate(
    "parentCategoryId",
    "title"
  );

  if (!category) {
    return next(new AppError("No category found with that ID", 404));
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

  res.status(200).json(response);
});
