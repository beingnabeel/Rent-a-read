const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const PlanOptionType = require("../models/planOptionType");
const APIFeatures = require("../utils/apiFeatures");

exports.createPlanOptionType = catchAsync(async (req, res, next) => {
  // Check for existing plan with same title
  const existingPlan = await PlanOptionType.findOne({
    title: req.body.title,
    status: "ACTIVE",
  });

  if (existingPlan) {
    return next(new AppError("A plan with this title already exists", 400));
  }

  // Validate maxNoOfBooks is reasonable
  if (req.body.maxNoOfBooks > 50) {
    // You can adjust this limit as needed
    return next(
      new AppError("Maximum number of books seems unreasonably high", 400)
    );
  }

  const planOptionType = await PlanOptionType.create(req.body);

  res.status(201).json({
    status: "success",
    data: {
      planOptionType,
    },
  });
});

exports.getPlanOptionType = catchAsync(async (req, res, next) => {
  const planOptionType = await PlanOptionType.findById(req.params.id);

  if (!planOptionType) {
    return next(new AppError("No plan option type found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      planOptionType,
    },
  });
});

exports.getAllPlanOptionTypes = catchAsync(async (req, res, next) => {
  console.log("Request query: ", req.query);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  let query = PlanOptionType.find();
  const features = new APIFeatures(query, req.query).filter().search();
  const totalDocuments = await PlanOptionType.countDocuments(
    features.query.getFilter()
  );
  features.sort().limitFields().paginate();
  const planOptionTypes = await features.query;
  if (!planOptionTypes) {
    return res.status(200).json({
      data: [],
      pageNumber: page,
      pageSize: limit,
      totalPages: 0,
      totalDocuments: 0,
      first: true,
      last: true,
      numberOfDoucments: 0,
    });
  }
  const totalPages = Math.ceil(totalDocuments / limit);
  const formattedResponse = {
    data: planOptionTypes,
    pageNumber: page,
    pageSize: limit,
    totalPages: totalPages,
    totalDocuments: totalDocuments,
    first: page === 1,
    last: page === totalPages,
    numberOfDoucments: planOptionTypes.length,
  };
  res.status(200).json({
    status: "success",
    data: formattedResponse,
  });
  //   const features = new APIFeatures(PlanOptionType.find(), req.query)
  //     .filter()
  //     .search()
  //     .sort()
  //     .limitFields()
  //     .paginate();

  //   const planOptionTypes = await features.query;

  //   res.status(200).json({
  //     status: "success",
  //     results: planOptionTypes.length,
  //     data: {
  //       planOptionTypes,
  //     },
  //   });
});

exports.updatePlanOptionType = catchAsync(async (req, res, next) => {
  // If title is being updated, check for duplicates
  if (req.body.title) {
    const existingPlan = await PlanOptionType.findOne({
      title: req.body.title,
      _id: { $ne: req.params.id },
      status: "ACTIVE",
    });

    if (existingPlan) {
      return next(new AppError("A plan with this title already exists", 400));
    }
  }

  // If maxNoOfBooks is being updated, validate it's reasonable
  if (req.body.maxNoOfBooks && req.body.maxNoOfBooks > 50) {
    // You can adjust this limit as needed
    return next(
      new AppError("Maximum number of books seems unreasonably high", 400)
    );
  }

  // If type is being updated, validate durationInMonths
  if (req.body.type && !req.body.durationInMonths) {
    const validDurations = {
      trial: 1,
      quarterly: 4,
      "half-yearly": 6,
      annually: 12,
    };
    req.body.durationInMonths = validDurations[req.body.type];
  }

  const planOptionType = await PlanOptionType.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!planOptionType) {
    return next(new AppError("No plan option type found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      planOptionType,
    },
  });
});

exports.deletePlanOptionType = catchAsync(async (req, res, next) => {
  const planOptionType = await PlanOptionType.findByIdAndUpdate(
    req.params.id,
    { status: "INACTIVE" },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!planOptionType) {
    return next(new AppError("No plan option type found with that ID", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});
