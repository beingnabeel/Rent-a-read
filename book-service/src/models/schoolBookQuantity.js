const mongoose = require("mongoose");

const SchoolBookQuantitySchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: [true, "Book reference is required"],
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "School ID is required"],
    },
    totalQuantity: {
      type: Number,
      default: 0,
    },
    availableQuantity: {
      type: Number,
      default: 0,
      validate: {
        validator: function (value) {
          return value <= this.totalQuantity;
        },
        message: "Available quantity cannot be greater than total quantity",
      },
    },
    receivedQuantity: {
      type: Number,
      default: 0,
    },
    bookOnHold: {
      type: Number,
      default: 0,
    },
    // deliveryDate: {
    //   type: Date,
    // },
    // nextDeliveryDate: {
    //   type: Date,
    // },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Add pre-save middleware to ensure bookOnHold is calculated correctly
SchoolBookQuantitySchema.pre("save", function (next) {
  this.bookOnHold = this.totalQuantity - this.availableQuantity;
  next();
});

// Add pre-validate middleware to check the total quantity constraint
SchoolBookQuantitySchema.pre("validate", function (next) {
  if (this.bookOnHold < 0 || this.bookOnHold > this.totalQuantity) {
    next(new Error("Invalid book quantities"));
  }
  next();
});

// Method to increment book total
SchoolBookQuantitySchema.methods.incrementBookTotal = function (quantity) {
  this.totalQuantity += quantity;
  this.availableQuantity += quantity;
  return this.save();
};

// Static method to find by bookId and schoolId
SchoolBookQuantitySchema.statics.findByBookIdAndSchoolId = function (
  bookId,
  schoolId
) {
  return this.findOne({ bookId, schoolId, isDeleted: false });
};

module.exports = mongoose.model("SchoolBookQuantity", SchoolBookQuantitySchema);
