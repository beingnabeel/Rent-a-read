const mongoose = require("mongoose");

const WEEK_DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const SCHOOL_STATUS = ["ACTIVE", "INACTIVE", "SUSPENDED"];

const BOOK_FREQUENCY = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"];

const SchoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "School name is required"],
      trim: true,
      minlength: [2, "School name must be at least 2 characters long"],
      maxlength: [100, "School name cannot exceed 100 characters"],
    },
    branch: {
      type: String,
      required: [true, "School branch is required"],
      trim: true,
      minlength: [2, "Branch name must be at least 2 characters long"],
      maxlength: [50, "Branch name cannot exceed 50 characters"],
    },
    address: {
      type: String,
      required: [true, "School address is required"],
      trim: true,
      minlength: [5, "Address must be at least 5 characters long"],
      maxlength: [200, "Address cannot exceed 200 characters"],
    },
    pincode: {
      type: String,
      required: [true, "Pincode is required"],
      match: [/^\d{6}$/, "Pincode must be exactly 6 digits"],
    },
    weekDay: {
      type: String,
      enum: {
        values: WEEK_DAYS,
        message: "{VALUE} is not a valid week day",
      },
      required: [true, "Week day for order acceptance is required"],
    },
    isStockManagementAllowed: {
      type: Boolean,
      default: false,
    },
    bookFrequency: {
      type: String,
      enum: {
        values: BOOK_FREQUENCY,
        message: "{VALUE} is not a valid book frequency",
      },
      required: function () {
        return this.isStockManagementAllowed === true;
      },
    },
    numberOfBooksAllowed: {
      type: Number,
      min: [0, "Number of books cannot be negative"],
      max: [100, "Number of books cannot exceed 100"],
      required: function () {
        return this.isStockManagementAllowed === true;
      },
    },
    status: {
      type: String,
      enum: {
        values: SCHOOL_STATUS,
        message: "{VALUE} is not a valid school status",
      },
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
    unique: true,
  }
);

SchoolSchema.pre("save", function (next) {
  if (!this.isStockManagementAllowed) {
    this.bookFrequency = undefined;
    this.numberOfBooksAllowed = undefined;
  }
  next();
});

SchoolSchema.index({ name: 1, branch: 1, address: 1 }, { unique: true });

SchoolSchema.path("bookFrequency").validate(function (value) {
  if (this.isStockManagementAllowed && !value) {
    this.invalidate(
      "bookFrequency",
      "Book frequency is required when stock management is allowed"
    );
  }
  return true;
});

SchoolSchema.path("numberOfBooksAllowed").validate(function (value) {
  if (
    (this.isStockManagementAllowed && value === undefined) ||
    value === null
  ) {
    this.invalidate(
      "numberOfBooksAllowed",
      "Number of books allowed is required when stock management is allowed"
    );
  }
  return true;
});

const School = mongoose.model("School", SchoolSchema);

module.exports = School;
