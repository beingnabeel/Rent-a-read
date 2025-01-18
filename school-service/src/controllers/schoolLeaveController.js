const mongoose = require("mongoose");
const SchoolLeave = require("../models/schoolLeave");
const School = require("../models/schoolModel");
const APIFeatures = require("../utils/apiFeatures");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

exports.createSchoolLeave = catchAsync(async (req, res, next) => {
  const { schoolId } = req.params;
  const { title, description, startDate, endDate } = req.body;
  const school = await School.findById(schoolId);
  if (!school) return next(new AppError("No school found with that ID", 404));
  const existingLeave = await SchoolLeave.findOne({
    schoolId: schoolId,
    title,
  });
  if (existingLeave)
    return next(
      new AppError(
        "A leave with the same title already exists for this school",
        400
      )
    );
  if (new Date(startDate) > new Date(endDate))
    return next(new AppError("Start date must be before end date", 400));

  const newLeave = await SchoolLeave.create({
    ...req.body,
    schoolId: schoolId,
  });
  //   res.status(201).json({
  //     status: "success",
  //     data: { leave: newLeave },
  //   });
  res.status(201).json({
    status: "success",
    data: {
      id: newLeave._id,
      schoolId: newLeave.schoolId,
      title: newLeave.title,
      description: newLeave.description,
      startDate: newLeave.startDate,
      endDate: newLeave.endDate,
      createdAt: newLeave.createdAt,
      updatedAt: newLeave.updatedAt,
    },
    // data: {
    //   leave: newLeave,
    // },
  });
});

exports.getAllSchoolLeaves = catchAsync(async (req, res, next) => {
  console.log("Request query: ", req.query);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const { schoolId } = req.params;
  const school = await School.findById(schoolId);
  if (!school) return next(new AppError("No school found with that ID", 404));

  let query = SchoolLeave.find({ schoolId: schoolId });
  const features = new APIFeatures(query, req.query).filter().search();
  //   const totalElements = await SchoolLeave.countDocuments({ schoolId: id });
  const totalElements = await SchoolLeave.countDocuments(
    features.query.getFilter()
  );
  features.sort().limitFields().paginate();
  const leaves = await features.query;
  const totalPages = Math.ceil(totalElements / limit);
  res.status(200).json({
    status: "success",
    content: leaves.map((leave) => ({
      id: leave._id,
      schoolId: leave.schoolId,
      title: leave.title,
      description: leave.description,
      startDate: leave.startDate,
      endDate: leave.endDate,
      createdAt: leave.createdAt,
      // createdBy: leave.createdBy,
      updatedAt: leave.updatedAt,
      // updatedBy: leave.updatedBy
    })),
    pageNumber: page,
    pageSize: limit,
    totalPages,
    totalElements,
    first: page === 1,
    last: page === totalPages,
    numberOfElements: leaves.length,
  });
});

exports.getSchoolLeaveById = catchAsync(async (req, res, next) => {
  const { schoolId, id } = req.params;
  const leave = await SchoolLeave.findById(id);
  if (!leave) return next(new AppError("No leave found with that ID", 404));
  res.status(200).json({
    status: "success",
    data: {
      id: leave._id,
      schoolId: leave.schoolId,
      title: leave.title,
      description: leave.description,
      startDate: leave.startDate,
      endDate: leave.endDate,
      createdAt: leave.createdAt,
      updatedAt: leave.updatedAt,
      // createdBy: leave.createdBy,
      // updatedBy: leave.updatedBy
    },
  });
});

// to get the school leave by id I need to know the school id as well as the leave id.

exports.updateSchoolLeave = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { title, description, startDate, endDate } = req.body;
  const leave = await SchoolLeave.findByIdAndUpdate(id);
  if (!leave) return next(new AppError("No leave found with that ID", 404));

  if (title && title !== leave.title) {
    const existingLeave = await SchoolLeave.findOne({
      schoolId: leave.schoolId,
      title,
      _id: { $ne: id },
    });
    if (existingLeave) {
      return next(
        new AppError(
          "A leave with the same title already exists for this school",
          400
        )
      );
    }
  }

  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    return next(new AppError("Start date must be before end date", 400));
  }
  const updatedLeave = await SchoolLeave.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });
  res.status(200).json({
    status: "success",
    data: {
      updatedLeave,
    },
  });
});

exports.deleteSchoolLeave = catchAsync(async (req, res, next) => {
  const { schoolId, id } = req.params;
  const leave = await SchoolLeave.findByIdAndDelete(id);
  if (!leave) return next(new AppError("No leave found with that ID", 404));
  res.status(204).json({
    status: "success",
    data: null,
  });
});
