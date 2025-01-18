const mongoose = require("mongoose");

const BookQuantitySchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: [true, "Book ID is required"],
      validate: {
        validator: async function (v) {
          const Book = mongoose.model("Book");
          const book = await Book.findById(v);
          return book !== null;
        },
        message: "Invalid book ID",
      },
    },
    totalQuantity: {
      type: Number,
      default: 0,
    },
    availableQuantity: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Add a method to increment book total
BookQuantitySchema.methods.incrementBookTotal = function (quantity) {
  this.totalQuantity += quantity;
  this.availableQuantity += quantity;
  return this.save();
};

// Add a static method to find by bookId
BookQuantitySchema.statics.findByBookId = function (bookId) {
  return this.findOne({ bookId });
};

module.exports = mongoose.model("BookQuantity", BookQuantitySchema);
