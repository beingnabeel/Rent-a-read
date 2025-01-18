const mongoose = require("mongoose");

const planOptionTypeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "A plan option must have a title"],
      unique: true,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "A plan option must have a price"],
    },
    type: {
      type: String,
      required: [true, "A plan option must have a type"],
      enum: ["trial", "quarterly", "half-yearly", "annually"],
    },
    durationInMonths: {
      type: Number,
      required: [true, "A plan option must specify duration in months"],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

const PlanOptionType = mongoose.model("PlanOptionType", planOptionTypeSchema);
module.exports = PlanOptionType;
