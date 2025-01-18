const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Category title is required"],
      trim: true,
      minlength: [2, "Category title must be at least 2 characters long"],
      maxlength: [100, "Category title cannot exceed 100 characters"],
      unique: true,
    },
    description: {
      type: String,
      default: "NA",
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: {
        values: ["ACTIVE", "INACTIVE"],
        message: "{VALUE} is not a valid status",
      },
      default: "ACTIVE",
    },
    parentCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParentCategory",
      required: [true, "Parent category is required"],
      validate: {
        validator: async function (v) {
          const ParentCategory = mongoose.model("ParentCategory");
          const parentCategory = await ParentCategory.findById(v);
          return parentCategory !== null;
        },
        message: "Invalid parent category ID",
      },
    },
  },
  {
    timestamps: true,
  }
);

// categorySchema.index({ title: 1, parentCategoryId: 1 }, { unique: true });

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
