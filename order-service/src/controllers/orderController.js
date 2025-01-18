const Order = require("../models/orderModel");
const Cart = require("../models/cartModel");
const DeliveryPlan = require("../models/deliveryPlanModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const axios = require("axios");

// Configure base URLs for microservices
const BOOKS_SERVICE_URL =
  process.env.BOOKS_SERVICE_URL || "http://localhost:4001/api/v1/books-service";

// Helper function to update book quantities
const updateBookQuantities = async (bookId, updates) => {
  try {
    const response = await axios.patch(
      `${BOOKS_SERVICE_URL}/books/${bookId}/quantities`,
      updates,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
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

exports.createOrder = catchAsync(async (req, res, next) => {
  // Calculate estimated delivery date
  const estimatedDeliveryDate = await calculateDeliveryDate(
    req.body.deliveryId
  );

  // Get subscription details to calculate due date
  const subscriptionResponse = await axios.get(
    `${process.env.SUBSCRIPTION_SERVICE_URL || "http://localhost:4004/api/v1/subscription-service"}/subscriptions/${req.body.subscriptionId}`
  );

  const subscription = subscriptionResponse.data.data.subscription;
  if (!subscription) {
    return next(new AppError("Subscription not found", 404));
  }

  // Calculate due date based on delivery frequency
  const dueDate = new Date(estimatedDeliveryDate);
  dueDate.setDate(
    estimatedDeliveryDate.getDate() +
      (subscription.planFrequencyTypeId.deliveryDays || 7) // Default to 7 days if not specified
  );

  // Get cart and validate book quantities
  const cart = await Cart.findById(req.body.cartId);
  if (!cart) {
    return next(new AppError("Cart not found", 404));
  }

  // Validate and update book quantities
  for (const item of cart.items) {
    const bookDetails = await getBookDetails(item.bookId);
    if (!bookDetails) {
      return next(new AppError(`Book not found: ${item.bookId}`, 404));
    }
    if (item.quantity > bookDetails.availableQuantity) {
      return next(
        new AppError(`Insufficient stock for book: ${bookDetails.title}`, 400)
      );
    }
    // Store book details in cart item
    item.bookDetails = bookDetails;
  }

  // Create order with calculated dates
  const order = await Order.create({
    ...req.body,
    estimatedDeliveryDate,
    dueDate,
  });

  // If order is created successfully, update book quantities
  if (order.status === "pending") {
    for (const item of cart.items) {
      await updateBookQuantities(item.bookId, {
        availableQuantity: -item.quantity,
        reserved: item.quantity,
      });
    }
  }

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
    await updateBookQuantities(item.bookId, {
      availableQuantity: item.quantity,
      reserved: -item.quantity,
    });
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
    await updateBookQuantities(item.bookId, {
      reserved: -item.quantity,
      inTransit: item.quantity,
    });
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

  order.isBookReceived = true;
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

  if (!order.isBookReceived) {
    return next(new AppError("Book must be received before return", 400));
  }

  const currentDate = new Date();
  if (currentDate > order.dueDate) {
    // Mark as lost if past due date
    for (const item of order.cartId.items) {
      await updateBookQuantities(item.bookId, {
        noOfLostBook: item.quantity,
        inTransit: -item.quantity,
      });
    }
    order.status = "lost";
  } else {
    // Return to available stock if within due date
    for (const item of order.cartId.items) {
      await updateBookQuantities(item.bookId, {
        availableQuantity: item.quantity,
        inTransit: -item.quantity,
      });
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
