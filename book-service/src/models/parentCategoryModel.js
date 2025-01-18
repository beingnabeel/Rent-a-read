const mongoose = require("mongoose");

const parentCategorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Parent category title is required"],
      trim: true,
      minlength: [
        2,
        "Parent category title must be at least 2 characters long",
      ],
      maxlength: [100, "Parent category title cannot exceed 100 characters"],
      unique: true,
    },
    description: {
      type: String,
      default: "NA",
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    imageUrl: {
      type: String,
      required: [true, "Image URL is required"],
      trim: true,
      validate: {
        validator: function (v) {
          return /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(
            v
          );
        },
        message: (props) => `${props.value} is not a valid URL!`,
      },
    },
    status: {
      type: String,
      enum: {
        values: ["ACTIVE", "INACTIVE"],
        message: "{VALUE} is not a valid status",
      },
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

// parentCategorySchema.index({ title: "text", description: "text" });

const ParentCategory = mongoose.model("ParentCategory", parentCategorySchema);

module.exports = ParentCategory;
