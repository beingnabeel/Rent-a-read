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
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "User ID is required"],
    },
    items: [
      {
        bookId: {
          type: String,
          required: [true, "Book ID is required"],
        },
        quantity: {
          type: Number,
          required: [true, "Quantity is required"],
          min: [1, "Quantity must be at least 1"],
        },
      },
    ],
    status: {
      type: String,
      enum: ["ACTIVE", "ordered", "abandoned"],
      default: "ACTIVE",
    },
    expiryTime: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Set expiry time before saving
cartSchema.pre("save", function (next) {
  if (this.isNew) {
    // Set expiry time to 6 hours from now
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 6);
    this.expiryTime = expiryTime;
  }
  next();
});

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
