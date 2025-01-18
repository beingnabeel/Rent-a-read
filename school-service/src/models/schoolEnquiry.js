const mongoose = require("mongoose");

const SCHOOL_STATUS = ["ACTIVE", "INACTIVE", "SUSPENDED"];

const SchoolEnquirySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    designation: {
      type: String,
      trim: true,
      maxlength: [50, "Designation cannot exceed 50 characters"],
    },
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      match: [/^[6-9]\d{9}$/, "Invalid Indian mobile number"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Invalid email address",
      ],
    },
    schoolName: {
      type: String,
      required: [true, "School name is required"],
      trim: true,
      minlength: [2, "School name must be at least 2 characters long"],
      maxlength: [100, "School name cannot exceed 100 characters"],
    },
    address: {
      type: String,
      required: [true, "School address is required"],
      trim: true,
      minlength: [5, "Address must be at least 5 characters long"],
      maxlength: [200, "Address cannot exceed 200 characters"],
    },
  },
  {
    timestamps: true,
  }
);

const SchoolEnquiry = mongoose.model("SchoolEnquiry", SchoolEnquirySchema);
module.exports = SchoolEnquiry;
