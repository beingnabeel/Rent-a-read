const mongoose = require("mongoose");
const APIFeatures = require("../utils/apiFeatures");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const language = require("../models/languageModel");

exports.getAllLanguages = catchAsync(async (req, res, next) => {
  console.log("Request query: ", req.query);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  console.log("page", page, "limit", limit, "skip", skip);

  let query = language.find();

  const features = new APIFeatures(query, req.query).filter().search();
  const totalElements = await language.countDocuments(
    features.query.getFilter()
  );
  console.log("Initial MongoDB query: ", query.getFilter());
  features.sort().limitFields().paginate();
  const languages = await features.query;
  const totalPages = Math.ceil(totalElements / limit);

  const response = {
    content: languages,
    pageNumber: page,
    pageSize: limit,
    totalPages,
    totalElements,
    first: page === 1,
    last: page === totalPages,
    numberOfElements: languages.length,
  };
  res.status(200).json(response);
});

exports.getLanguagesById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Check if the id is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid Language ID", 400));
  }
  const Language = await language.findById(req.params.id);
  if (!Language) {
    return next(new AppError("No language found with that ID", 404));
  }
  res.status(200).json({
    status: "success",
    data: {
      Language,
    },
  });
});

exports.createLanguage = catchAsync(async (req, res, next) => {
  console.log("Request body: ", req.body);
  const existingLanguage = await language.findOne({ code: req.body.code });
  // becoz code is gonna be unique for every language
  console.log("Existing language: ", existingLanguage);
  if (existingLanguage) {
    return next(new AppError("Language code already exists. ", 400));
  }
  const newLanguage = await language.create(req.body);
  res.status(201).json({
    status: "success",
    data: {
      language: newLanguage,
    },
  });
});

exports.updateLanguage = catchAsync(async (req, res, next) => {
  // if code is going to be updated then check if the similar thing is found with the same code becoz here the code is gonna be the primary key
  const { id } = req.params;

  // Check if the id is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid Language ID", 400));
  }
  if (req.body.code) {
    const existingLanguage = await language.findOne({
      code: req.body.code,
      _id: { $ne: req.params.id },
    });
    if (existingLanguage) {
      return next(new AppError("Language code already exists. ", 400));
    }
  }

  const updatedLanguage = await language.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );
  if (!updatedLanguage) {
    return next(new AppError("No book found with that ID", 404));
  }
  res.status(200).json({
    status: "success",
    data: {
      language: updatedLanguage,
    },
  });
});
