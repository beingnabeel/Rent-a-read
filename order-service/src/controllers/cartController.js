const Cart = require("../models/cartModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const axios = require("axios");

// Configure base URLs for microservices
const BOOKS_SERVICE_URL =
  process.env.BOOKS_SERVICE_URL || "http://localhost:4001/api/v1/books-service";
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
    const response = await axios.get(`${BOOKS_SERVICE_URL}/books/${bookId}`);
    return response.data.data.book;
  } catch (error) {
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
  console.log("Request body:", req.body);

  // Validate request body
  if (
    !req.body.items ||
    !Array.isArray(req.body.items) ||
    req.body.items.length === 0
  ) {
    return next(
      new AppError("Please provide items array with at least one item", 400)
    );
  }

  // Check subscription status first
  const subscription = await checkSubscriptionStatus(req.body.userId);

  // Check for both possible payment status values
  if (
    !subscription ||
    !["succeeded", "paid"].includes(subscription.paymentStatus)
  ) {
    return next(
      new AppError(
        "Active paid subscription required to add items to cart",
        403
      )
    );
  }

  // Check if total books requested exceed subscription limit
  const totalBooksRequested = req.body.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  if (totalBooksRequested > subscription.maxBooksAllowed) {
    return next(
      new AppError(
        `Cart items exceed subscription limit of ${subscription.maxBooksAllowed} books`,
        400
      )
    );
  }

  // Validate each item and check availability
  for (const item of req.body.items) {
    if (
      !item.bookId ||
      !item.quantity ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      return next(
        new AppError("Each item must have a valid bookId and quantity", 400)
      );
    }

    const book = await checkBookAvailability(item.bookId);

    if (!book) {
      return next(new AppError(`Book with ID ${item.bookId} not found`, 404));
    }

    if (book.availableQuantity < item.quantity) {
      return next(
        new AppError(
          `Only ${book.availableQuantity} copies available for book "${book.title}"`,
          400
        )
      );
    }
  }

  // Check for existing active cart
  const existingCart = await Cart.findOne({
    userId: req.body.userId,
    status: "ACTIVE",
  });

  if (existingCart) {
    // Check if existing cart is expired
    if (existingCart.isExpired()) {
      existingCart.status = "abandoned";
      await existingCart.save();
    } else {
      return next(new AppError("User already has an active cart", 400));
    }
  }

  let cart;

  if (existingCart) {
    // Calculate total books after adding new items
    const totalExistingBooks = existingCart.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    const totalAfterAdd = totalExistingBooks + totalBooksRequested;

    if (totalAfterAdd > subscription.maxBooksAllowed) {
      return next(
        new AppError(
          `Adding these items would exceed subscription limit of ${subscription.maxBooksAllowed} books`,
          400
        )
      );
    }

    // Add items to existing cart
    const newItems = req.body.items || [];
    newItems.forEach((newItem) => {
      const existingItemIndex = existingCart.items.findIndex(
        (item) => item.bookId.toString() === newItem.bookId.toString()
      );

      if (existingItemIndex > -1) {
        existingCart.items[existingItemIndex].quantity += newItem.quantity;
      } else {
        existingCart.items.push({
          bookId: newItem.bookId,
          quantity: newItem.quantity,
        });
      }
    });

    cart = await existingCart.save();
  } else {
    // Create new cart
    cart = await Cart.create({
      userId: req.body.userId,
      items: req.body.items.map((item) => ({
        bookId: item.bookId,
        quantity: item.quantity,
      })),
      status: "ACTIVE",
    });
  }

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
    return next(new AppError("No cart found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      cart,
    },
  });
});

exports.updateCart = catchAsync(async (req, res, next) => {
  // Validate request body
  if (req.body.items) {
    if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
      return next(new AppError("Items should be a non-empty array", 400));
    }

    // Validate each item
    for (const item of req.body.items) {
      if (
        !item.bookId ||
        !item.quantity ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return next(
          new AppError("Each item must have a valid bookId and quantity", 400)
        );
      }
    }
  }

  // Find the cart
  const cart = await Cart.findById(req.params.id);
  if (!cart) {
    return next(new AppError("No cart found with that ID", 404));
  }

  // Check cart expiry
  await checkCartExpiry(cart);

  if (cart.status !== "ACTIVE") {
    return next(new AppError("Cannot update an inactive cart", 400));
  }

  // Check subscription status
  const subscription = await checkSubscriptionStatus(cart.userId);
  if (
    !subscription ||
    !["succeeded", "paid"].includes(subscription.paymentStatus)
  ) {
    return next(
      new AppError("Active paid subscription required to update cart", 403)
    );
  }

  if (req.body.items) {
    // Calculate total books requested
    const totalBooksRequested = req.body.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    // Check subscription book limit
    if (totalBooksRequested > subscription.maxBooksAllowed) {
      return next(
        new AppError(
          `Cart items exceed subscription limit of ${subscription.maxBooksAllowed} books`,
          400
        )
      );
    }

    // Check book availability for each item
    for (const item of req.body.items) {
      const book = await checkBookAvailability(item.bookId);

      if (!book) {
        return next(new AppError(`Book with ID ${item.bookId} not found`, 404));
      }

      // Check if requested quantity is available
      if (book.availableQuantity < item.quantity) {
        return next(
          new AppError(
            `Only ${book.availableQuantity} copies available for book "${book.title}"`,
            400
          )
        );
      }

      // If this is an existing item, we need to check if the quantity increase is possible
      const existingItem = cart.items.find(
        (cartItem) => cartItem.bookId.toString() === item.bookId.toString()
      );

      if (existingItem && item.quantity > existingItem.quantity) {
        const additionalQuantity = item.quantity - existingItem.quantity;
        if (additionalQuantity > book.availableQuantity) {
          return next(
            new AppError(
              `Cannot increase quantity by ${additionalQuantity}. Only ${book.availableQuantity} additional copies available for book "${book.title}"`,
              400
            )
          );
        }
      }
    }

    // If all checks pass, update the cart items
    cart.items = req.body.items;
  }

  // Don't allow updating userId
  if (req.body.userId) delete req.body.userId;

  // Update other fields if needed (except userId and status)
  if (req.body.status) {
    cart.status = req.body.status;
  }

  const updatedCart = await cart.save();

  res.status(200).json({
    status: "success",
    data: {
      cart: updatedCart,
    },
  });
});

exports.deleteCart = catchAsync(async (req, res, next) => {
  const cart = await Cart.findByIdAndUpdate(
    req.params.id,
    { status: "abandoned" },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!cart) {
    return next(new AppError("No cart found with that ID", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});

// Add this method to get cart with book details
exports.getCartWithDetails = catchAsync(async (req, res, next) => {
  const cart = await Cart.findById(req.params.id);
  if (!cart) {
    return next(new AppError("No cart found with that ID", 404));
  }

  // Fetch book details for each item
  const itemsWithDetails = await Promise.all(
    cart.items.map(async (item) => {
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

  // Check cart expiry
  await checkCartExpiry(cart);

  res.status(200).json({
    status: "success",
    data: {
      cart,
    },
  });
});
