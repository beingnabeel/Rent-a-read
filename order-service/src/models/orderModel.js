const mongoose = require("mongoose");
const AppError = require("../utils/appError");
const axios = require("axios");

// Configure base URLs for microservices
const SUBSCRIPTION_SERVICE_URL =
  process.env.SUBSCRIPTION_SERVICE_URL ||
  "http://localhost:4004/api/v1/subscription-service";
const BOOKS_SERVICE_URL =
  process.env.BOOKS_SERVICE_URL || "http://localhost:4001/api/v1/books-service";

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      required: [true, "Order must belong to a user"],
    },
    subscriptionId: {
      type: mongoose.Schema.ObjectId,
      required: [true, "Order must be associated with a subscription"],
    },
    cartId: {
      type: mongoose.Schema.ObjectId,
      ref: "Cart",
      required: [true, "Order must be associated with a cart"],
    },
    deliveryId: {
      type: mongoose.Schema.ObjectId,
      ref: "DeliveryPlan",
      required: [true, "Order must have a delivery plan"],
    },
    totalBooksOrdered: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "cancelled",
        "dispatched",
        "returned",
        "lost",
      ],
      default: "pending",
    },
    isCancellationRequested: {
      type: Boolean,
      default: false,
    },
    isBookReceived: {
      type: Boolean,
      default: false,
    },
    estimatedDeliveryDate: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Only populate cart and delivery plan
orderSchema.pre(/^find/, async function (next) {
  this.populate({
    path: "cartId",
  }).populate("deliveryId");
  next();
});

// Calculate total books ordered and validate stock
orderSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  try {
    const Cart = mongoose.model("Cart");
    const cart = await Cart.findById(this.cartId);
    if (!cart) {
      return next(new AppError("Cart not found", 404));
    }

    // Calculate total books ordered
    this.totalBooksOrdered = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    // Validate stock availability through Books Service API
    for (const item of cart.items) {
      try {
        const response = await axios.get(
          `${BOOKS_SERVICE_URL}/books/${item.bookId}`
        );
        const book = response.data.data.book;

        if (!book) {
          return next(new AppError(`Book not found: ${item.bookId}`, 404));
        }

        if (item.quantity > book.availableQuantity) {
          return next(
            new AppError(`Insufficient stock for book: ${book.title}`, 400)
          );
        }
      } catch (error) {
        return next(
          new AppError(
            `Failed to validate book stock: ${error.message}`,
            error.response?.status || 500
          )
        );
      }
    }

    // Validate against subscription through Subscription Service API
    try {
      const subscriptionResponse = await axios.get(
        `${SUBSCRIPTION_SERVICE_URL}/subscriptions/${this.subscriptionId}`
      );
      const subscription = subscriptionResponse.data.data.subscription;

      if (!subscription) {
        return next(new AppError("Subscription not found", 404));
      }

      if (
        this.totalBooksOrdered > subscription.planFrequencyTypeId.booksCount
      ) {
        return next(
          new AppError(
            `Order exceeds subscription book limit of ${subscription.planFrequencyTypeId.booksCount} books`,
            400
          )
        );
      }
    } catch (error) {
      return next(
        new AppError(
          `Failed to validate subscription: ${error.message}`,
          error.response?.status || 500
        )
      );
    }

    next();
  } catch (error) {
    next(error);
  }
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
