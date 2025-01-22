const Cart = require("../models/cartModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const axios = require("axios");

// Configure base URLs for microservices
const BOOKS_SERVICE_URL =
  process.env.BOOKS_SERVICE_URL || "http://localhost:4001";
const SUBSCRIPTION_SERVICE_URL =
  process.env.SUBSCRIPTION_SERVICE_URL ||
  "http://localhost:4004/api/v1/subscription-service";

// Helper function to check subscription status
const checkSubscriptionStatus = async (userId) => {
  try {
    const response = await axios.get(
      `${SUBSCRIPTION_SERVICE_URL}/subscriptions/user/${userId}/active`
    );
    return response.data.data.subscription;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new AppError("No active subscription found for this user", 403);
    }
    throw new AppError(
      `Failed to verify subscription: ${error.response?.data?.message || error.message}`,
      error.response?.status || 500
    );
  }
};

// Helper function to check book availability
const checkBookAvailability = async (bookId) => {
  try {
    console.log("Checking book availability for bookId:", bookId);
    console.log(
      "Book service URL:",
      `${BOOKS_SERVICE_URL}/api/v1/books-service/books/${bookId}`
    );

    const response = await axios.get(
      `${BOOKS_SERVICE_URL}/api/v1/books-service/books/${bookId}`
    );

    console.log("Book service response:", response.data);
    return response.data.data.book;
  } catch (error) {
    console.error("Error checking book availability:", error.response || error);
    throw new AppError(
      `Failed to fetch book details: ${error.response?.data?.message || error.message}`,
      error.response?.status || 500
    );
  }
};

// Helper function to check cart expiry
const checkCartExpiry = async (cart) => {
  if (cart.isExpired()) {
    cart.status = "abandoned";
    await cart.save();
    throw new AppError(
      "Cart has expired and been marked as abandoned. Please create a new cart.",
      400
    );
  }
};

exports.createCart = catchAsync(async (req, res, next) => {
  const { userId, items } = req.body;
  const authToken = req.headers.authorization;

  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    return next(new AppError("Cart must have at least one item", 400));
  }

  // Check active subscription
  try {
    await checkSubscriptionStatus(userId);
  } catch (error) {
    return next(error);
  }

  // Check for existing active cart
  const existingCart = await Cart.findOne({
    userId,
    status: "ACTIVE",
  });

  if (existingCart) {
    return next(
      new AppError(
        "User already has an active cart. Please use that or abandon it first.",
        400
      )
    );
  }

  // Validate book availability
  for (const item of items) {
    try {
      const response = await axios.get(
        `${BOOKS_SERVICE_URL}/api/v1/books-service/books/${item.bookId}`,
        {
          headers: {
            Authorization: authToken,
          },
        }
      );

      const book = response.data.data.book;
      if (!book) {
        return next(new AppError(`Book not found: ${item.bookId}`, 404));
      }

      if (book.availableQuantity < item.quantity) {
        return next(
          new AppError(
            `Insufficient stock for book ${book.title}. Available: ${book.availableQuantity}, Requested: ${item.quantity}`,
            400
          )
        );
      }
    } catch (error) {
      return next(
        new AppError(
          `Failed to validate book: ${error.response?.data?.message || error.message}`,
          error.response?.status || 500
        )
      );
    }
  }

  // Set expiry time to 6 hours from now
  const expiryTime = new Date();
  expiryTime.setHours(expiryTime.getHours() + 6);

  // Create cart
  const cart = await Cart.create({
    userId,
    items,
    status: "ACTIVE",
    expiryTime,
  });

  res.status(201).json({
    status: "success",
    data: {
      cart,
    },
  });
});

exports.getCart = catchAsync(async (req, res, next) => {
  const cart = await Cart.findById(req.params.id);

  if (!cart) {
    return next(new AppError("Cart not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      cart,
    },
  });
});

exports.updateCart = catchAsync(async (req, res, next) => {
  const { items } = req.body;
  const authToken = req.headers.authorization;

  const cart = await Cart.findById(req.params.id);
  if (!cart) {
    return next(new AppError("Cart not found", 404));
  }

  if (cart.status !== "ACTIVE") {
    return next(new AppError("Cannot update a non-active cart", 400));
  }

  // Check active subscription
  try {
    await checkSubscriptionStatus(cart.userId);
  } catch (error) {
    return next(error);
  }

  // Validate book availability for new items
  for (const item of items) {
    try {
      const response = await axios.get(
        `${BOOKS_SERVICE_URL}/api/v1/books-service/books/${item.bookId}`,
        {
          headers: {
            Authorization: authToken,
          },
        }
      );

      const book = response.data.data.book;
      if (!book) {
        return next(new AppError(`Book not found: ${item.bookId}`, 404));
      }

      if (book.availableQuantity < item.quantity) {
        return next(
          new AppError(
            `Insufficient stock for book ${book.title}. Available: ${book.availableQuantity}, Requested: ${item.quantity}`,
            400
          )
        );
      }
    } catch (error) {
      return next(
        new AppError(
          `Failed to validate book: ${error.response?.data?.message || error.message}`,
          error.response?.status || 500
        )
      );
    }
  }

  // Reset expiry time when cart is updated
  const expiryTime = new Date();
  expiryTime.setHours(expiryTime.getHours() + 6);

  cart.items = items;
  cart.expiryTime = expiryTime;
  await cart.save();

  res.status(200).json({
    status: "success",
    data: {
      cart,
    },
  });
});

exports.abandonCart = catchAsync(async (req, res, next) => {
  const cart = await Cart.findById(req.params.id);
  if (!cart) {
    return next(new AppError("Cart not found", 404));
  }

  if (cart.status !== "ACTIVE") {
    return next(new AppError("Cannot abandon a non-active cart", 400));
  }

  cart.status = "abandoned";
  await cart.save();

  res.status(200).json({
    status: "success",
    data: {
      cart,
    },
  });
});

// Add this method to get cart with book details
exports.getCartWithDetails = catchAsync(async (req, res, next) => {
  console.log("Getting cart details for ID:", req.params.id);
  const cart = await Cart.findById(req.params.id);
  if (!cart) {
    return next(new AppError("No cart found with that ID", 404));
  }

  // Fetch book details for each item
  const itemsWithDetails = await Promise.all(
    cart.items.map(async (item) => {
      console.log("Fetching details for book:", item.bookId);
      const book = await checkBookAvailability(item.bookId);
      return {
        ...item.toObject(),
        bookDetails: book,
      };
    })
  );

  res.status(200).json({
    status: "success",
    data: {
      cart: {
        ...cart.toObject(),
        items: itemsWithDetails,
      },
    },
  });
});

// Add this new method to get active cart
exports.getActiveCart = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({
    userId: req.params.userId,
    status: "ACTIVE",
  });

  if (!cart) {
    return next(new AppError("No active cart found", 404));
  }

  // Check active subscription
  try {
    await checkSubscriptionStatus(cart.userId);
  } catch (error) {
    return next(error);
  }

  // Check cart expiry
  await checkCartExpiry(cart);

  res.status(200).json({
    status: "success",
    data: {
      cart,
    },
  });
});
