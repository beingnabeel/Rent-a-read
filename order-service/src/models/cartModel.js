const mongoose = require("mongoose");
const axios = require("axios");

const cartItemSchema = new mongoose.Schema(
  {
    bookId: {
      type: String,
      required: [true, "Cart item must have a book ID"],
    },
    quantity: {
      type: Number,
      required: [true, "Cart item must have a quantity"],
      min: [1, "Quantity must be at least 1"],
    },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      required: [true, "Cart must belong to a user"],
    },
    items: [cartItemSchema],
    status: {
      type: String,
      enum: ["ACTIVE", "ordered", "abandoned"],
      default: "ACTIVE",
    },
    expiryTime: {
      type: Date,
      default: function () {
        // Set expiry to 10 minutes from creation in IST
        const date = new Date();
        // Add 5 hours and 30 minutes to convert to IST
        date.setHours(date.getHours() + 5);
        date.setMinutes(date.getMinutes() + 30);
        // Add 10 minutes for expiry
        date.setMinutes(date.getMinutes() + 10);
        return date;
      },
    },
  },
  {
    timestamps: true,
  }
);

// Add a method to check if cart is expired
cartSchema.methods.isExpired = function () {
  // Convert current time to IST for comparison
  const currentDate = new Date();
  currentDate.setHours(currentDate.getHours() + 5);
  currentDate.setMinutes(currentDate.getMinutes() + 30);
  return this.status === "ACTIVE" && currentDate > this.expiryTime;
};

// Add a virtual populate to get book details when needed
cartSchema.virtual("itemsWithDetails", {
  async get() {
    const populatedItems = await Promise.all(
      this.items.map(async (item) => {
        try {
          const response = await axios.get(
            `${process.env.BOOKS_SERVICE_URL}/books/${item.bookId}`
          );
          return {
            ...item.toObject(),
            bookDetails: response.data.data.book,
          };
        } catch (error) {
          console.error(
            `Error fetching book details for ${item.bookId}:`,
            error
          );
          return item;
        }
      })
    );
    return populatedItems;
  },
});

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;
