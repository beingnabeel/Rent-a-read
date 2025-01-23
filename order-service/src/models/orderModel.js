const mongoose = require("mongoose");
const AppError = require("../utils/appError");
const axios = require("axios");

// Configure base URLs for microservices
const SUBSCRIPTION_SERVICE_URL =
  process.env.SUBSCRIPTION_SERVICE_URL ||
  "http://localhost:4004/api/v1/subscription-service";

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "User ID is required"],
    },
    subscriptionId: {
      type: String,
      required: [true, "Subscription ID is required"],
    },
    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Cart ID is required"],
    },
    deliveryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Delivery ID is required"],
    },
    books: [
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
    totalBooksOrdered: {
      type: Number,
      required: [true, "Total books ordered is required"],
    },
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "confirmed",
        "dispatched",
        "delivered",
        "return-requested",
        "cancelled",
        "returned",
        "lost",
      ],
      default: "pending",
    },
    estimatedDeliveryDate: {
      type: Date,
      required: [true, "Estimated delivery date is required"],
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    isCancellationRequested: {
      type: Boolean,
      default: false,
    },
    isBooksReceived: {
      type: Boolean,
      default: false,
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

// Calculate total books ordered and validate subscription
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

    // Validate against subscription through Subscription Service API
    try {
      const subscriptionResponse = await axios.get(
        `${SUBSCRIPTION_SERVICE_URL}/subscriptions/${this.subscriptionId}`
      );
      const subscription = subscriptionResponse.data.data.subscription;

      if (!subscription) {
        return next(new AppError("Subscription not found", 404));
      }

      if (this.totalBooksOrdered > subscription.maxBooksAllowed) {
        return next(
          new AppError(
            `Order exceeds subscription book limit of ${subscription.maxBooksAllowed} books`,
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
