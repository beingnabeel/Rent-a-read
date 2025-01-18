const mongoose = require("mongoose");

const SCHOOL_STATUS = ["ACTIVE", "INACTIVE", "SUSPENDED"];

const SchoolLeaveSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: [true, "School reference is required"],
    },
    title: {
      type: String,
      required: [true, "Leave title is required"],
      trim: true,
      minlength: [2, "Title must be at least 2 characters long"],
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
      validate: {
        validator: function (value) {
          return value >= this.startDate;
        },
        message: "End date must be greater than or equal to start date",
      },
    },
  },
  {
    timestamps: true,
  }
);

const SchoolLeave = mongoose.model("SchoolLeave", SchoolLeaveSchema);

module.exports = SchoolLeave;
