const mongoose = require("mongoose");

const studentStockManagementProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "User ID is required"],
    },
    subscriptionId: {
      type: String,
      required: [true, "Subscription ID is required"],
    },
    maxBooksAllowed: {
      type: Number,
      required: [true, "Maximum books allowed is required"],
    },
    booksLimitLeft: {
      type: Number,
      required: [true, "Books limit left is required"],
    },
    booksLimitUtilized: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient querying
studentStockManagementProfileSchema.index(
  { userId: 1, subscriptionId: 1 },
  { unique: true }
);

const StudentStockManagementProfile = mongoose.model(
  "StudentStockManagementProfile",
  studentStockManagementProfileSchema
);

module.exports = StudentStockManagementProfile;
