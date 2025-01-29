const mongoose = require("mongoose");
const APIFeatures = require("../utils/apiFeatures");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const language = require("../models/languageModel");
const { logger } = require("../utils/logger");

exports.getAllLanguages = catchAsync(async (req, res, next) => {
  logger.info("Fetching all languages", {
    query: req.query,
    page: req.query.page || 1,
    limit: req.query.limit || 10,
  });

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = language.find();

    const features = new APIFeatures(query, req.query).filter().search();
    const totalElements = await language.countDocuments(
      features.query.getFilter()
    );
    features.sort().limitFields().paginate();
    const languages = await features.query;

    if (!languages || languages.length === 0) {
      logger.warn("No languages found for the given criteria", {
        query: req.query,
        filter: features.query.getFilter(),
      });
    }

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

    logger.info("Languages fetched successfully", {
      count: languages.length,
      totalElements,
      page,
      limit,
    });

    res.status(200).json(response);
  } catch (error) {
    logger.error("Error fetching languages", {
      error: error.message,
      stack: error.stack,
      query: req.query,
    });
    return next(new AppError("Failed to fetch languages", 500));
  }
});

exports.getLanguagesById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  logger.info("Fetching language by ID", { languageId: id });

  // Check if the id is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.error("Invalid language ID format", { languageId: id });
    return next(new AppError("Invalid Language ID", 400));
  }

  try {
    const Language = await language.findById(id);
    if (!Language) {
      logger.error("Language not found", { languageId: id });
      return next(new AppError("No language found with that ID", 404));
    }

    logger.info("Language fetched successfully", {
      languageId: Language._id,
      title: Language.title,
    });

    res.status(200).json({
      status: "success",
      data: {
        language: Language,
      },
    });
  } catch (error) {
    logger.error("Error fetching language by ID", {
      error: error.message,
      stack: error.stack,
      languageId: id,
    });
    return next(new AppError("Failed to fetch language", 500));
  }
});

exports.createLanguage = catchAsync(async (req, res, next) => {
  logger.info("Creating new language", {
    languageData: req.body,
  });

  try {
    // Validate required fields
    if (!req.body.name) {
      logger.error("Missing required fields for language creation", {
        providedFields: Object.keys(req.body),
      });
      return next(new AppError("name is required", 400));
    }

    const existingLanguage = await language.findOne({ code: req.body.code });
    // becoz code is gonna be unique for every language
    if (existingLanguage) {
      logger.error("Language code already exists", {
        languageCode: req.body.code,
      });
      return next(new AppError("Language code already exists. ", 400));
    }

    const newLanguage = await language.create(req.body);

    logger.info("Language created successfully", {
      languageId: newLanguage._id,
      name: newLanguage.name,
    });

    res.status(201).json({
      status: "success",
      data: {
        language: newLanguage,
      },
    });
  } catch (error) {
    logger.error("Error creating language", {
      error: error.message,
      stack: error.stack,
      languageData: req.body,
    });
    return next(new AppError("Failed to create language", 500));
  }
});

exports.updateLanguage = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  logger.info("Updating language", {
    languageId: id,
    updateData: req.body,
  });

  // Check if the id is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.error("Invalid language ID format", { languageId: id });
    return next(new AppError("Invalid Language ID", 400));
  }

  try {
    if (req.body.code) {
      const existingLanguage = await language.findOne({
        code: req.body.code,
        _id: { $ne: req.params.id },
      });
      if (existingLanguage) {
        logger.error("Language code already exists", {
          languageCode: req.body.code,
        });
        return next(new AppError("Language code already exists. ", 400));
      }
    }

    const updatedLanguage = await language.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedLanguage) {
      logger.error("Language not found", { languageId: id });
      return next(new AppError("No language found with that ID", 404));
    }

    logger.info("Language updated successfully", {
      languageId: updatedLanguage._id,
      title: updatedLanguage.title,
    });

    res.status(200).json({
      status: "success",
      data: {
        language: updatedLanguage,
      },
    });
  } catch (error) {
    logger.error("Error updating language", {
      error: error.message,
      stack: error.stack,
      languageId: id,
      updateData: req.body,
    });
    return next(new AppError("Failed to update language", 500));
  }
});
