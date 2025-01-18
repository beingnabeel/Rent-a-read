const mongoose = require("mongoose");
const School = require("../models/schoolModel");
const APIFeatures = require("../utils/apiFeatures");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

exports.createSchool = catchAsync(async (req, res, next) => {
  const existingSchool = await School.findOne({
    name: req.body.name,
    $or: [{ branch: req.body.branch }, { address: req.body.address }],
  });

  if (existingSchool) {
    return next(
      new AppError(
        "A school with this name and either the same branch or address already exists",
        400
      )
    );
  }

  const newSchool = await School.create({
    name: req.body.name,
    branch: req.body.branch,
    address: req.body.address,
    pincode: req.body.pincode,
    weekDay: req.body.weekDay,
    bookFrequency: req.body.bookFrequency,
    numberOfBooksAllowed: req.body.numberOfBooksAllowed,
    status: req.body.status,
    isStockManagementAllowed: req.body.isStockManagementAllowed,
    // createdBy: req.user.id
  });

  res.status(201).json({
    status: "success",
    data: {
      school: newSchool,
    },
  });
});

exports.getAllSchools = catchAsync(async (req, res, next) => {
  console.log("Request query: ", req.query);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  let query = School.find();
  const features = new APIFeatures(query, req.query).filter().search();
  const totalElements = await School.countDocuments(features.query.getFilter());
  features.sort().limitFields().paginate();
  const schools = await features.query;
  const totalPages = Math.ceil(totalElements / limit);

  res.status(200).json({
    status: "success",
    data: schools.map((school) => ({
      id: school._id,
      name: school.name,
      branch: school.branch,
      address: school.address,
      pincode: school.pincode,
      weekDay: school.weekDay,
      bookFrequency: school.bookFrequency,
      numberOfBooksAllowed: school.numberOfBooksAllowed,
      status: school.status,
      createdAt: school.createdAt,
      // createdBy: school.createdBy,
      updatedAt: school.updatedAt,
      // updatedBy: school.updatedBy,
      stockManagementAllowed: school.isStockManagementAllowed,
    })),
    pageNumber: page,
    pageSize: limit,
    totalPages,
    totalElements,
    first: page === 1,
    last: page === totalPages,
    numberOfElements: schools.length,
  });
});

exports.updateSchoolById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid school ID", 400));
  }

  const updateFields = { ...req.body };
  delete updateFields.createdAt;
  delete updateFields.createdBy;
  delete updateFields.id;

  const currentSchool = await School.findById(id);
  if (!currentSchool) {
    return next(new AppError("No school found with that ID", 404));
  }

  if (updateFields.name || updateFields.branch || updateFields.address) {
    const existingSchool = await School.findOne({
      _id: { $ne: id },
      name: updateFields.name || currentSchool.name,
      $or: [
        { branch: updateFields.branch || currentSchool.branch },
        { address: updateFields.address || currentSchool.address },
      ],
    });

    if (existingSchool) {
      return next(
        new AppError(
          "A school with this name and either the same branch or address already exists",
          400
        )
      );
    }
  }

  const updatedSchool = await School.findByIdAndUpdate(id, updateFields, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      school: {
        id: updatedSchool._id,
        name: updatedSchool.name,
        branch: updatedSchool.branch,
        address: updatedSchool.address,
        pincode: updatedSchool.pincode,
        weekDay: updatedSchool.weekDay,
        bookFrequency: updatedSchool.bookFrequency,
        numberOfBooksAllowed: updatedSchool.numberOfBooksAllowed,
        status: updatedSchool.status,
        createdAt: updatedSchool.createdAt,
        updatedAt: updatedSchool.updatedAt,
        stockManagementAllowed: updatedSchool.isStockManagementAllowed,
      },
    },
  });
});

exports.getSchoolById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid school ID", 404));
  }
  const school = await School.findById(req.params.id);

  if (!school) {
    return next(new AppError("No school found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      school: {
        id: school._id,
        name: school.name,
        branch: school.branch,
        address: school.address,
        pincode: school.pincode,
        weekDay: school.weekDay,
        bookFrequency: school.bookFrequency,
        numberOfBooksAllowed: school.numberOfBooksAllowed,
        status: school.status,
        createdAt: school.createdAt,
        // createdBy: school.createdBy,
        updatedAt: school.updatedAt,
        // updatedBy: school.updatedBy,
        stockManagementAllowed: school.isStockManagementAllowed,
      },
    },
  });
});
