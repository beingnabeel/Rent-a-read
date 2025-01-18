const mongoose = require("mongoose");
const SchoolEnquiry = require("../models/schoolEnquiry");
const APIFeatures = require("../utils/apiFeatures");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

exports.createSchoolEnquiry = catchAsync(async (req, res, next) => {
  const newEnquiry = await SchoolEnquiry.create(req.body);

  res.status(201).json({
    status: "success",
    data: newEnquiry,
  });
});

exports.getAllSchoolEnquiries = catchAsync(async (req, res, next) => {
  console.log("Request query: ", req.query);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  let query = SchoolEnquiry.find();
  const features = new APIFeatures(query, req.query).filter().search();
  const totalElements = await SchoolEnquiry.countDocuments(
    features.query.getFilter()
  );
  features.sort().limitFields().paginate();
  const enquiries = await features.query;
  const totalPages = Math.ceil(totalElements / limit);

  res.status(200).json({
    status: "success",
    content: enquiries.map((enquiry) => ({
      id: enquiry._id,
      name: enquiry.name,
      designation: enquiry.designation,
      mobile: enquiry.mobile,
      email: enquiry.email,
      schoolName: enquiry.schoolName,
      address: enquiry.address,
    })),
    pageNumber: page,
    pageSize: limit,
    totalPages,
    totalElements,
    first: page === 1,
    last: page === totalPages,
    numberOfElements: enquiries.length,
  });
});
