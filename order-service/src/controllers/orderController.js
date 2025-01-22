const Order = require("../models/orderModel");
const Cart = require("../models/cartModel");
const DeliveryPlan = require("../models/deliveryPlanModel");
const StudentStockManagementProfile = require("../models/studentStockManagementProfile");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const axios = require("axios");
const mongoose = require("mongoose");

// Configure base URLs for microservices
const BOOKS_SERVICE_URL =
  process.env.BOOKS_SERVICE_URL || "http://localhost:4001";
const SUBSCRIPTION_SERVICE_URL =
  process.env.SUBSCRIPTION_SERVICE_URL ||
  "http://localhost:4004/api/v1/subscription-service";

// Helper function to validate subscription
const validateSubscription = async (subscriptionId, userId, authToken) => {
  try {
    console.log("Validating subscription:", { subscriptionId, userId });

    const response = await axios.get(
      `${SUBSCRIPTION_SERVICE_URL}/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: authToken,
        },
      }
    );

    console.log("Subscription response:", response.data);

    const subscription = response.data.data.subscription;

    if (!subscription) {
      throw new AppError("Subscription not found", 404);
    }

    if (subscription.userId !== userId) {
      throw new AppError("Subscription does not belong to this user", 403);
    }

    // Case-insensitive status check
    if (subscription.status.toUpperCase() !== "ACTIVE") {
      throw new AppError("Subscription is not active", 400);
    }

    // Check payment status (case-insensitive)
    const validPaymentStatuses = ["succeeded", "paid"].map((status) =>
      status.toLowerCase()
    );
    if (
      !validPaymentStatuses.includes(subscription.paymentStatus.toLowerCase())
    ) {
      throw new AppError("Subscription payment is not complete", 400);
    }

    return subscription;
  } catch (error) {
    console.error("Error validating subscription:", error.response || error);
    throw new AppError(
      `Failed to validate subscription: ${error.response?.data?.message || error.message}`,
      error.response?.status || 500
    );
  }
};

// Helper function to update book quantities
const updateBookQuantities = async (books, authToken) => {
  try {
    console.log("Updating book quantities for books:", books);

    await Promise.all(
      books.map(async (book) => {
        console.log("Processing book:", book);

        // First, check if book exists and get current stock
        const bookResponse = await axios.get(
          `${BOOKS_SERVICE_URL}/api/v1/books-service/books/${book.bookId}`,
          {
            headers: {
              Authorization: authToken,
            },
          }
        );

        console.log("Book details response:", bookResponse.data);

        if (!bookResponse.data || !bookResponse.data.data.book) {
          throw new Error(`Book not found: ${book.bookId}`);
        }

        const bookData = bookResponse.data.data.book;
        if (bookData.availableQuantity < book.quantity) {
          throw new Error(
            `Insufficient stock for book ${book.bookId}. Available: ${bookData.availableQuantity}, Requested: ${book.quantity}`
          );
        }

        // Calculate new quantities
        const newQuantities = {
          available: bookData.availableQuantity - book.quantity,
          reserved: (bookData.reserved || 0) + book.quantity,
        };

        // Update quantities in a single request
        const quantityResponse = await axios.patch(
          `${BOOKS_SERVICE_URL}/api/v1/books-service/books/${book.bookId}/quantities`,
          {
            availableQuantity: newQuantities.available,
            reserved: newQuantities.reserved,
          },
          {
            headers: {
              Authorization: authToken,
            },
          }
        );

        console.log(
          "Quantity update response:",
          quantityResponse.data
        );

        if (
          !quantityResponse.data ||
          quantityResponse.data.status === "error"
        ) {
          throw new Error(
            `Failed to update quantities: ${quantityResponse.data?.message || "Unknown error"}`
          );
        }

        return {
          bookId: book.bookId,
          availableQuantity: newQuantities.available,
          reserved: newQuantities.reserved,
        };
      })
    );
  } catch (error) {
    console.error("Error updating book quantities:", error);
    throw new AppError(
      `Failed to update book quantities: ${error.response?.data?.message || error.message}`,
      error.response?.status || 500
    );
  }
};

// Helper function to calculate delivery date
const calculateDeliveryDate = async (deliveryPlanId) => {
  const deliveryPlan = await DeliveryPlan.findById(deliveryPlanId);
  if (!deliveryPlan) {
    throw new AppError("Delivery plan not found", 404);
  }

  const currentDate = new Date();
  const deliveryDay = deliveryPlan.deliveryDay;
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const targetDayIndex = days.indexOf(deliveryDay);
  const currentDayIndex = currentDate.getDay();

  // Calculate days until next delivery
  let daysUntilDelivery = targetDayIndex - currentDayIndex;
  if (daysUntilDelivery <= 0) {
    daysUntilDelivery += 7;
  }

  // If processing time > 3 days, move to next week
  if (daysUntilDelivery <= 3) {
    daysUntilDelivery += 7;
  }

  const estimatedDeliveryDate = new Date(currentDate);
  estimatedDeliveryDate.setDate(currentDate.getDate() + daysUntilDelivery);

  return estimatedDeliveryDate;
};

// Helper function to get book details
const getBookDetails = async (bookId) => {
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

// Helper function to get subscription details with plan frequency
const getSubscriptionDetails = async (subscriptionId) => {
  try {
    const response = await axios.get(
      `${SUBSCRIPTION_SERVICE_URL}/subscriptions/${subscriptionId}`
    );
    const subscription = response.data.data.subscription;

    if (!subscription) {
      throw new AppError("Subscription not found", 404);
    }

    // Get plan frequency details
    const planFreqResponse = await axios.get(
      `${SUBSCRIPTION_SERVICE_URL}/plan-frequency-types/${subscription.planFrequencyTypeId._id || subscription.planFrequencyTypeId}`
    );

    if (!planFreqResponse.data.data.planFrequencyType) {
      throw new AppError("Plan frequency type not found", 404);
    }

    const planFrequency = planFreqResponse.data.data.planFrequencyType;

    return {
      ...subscription,
      planFrequency,
    };
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    throw new AppError(
      `Failed to fetch subscription details: ${error.response?.data?.message || error.message}`,
      error.response?.status || 500
    );
  }
};

// Helper function to manage student stock profile
const manageStudentStockProfile = async (
  userId,
  subscriptionId,
  totalBooksOrdered,
  subscriptionData
) => {
  try {
    // Find existing profile or create new one
    let profile = await StudentStockManagementProfile.findOne({
      userId,
      subscriptionId,
      status: "ACTIVE",
    });

    const maxBooksAllowed = subscriptionData.data.subscription.maxBooksAllowed;

    if (!profile) {
      // Create new profile
      profile = await StudentStockManagementProfile.create({
        userId,
        subscriptionId,
        maxBooksAllowed,
        booksLimitLeft: maxBooksAllowed - totalBooksOrdered,
        booksLimitUtilized: totalBooksOrdered,
        status: "ACTIVE",
      });
    } else {
      // Update existing profile
      if (profile.booksLimitLeft < totalBooksOrdered) {
        throw new AppError(
          `Insufficient books limit. Available: ${profile.booksLimitLeft}, Requested: ${totalBooksOrdered}`,
          400
        );
      }

      profile.booksLimitLeft = maxBooksAllowed - (profile.booksLimitUtilized + totalBooksOrdered);
      profile.booksLimitUtilized += totalBooksOrdered;
      await profile.save();
    }

    return profile;
  } catch (error) {
    throw new AppError(
      `Failed to manage student stock profile: ${error.message}`,
      error.statusCode || 500
    );
  }
};

// Create order
exports.createOrder = catchAsync(async (req, res, next) => {
  const { userId, subscriptionId, cartId, deliveryId, totalBooksOrdered } =
    req.body;
  const authToken = req.headers.authorization;

  console.log("Creating order with data:", {
    userId,
    subscriptionId,
    cartId,
    deliveryId,
    totalBooksOrdered,
  });

  // 1. Get cart details from local database
  const cart = await Cart.findById(cartId);
  console.log("Found cart:", cart);

  if (!cart) {
    return next(new AppError("Cart not found", 404));
  }

  if (cart.status !== "ACTIVE") {
    return next(new AppError("Cart is not active", 400));
  }

  // Verify cart belongs to user
  if (cart.userId.toString() !== userId) {
    return next(new AppError("Cart does not belong to this user", 403));
  }

  // 2. Validate subscription
  const subscription = await validateSubscription(
    subscriptionId,
    userId,
    authToken
  );

  // 3. Calculate total books in cart
  const totalBooks = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  
  // 4. Manage student stock profile
  try {
    const subscriptionData = await validateSubscription(
      subscriptionId,
      userId,
      authToken
    );
    
    await manageStudentStockProfile(
      userId,
      subscriptionId,
      totalBooks,
      subscriptionData
    );
  } catch (error) {
    return next(error);
  }

  // 5. Update book quantities
  try {
    await updateBookQuantities(cart.items, authToken);
  } catch (error) {
    // Rollback student stock profile changes
    const profile = await StudentStockManagementProfile.findOne({
      userId,
      subscriptionId,
      status: "ACTIVE",
    });
    if (profile) {
      profile.booksLimitLeft += totalBooks;
      profile.booksLimitUtilized -= totalBooks;
      await profile.save();
    }
    return next(error);
  }

  // Calculate estimated delivery date
  const estimatedDeliveryDate = await calculateDeliveryDate(deliveryId);

  // Get subscription details for due date calculation
  const subscriptionDetails = await getSubscriptionDetails(subscriptionId);
  if (
    !subscriptionDetails.planFrequency ||
    !subscriptionDetails.planFrequency.deliveryDays
  ) {
    return next(new AppError("Invalid subscription plan frequency", 400));
  }

  // Calculate due date
  const dueDate = new Date(estimatedDeliveryDate);
  dueDate.setDate(
    dueDate.getDate() + subscriptionDetails.planFrequency.deliveryDays
  );

  // 6. Create order
  const order = await Order.create({
    userId,
    subscriptionId,
    cartId,
    deliveryId,
    books: cart.items,
    totalBooksOrdered: totalBooks,
    status: "pending",
    estimatedDeliveryDate,
    dueDate,
    isCancellationRequested: false,
    isBooksReceived: false,
  });

  // 7. Mark cart as ordered (using lowercase)
  cart.status = "ordered";
  await cart.save();

  res.status(201).json({
    status: "success",
    data: {
      order,
    },
  });
});

exports.approveOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate("cartId");

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  if (order.status !== "pending") {
    return next(new AppError("Order can only be approved when pending", 400));
  }

  // Only update status to approved, don't move quantities yet
  order.status = "approved";
  await order.save();

  res.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
});

exports.requestCancellation = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  if (order.status === "dispatched") {
    return next(new AppError("Cannot cancel dispatched order", 400));
  }

  order.isCancellationRequested = true;
  await order.save();

  res.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
});

exports.cancelOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate("cartId");

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  if (!order.isCancellationRequested) {
    return next(new AppError("Cancellation must be requested first", 400));
  }

  if (order.status === "dispatched") {
    return next(new AppError("Cannot cancel dispatched order", 400));
  }

  // Return books to available stock
  for (const item of order.cartId.items) {
    await updateBookQuantities([{ bookId: item.bookId, quantity: item.quantity }], req.headers.authorization);
  }

  order.status = "cancelled";
  await order.save();

  res.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
});

exports.dispatchOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate("cartId");

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  if (order.status !== "approved") {
    return next(new AppError("Order must be approved before dispatch", 400));
  }

  // Move quantities from reserved to in-transit during dispatch
  for (const item of order.cartId.items) {
    await updateBookQuantities([{ bookId: item.bookId, quantity: -item.quantity }], req.headers.authorization);
  }

  order.status = "dispatched";
  await order.save();

  res.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
});

exports.confirmReceived = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  if (order.status !== "dispatched") {
    return next(new AppError("Order must be dispatched first", 400));
  }

  order.isBooksReceived = true;
  await order.save();

  res.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
});

exports.returnOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate("cartId");

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  if (!order.isBooksReceived) {
    return next(new AppError("Book must be received before return", 400));
  }

  const currentDate = new Date();
  if (currentDate > order.dueDate) {
    // Mark as lost if past due date
    for (const item of order.cartId.items) {
      await updateBookQuantities([{ bookId: item.bookId, quantity: item.quantity }], req.headers.authorization);
    }
    order.status = "lost";
  } else {
    // Return to available stock if within due date
    for (const item of order.cartId.items) {
      await updateBookQuantities([{ bookId: item.bookId, quantity: item.quantity }], req.headers.authorization);
    }
    order.status = "returned";
  }

  await order.save();

  res.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
});
