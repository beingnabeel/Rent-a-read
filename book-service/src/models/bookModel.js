const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Book title is required"],
      trim: true,
      maxlength: [100, "Book title cannot be more than 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Book description is required"],
      trim: true,
      maxlength: [1000, "Description cannot be more than 1000 characters"],
    },
    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: [true, "At least one category is required"],
      },
    ],
    paperType: {
      type: String,
      required: [true, "Paper type is required"],
      enum: {
        values: ["Hardcover", "Paperback", "E-book"],
        message: "{VALUE} is not a valid paper type",
      },
    },
    author: {
      type: String,
      required: [true, "Author name is required"],
      trim: true,
      maxlength: [100, "Author name cannot be more than 100 characters"],
    },
    publisher: {
      type: String,
      required: [true, "Publisher name is required"],
      trim: true,
      maxlength: [100, "Publisher name cannot be more than 100 characters"],
    },
    isbn: {
      type: String,
      required: [true, "ISBN is required"],
      unique: true,
      validate: {
        validator: function (v) {
          return /^(?=(?:\D*\d){10}(?:(?:\D*\d){3})?$)[\d-]+$/.test(v);
        },
        message: (props) => `${props.value} is not a valid ISBN!`,
      },
    },
    languageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Language",
      required: [true, "Language is required"],
    },
    series: {
      type: String,
      trim: true,
      maxlength: [100, "Series name cannot be more than 100 characters"],
    },
    shelfId: {
      type: String,
      required: [true, "Shelf ID is required"],
      trim: true,
    },
    imageUrls: [
      {
        type: String,
        validate: {
          validator: function (v) {
            return /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/.test(
              v
            );
          },
          message: (props) => `${props.value} is not a valid URL!`,
        },
      },
    ],
    googleUrl: {
      type: String,
      default: "",
      validate: {
        validator: function (v) {
          return (
            v === "" ||
            /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/.test(
              v
            )
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
    minAge: {
      type: Number,
      required: [true, "Minimum age is required"],
      min: [0, "Minimum age cannot be less than 0"],
      max: [100, "Minimum age cannot be more than 100"],
    },
    maxAge: {
      type: Number,
      required: [true, "Maximum age is required"],
      min: [0, "Maximum age cannot be less than 0"],
      max: [100, "Maximum age cannot be more than 100"],
      validate: {
        validator: function (v) {
          return v >= this.minAge;
        },
        message: "Maximum age must be greater than or equal to minimum age",
      },
    },
    totalQuantity: {
      type: Number,
      required: [true, "Total quantity is required"],
      min: [0, "Total quantity cannot be negative"],
    },
    availableQuantity: {
      type: Number,
      required: [true, "Available quantity is required"],
      min: [0, "Available quantity cannot be negative"],
      validate: {
        validator: function (value) {
          return (
            value +
              (this.reserved || 0) +
              (this.inTransit || 0) +
              (this.noOfLostBook || 0) <=
            this.totalQuantity
          );
        },
        message: "Sum of all quantities cannot exceed total quantity",
      },
    },
    reserved: {
      type: Number,
      default: 0,
      min: [0, "Reserved quantity cannot be negative"],
    },
    inTransit: {
      type: Number,
      default: 0,
      min: [0, "In-transit quantity cannot be negative"],
    },
    noOfLostBook: {
      type: Number,
      default: 0,
      min: [0, "Lost books quantity cannot be negative"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

bookSchema.pre("save", function (next) {
  this.reserved = this.reserved || 0;
  this.inTransit = this.inTransit || 0;
  this.noOfLostBook = this.noOfLostBook || 0;

  if (this.isNew && this.availableQuantity === undefined) {
    this.availableQuantity = this.totalQuantity;
  }

  const totalAllocated =
    this.availableQuantity + this.reserved + this.inTransit + this.noOfLostBook;
  if (totalAllocated > this.totalQuantity) {
    return next(
      new Error(
        `Total allocated quantity (${totalAllocated}) exceeds total quantity (${this.totalQuantity})`
      )
    );
  }

  next();
});

bookSchema.methods.updateQuantities = async function (updates) {
  const validFields = [
    "availableQuantity",
    "reserved",
    "inTransit",
    "noOfLostBook",
  ];

  const invalidFields = Object.keys(updates).filter(
    (field) => !validFields.includes(field)
  );
  if (invalidFields.length > 0) {
    throw new Error(`Invalid fields: ${invalidFields.join(", ")}`);
  }

  const newQuantities = {
    availableQuantity:
      this.availableQuantity + (updates.availableQuantity || 0),
    reserved: this.reserved + (updates.reserved || 0),
    inTransit: this.inTransit + (updates.inTransit || 0),
    noOfLostBook: this.noOfLostBook + (updates.noOfLostBook || 0),
  };

  const newTotal =
    newQuantities.availableQuantity +
    newQuantities.reserved +
    newQuantities.inTransit +
    newQuantities.noOfLostBook;

  if (newTotal > this.totalQuantity) {
    throw new Error(
      `Total quantity (${this.totalQuantity}) would be exceeded. New total would be ${newTotal}`
    );
  }

  Object.assign(this, newQuantities);
  return this.save();
};

const Book = mongoose.model("Book", bookSchema);
module.exports = Book;
