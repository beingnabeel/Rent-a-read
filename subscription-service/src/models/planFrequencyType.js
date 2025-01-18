const mongoose = require("mongoose");

const planFrequencyTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "A plan frequency must have a name"],
      unique: true,
      trim: true,
    },
    frequency: {
      type: String,
      required: [true, "A plan frequency must have a frequency type"],
      enum: ["Weekly", "Bi-weekly", "Monthly", "Semi-Monthly", "Quarterly"],
    },
    deliveryDays: {
      type: Number,
      required: [true, "A plan frequency must specify delivery days"],
    },
    planOptionTypeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PlanOptionType",
        required: [true, "At least one plan option type is required"],
      },
    ],
    booksCount: {
      type: Number,
      required: [true, "Number of books to be delivered must be specified"],
      min: [1, "Books count must be at least 1"],
    },
    maxBooksCount: {
      type: Number,
      required: [true, "Maximum books count must be specified"],
      min: [1, "Maximum books count must be at least 1"],
      validate: {
        validator: function (value) {
          if (this.isNew) {
            return value >= this.booksCount;
          }
          return true;
        },
        message:
          "Maximum books count must be greater than or equal to books count",
      },
    },
    registrationFee: {
      type: Number,
      required: [true, "A plan frequency must have a registration fee"],
      min: [0, "Registration fee cannot be negative"],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Ensure population happens automatically
planFrequencyTypeSchema.pre(/^find/, function (next) {
  this.populate({
    path: "planOptionTypeIds",
    select: "title price type durationInMonths",
  });
  next();
});

const PlanFrequencyType = mongoose.model(
  "PlanFrequencyType",
  planFrequencyTypeSchema
);
module.exports = PlanFrequencyType;
