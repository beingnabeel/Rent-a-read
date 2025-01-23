const Order = require("../models/orderModel");
const Cart = require("../models/cartModel");
const DeliveryPlan = require("../models/deliveryPlanModel");
const StudentStockManagementProfile = require("../models/studentStockManagementProfile");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const axios = require("axios");
const mongoose = require("mongoose");

// Configure base URLs for microservices
const BOOK_SERVICE_URL =
  process.env.BOOK_SERVICE_URL || "http://localhost:4001/api/v1/books-service";
const SUBSCRIPTION_SERVICE_URL =
  process.env.SUBSCRIPTION_SERVICE_URL ||
  "http://localhost:4004/api/v1/subscription-service";
const DELIVERY_SERVICE_URL =
  process.env.DELIVERY_SERVICE_URL ||
  "http://localhost:4002/api/v1/orders";

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

    return response.data;
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
          `${BOOK_SERVICE_URL}/books/${book.bookId}`,
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
          `${BOOK_SERVICE_URL}/books/${book.bookId}/quantities`,
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

        console.log("Quantity update response:", quantityResponse.data);

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

// Helper function to update book quantities for dispatch
const updateBookQuantitiesForDispatch = async (bookId, quantity, authToken) => {
  try {
    console.log(
      `Updating book quantities for dispatch - BookId: ${bookId}, Quantity: ${quantity}`
    );

    // First get the current book data
    const bookResponse = await axios.get(
      `http://localhost:4001/api/v1/books-service/books/${bookId}`,
      {
        headers: {
          Authorization: authToken,
        },
      }
    );

    console.log("Current book data:", bookResponse.data);

    const currentBook = bookResponse.data.data.book;

    // Update the book with new reserved and inTransit values
    const response = await axios.patch(
      `http://localhost:4001/api/v1/books-service/books/${bookId}`,
      {
        reserved: Math.max(0, currentBook.reserved - quantity), // Ensure we don't go below 0
        inTransit: currentBook.inTransit + quantity,
      },
      {
        headers: {
          Authorization: authToken,
        },
      }
    );

    console.log("Book update response:", response.data);

    if (response.data.status !== "success") {
      throw new AppError("Failed to update book quantities", 500);
    }

    return response.data;
  } catch (error) {
    console.error(
      "Error updating book quantities:",
      error.response?.data || error
    );
    throw new AppError(
      `Failed to update book quantities: ${error.response?.data?.message || error.message}`,
      error.response?.status || 500
    );
  }
};

// Helper function to update book quantities for return/lost status
const updateBookQuantitiesForReturn = async (
  bookId,
  quantity,
  isLost,
  authToken
) => {
  try {
    console.log(
      `Updating book quantities for ${isLost ? "lost" : "return"} - BookId: ${bookId}, Quantity: ${quantity}`
    );

    // Get current book data
    const bookResponse = await axios.get(
      `${BOOK_SERVICE_URL}/books/${bookId}`,
      {
        headers: {
          Authorization: authToken,
        },
      }
    );

    const currentBook = bookResponse.data.data.book;
    console.log("Current book data:", currentBook);

    // First update inTransit quantity
    const inTransitResponse = await axios.patch(
      // `${BOOK_SERVICE_URL}/book-stocks/${bookId}/inTransit`,
      `${BOOK_SERVICE_URL}/books/${bookId}`,
      {
        inTransit: Math.max(0, currentBook.inTransit - quantity), // Set absolute value
      },
      {
        headers: {
          Authorization: authToken,
        },
      }
    );
    console.log("inTransit update response:", inTransitResponse.data);

    // Then update either noOfLostBook or availableQuantity
    if (isLost) {
      const lostResponse = await axios.patch(
        `${BOOK_SERVICE_URL}/book-stocks/${bookId}/noOfLostBook`,
        {
          noOfLostBook: currentBook.noOfLostBook + quantity, // Set absolute value
        },
        {
          headers: {
            Authorization: authToken,
          },
        }
      );
      console.log("noOfLostBook update response:", lostResponse.data);
    } else {
      const availableResponse = await axios.patch(
        `${BOOK_SERVICE_URL}/book-stocks/${bookId}/availableQuantity`,
        {
          availableQuantity: currentBook.availableQuantity + quantity, // Set absolute value
        },
        {
          headers: {
            Authorization: authToken,
          },
        }
      );
      console.log("availableQuantity update response:", availableResponse.data);
    }

    // Get final updated book data
    const updatedBookResponse = await axios.get(
      `${BOOK_SERVICE_URL}/books/${bookId}`,
      {
        headers: {
          Authorization: authToken,
        },
      }
    );

    console.log("Final updated book data:", updatedBookResponse.data);
    return updatedBookResponse.data;
  } catch (error) {
    console.error(
      "Error updating book quantities:",
      error.response?.data || error
    );
    throw new AppError(
      `Failed to update book quantities: ${error.response?.data?.message || error.message}`,
      error.response?.status || 500
    );
  }
};

// Helper function to update student stock profile for return
const updateStudentStockProfileForReturn = async (
  profile,
  totalBooksOrdered
) => {
  try {
    profile.booksLimitUtilized = Math.max(
      0,
      profile.booksLimitUtilized - totalBooksOrdered
    );
    profile.booksLimitLeft =
      profile.maxBooksAllowed - profile.booksLimitUtilized;
    await profile.save();
    return profile;
  } catch (error) {
    throw new AppError(
      `Failed to update student stock profile: ${error.message}`,
      error.statusCode || 500
    );
  }
};

// Helper function to check if return is within due date
const isWithinDueDate = (dueDate) => {
  const currentDate = new Date();
  const dueDateObj = new Date(dueDate);
  return currentDate <= dueDateObj;
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
    const response = await axios.get(`${BOOK_SERVICE_URL}/books/${bookId}`);
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

      profile.booksLimitLeft =
        maxBooksAllowed - (profile.booksLimitUtilized + totalBooksOrdered);
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

  // 2. Validate subscription and get subscription data
  const subscriptionData = await validateSubscription(
    subscriptionId,
    userId,
    authToken
  );

  // 3. Calculate total books in cart
  const totalBooks = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  // 4. Manage student stock profile
  try {
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
  // 1. Find and validate order
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // 2. Check if cancellation is requested
  if (!order.isCancellationRequested) {
    return next(new AppError("Cancellation must be requested first", 400));
  }

  // 3. Check if order is not dispatched
  if (order.status === "dispatched") {
    return next(new AppError("Cannot cancel dispatched order", 400));
  }

  try {
    // 4. Update book quantities - move from reserved back to available
    for (const item of order.books) {
      // First get current book data
      const bookResponse = await axios.get(
        `${BOOK_SERVICE_URL}/books/${item.bookId}`,
        {
          headers: {
            Authorization: req.headers.authorization,
          },
        }
      );
      const currentBook = bookResponse.data.data.book;

      // Update reserved quantity using books endpoint
      await axios.patch(
        `${BOOK_SERVICE_URL}/books/${item.bookId}`,
        {
          reserved: Math.max(0, currentBook.reserved - item.quantity)
        },
        {
          headers: {
            Authorization: req.headers.authorization,
          },
        }
      );

      // Update available quantity using book-stocks endpoint
      await axios.patch(
        `${BOOK_SERVICE_URL}/book-stocks/${item.bookId}/availableQuantity`,
        {
          availableQuantity: currentBook.availableQuantity + item.quantity
        },
        {
          headers: {
            Authorization: req.headers.authorization,
          },
        }
      );
    }

    // 5. Update student stock profile - reduce utilized and increase left
    const studentProfile = await StudentStockManagementProfile.findOne({
      userId: order.userId,
      subscriptionId: order.subscriptionId,
      status: "ACTIVE",
    });

    if (studentProfile) {
      // Reduce booksLimitUtilized by the number of books being cancelled
      studentProfile.booksLimitUtilized = Math.max(0, studentProfile.booksLimitUtilized - order.totalBooksOrdered);
      studentProfile.booksLimitLeft = studentProfile.maxBooksAllowed - studentProfile.booksLimitUtilized;
      await studentProfile.save();
    }

    // 6. Update order status
    order.status = "cancelled";
    await order.save();

    res.status(200).json({
      status: "success",
      data: {
        order,
      },
    });
  } catch (error) {
    return next(
      new AppError(
        `Failed to cancel order: ${error.response?.data?.message || error.message}`,
        error.response?.status || 500
      )
    );
  }
});

exports.dispatchOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  if (order.status !== "approved") {
    return next(new AppError("Order must be approved before dispatch", 400));
  }

  // Move quantities from reserved to in-transit for each book in the order
  try {
    for (const item of order.books) {
      await updateBookQuantitiesForDispatch(
        item.bookId,
        item.quantity,
        req.headers.authorization
      );
    }
  } catch (error) {
    return next(error);
  }

  // Update order status to dispatched
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
  order.status = "delivered";
  order.isBooksReceived = true;
  await order.save();

  res.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
});

exports.requestReturn = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError("Order not found", 404));
  }
  if (order.status !== "delivered") {
    return next(new AppError("Order must be delivered first", 400));
  }
  if (order.isBooksReceived) {
    order.status = "return-requested";
    await order.save();
    res.status(200).json({
      status: "success",
      data: {
        order,
      },
    });
  } else {
    return next(new AppError("Book must be received before return", 400));
  }
});

exports.returnOrder = catchAsync(async (req, res, next) => {
  // 1. Find and validate order
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // 2. Check if books are received
  if (!order.isBooksReceived) {
    return next(new AppError("Books must be received before return", 400));
  }

  // 3. Check if return is requested
  if (order.status !== "return-requested") {
    return next(new AppError("Return must be requested first", 400));
  }

  try {
    // 4. Check if return is within due date
    const currentDate = new Date();
    const dueDate = new Date(order.dueDate);
    const isWithinDueDate = currentDate <= dueDate;

    console.log('Return date check:', {
      currentDate,
      dueDate,
      isWithinDueDate,
    });

    // 5. Update book quantities based on whether return is within due date
    for (const item of order.books) {
      // First update inTransit using books endpoint
      await axios.patch(
        `${BOOK_SERVICE_URL}/books/${item.bookId}`,
        {
          inTransit: 0  // Clear inTransit
        },
        {
          headers: {
            Authorization: req.headers.authorization,
          },
        }
      );

      if (!isWithinDueDate) {
        // If past due date, update noOfLostBook using book-stocks endpoint
        await axios.patch(
          `${BOOK_SERVICE_URL}/book-stocks/${item.bookId}/noOfLostBook`,
          {
            noOfLostBook: (await getBookCurrentQuantity(item.bookId, req.headers.authorization)).noOfLostBook + item.quantity
          },
          {
            headers: {
              Authorization: req.headers.authorization,
            },
          }
        );
      } else {
        // If within due date, update availableQuantity using book-stocks endpoint
        await axios.patch(
          `${BOOK_SERVICE_URL}/book-stocks/${item.bookId}/availableQuantity`,
          {
            availableQuantity: (await getBookCurrentQuantity(item.bookId, req.headers.authorization)).availableQuantity + item.quantity
          },
          {
            headers: {
              Authorization: req.headers.authorization,
            },
          }
        );
      }
    }

    // 6. If within due date, update student stock profile
    if (isWithinDueDate) {
      const studentProfile = await StudentStockManagementProfile.findOne({
        userId: order.userId,
        subscriptionId: order.subscriptionId,
        status: "ACTIVE",
      });

      if (studentProfile) {
        // Only reduce the booksLimitUtilized by the number of books being returned
        // This preserves the count of other books (like previously lost books)
        studentProfile.booksLimitUtilized = Math.max(0, studentProfile.booksLimitUtilized - order.totalBooksOrdered);
        studentProfile.booksLimitLeft = studentProfile.maxBooksAllowed - studentProfile.booksLimitUtilized;
        await studentProfile.save();
      }
    }
    // If past due date, don't update student profile - keep the books counted as utilized

    // 7. Update order status
    order.status = isWithinDueDate ? "returned" : "lost";
    await order.save();

    res.status(200).json({
      status: "success",
      data: {
        order,
      },
    });
  } catch (error) {
    return next(
      new AppError(
        `Failed to process return: ${error.response?.data?.message || error.message}`,
        error.response?.status || 500
      )
    );
  }
});

// Helper function to get current book quantities
const getBookCurrentQuantity = async (bookId, authToken) => {
  const response = await axios.get(
    `${BOOK_SERVICE_URL}/books/${bookId}`,
    {
      headers: {
        Authorization: authToken,
      },
    }
  );
  return response.data.data.book;
};

// Get all orders
exports.getAllOrders = catchAsync(async (req, res, next) => {
  // Get all orders
  const orders = await Order.find();

  // Get subscription and delivery details for each order
  const ordersWithDetails = await Promise.all(
    orders.map(async (order) => {
      try {
        // Get subscription details
        const subscriptionResponse = await axios.get(
          `${SUBSCRIPTION_SERVICE_URL}/subscriptions/${order.subscriptionId}`,
          {
            headers: {
              Authorization: req.headers.authorization,
            },
          }
        );

        // Get delivery details
        const deliveryResponse = await axios.get(
          `${DELIVERY_SERVICE_URL}/${order._id}/delivery-plans/${order.deliveryId}`,
          {
            headers: {
              Authorization: req.headers.authorization,
            },
          }
        );

        // Convert order to object to make it mutable
        const orderObj = order.toObject();

        // Add subscription and delivery details
        orderObj.subscription = subscriptionResponse.data.data.subscription;
        orderObj.delivery = deliveryResponse.data.data.deliveryPlan;

        return orderObj;
      } catch (error) {
        console.error(`Error fetching details for order ${order._id}:`, error);
        // Return order without additional details if there's an error
        return order;
      }
    })
  );

  res.status(200).json({
    status: "success",
    results: ordersWithDetails.length,
    data: {
      orders: ordersWithDetails,
    },
  });
});

// Get order by ID
exports.getOrder = catchAsync(async (req, res, next) => {
  // Get order
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  try {
    // Get subscription details
    const subscriptionResponse = await axios.get(
      `${SUBSCRIPTION_SERVICE_URL}/subscriptions/${order.subscriptionId}`,
      {
        headers: {
          Authorization: req.headers.authorization,
        },
      }
    );

    // Get delivery details
    const deliveryResponse = await axios.get(
      `${DELIVERY_SERVICE_URL}/${order._id}/delivery-plans/${order.deliveryId}`,
      {
        headers: {
          Authorization: req.headers.authorization,
        },
      }
    );

    // Convert order to object to make it mutable
    const orderObj = order.toObject();

    // Add subscription and delivery details
    orderObj.subscription = subscriptionResponse.data.data.subscription;
    orderObj.delivery = deliveryResponse.data.data.deliveryPlan;

    res.status(200).json({
      status: "success",
      data: {
        order: orderObj,
      },
    });
  } catch (error) {
    return next(
      new AppError(
        `Failed to fetch order details: ${error.response?.data?.message || error.message}`,
        error.response?.status || 500
      )
    );
  }
});
