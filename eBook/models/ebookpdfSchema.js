import mongoose from "mongoose";

const eBookLibrarySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a title for the eBook"],
      minlength: [3, "Title should be at least 3 characters"],
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Please add a description for the eBook"],
      minlength: [10, "Description should be at least 10 characters"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    CategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "eBookCategory",
      required: [true, "eBookCategoryId is required"],
    },
    author: {
      type: String,
      required: [true, "Please add the author name"],
      minlength: [3, "Author name should be at least 3 characters"],
      maxlength: [50, "Author name cannot exceed 50 characters"],
    },
    publisher: {
      type: String,
      maxlength: [50, "Publisher name cannot exceed 50 characters"],
    },
    Isbn: {
      type: String,
      unique: true,
      required: [true, "Please add an ISBN for the eBook"],
    },
    languageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "languages",
      required: [true, "LanguageId is required"],
    },
    series: {
      type: String,
      maxlength: [50, "Series name cannot exceed 50 characters"],
    },
    thumbnailUrl: {
      type: String,
      required: [true, "Thumbnail URL is required"],
    },
    pdfUrl: {
      type: String,
      required: [true, "PDF URL is required"],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    minAge: {
      type: Number,
      required: [true, "Minimum age is required"],
      min: [0, "Minimum age must be at least 0"],
    },
    maxAge: {
      type: Number,
      required: [true, "Maximum age is required"],
      // validate: {
      //   validator: function (value) {
      //     return value >= this.minAge;
      //   },
      //   message: "Maximum age must be greater than or equal to the minimum age",
      // },
    },
  },
  {
    timestamps: true,
  }
);

eBookLibrarySchema.pre("validate", function (next) {
  if (this.maxAge < this.minAge) {
    this.invalidate(
      "maxAge",
      "Maximum age must be greater than or equal to minimum age"
    );
  }
  next();
});

const eBookLibrary = mongoose.model("eBookLibrary", eBookLibrarySchema);

export default eBookLibrary;
