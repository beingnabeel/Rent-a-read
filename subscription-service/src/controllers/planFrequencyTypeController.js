const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const PlanFrequencyType = require("../models/planFrequencyType");
const APIFeatures = require("../utils/apiFeatures");
const PlanOptionType = require("../models/planOptionType");

const frequencyDays = {
  Weekly: 7,
  "Bi-weekly": 14,
  Monthly: 30,
  "Semi-Monthly": 60,
  Quarterly: 120,
};

exports.createPlanFrequencyType = catchAsync(async (req, res, next) => {
  // Check for existing plan with same name
  const existingPlan = await PlanFrequencyType.findOne({
    name: req.body.name,
    status: "ACTIVE",
  });

  if (existingPlan) {
    return next(
      new AppError("A plan frequency with this name already exists", 400)
    );
  }

  // Validate plan option types exist
  const planOptionTypes = await PlanOptionType.find({
    _id: { $in: req.body.planOptionTypeIds },
    status: "ACTIVE",
  });

  if (planOptionTypes.length !== req.body.planOptionTypeIds.length) {
    return next(
      new AppError("One or more plan option types not found or inactive", 400)
    );
  }

  // Add delivery days based on frequency
  req.body.deliveryDays = frequencyDays[req.body.frequency];

  const planFrequencyType = await PlanFrequencyType.create(req.body);

  res.status(201).json({
    status: "success",
    data: {
      planFrequencyType,
    },
  });
});

exports.getPlanFrequencyType = catchAsync(async (req, res, next) => {
  const planFrequencyType = await PlanFrequencyType.findById(req.params.id);

  if (!planFrequencyType) {
    return next(new AppError("No plan frequency type found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      planFrequencyType,
    },
  });
});

exports.getAllPlanFrequencyTypes = catchAsync(async (req, res, next) => {
  console.log("Request query: ", req.query);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  let query = PlanFrequencyType.find();
  const features = new APIFeatures(query, req.query).filter().search();

  const totalDocuments = await PlanFrequencyType.countDocuments(
    features.query.getFilter()
  );

  features.sort().limitFields().paginate();
  const planFrequencyTypes = await features.query;

  if (!planFrequencyTypes) {
    return res.status(200).json({
      data: [],
      pageNumber: page,
      pageSize: limit,
      totalPages: 0,
      totalDocuments: 0,
      first: true,
      last: true,
      numberOfDocuments: 0,
    });
  }

  const totalPages = Math.ceil(totalDocuments / limit);
  const formattedResponse = {
    planFrequencyTypes,
    pageNumber: page,
    pageSize: limit,
    totalPages: totalPages,
    totalDocuments: totalDocuments,
    first: page === 1,
    last: page === totalPages,
    numberOfDocuments: planFrequencyTypes.length,
  };

  res.status(200).json({
    status: "success",
    data: formattedResponse,
  });
});

exports.updatePlanFrequencyType = catchAsync(async (req, res, next) => {
  // Get current plan first
  const currentPlan = await PlanFrequencyType.findById(req.params.id);
  if (!currentPlan) {
    return next(new AppError("No plan frequency type found with that ID", 404));
  }

  // If name is being updated, check for duplicates
  if (req.body.name) {
    const existingPlan = await PlanFrequencyType.findOne({
      name: req.body.name,
      _id: { $ne: req.params.id },
      status: "ACTIVE",
    });

    if (existingPlan) {
      return next(
        new AppError("A plan frequency with this name already exists", 400)
      );
    }
  }

  // Validate booksCount update
  if (req.body.booksCount !== undefined) {
    const maxBooks = req.body.maxBooksCount || currentPlan.maxBooksCount;
    if (req.body.booksCount > maxBooks) {
      return next(
        new AppError(
          "Books count cannot be greater than maximum books count",
          400
        )
      );
    }
  }

  // Validate maxBooksCount update
  if (req.body.maxBooksCount !== undefined) {
    const booksCount = req.body.booksCount || currentPlan.booksCount;
    if (req.body.maxBooksCount < booksCount) {
      return next(
        new AppError(
          "Maximum books count must be greater than or equal to books count",
          400
        )
      );
    }
  }

  // If frequency is being updated, update delivery days
  if (req.body.frequency) {
    req.body.deliveryDays = frequencyDays[req.body.frequency];
  }

  const planFrequencyType = await PlanFrequencyType.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    status: "success",
    data: {
      planFrequencyType,
    },
  });
});

exports.deletePlanFrequencyType = catchAsync(async (req, res, next) => {
  const planFrequencyType = await PlanFrequencyType.findByIdAndUpdate(
    req.params.id,
    { status: "INACTIVE" },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!planFrequencyType) {
    return next(new AppError("No plan frequency type found with that ID", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});
