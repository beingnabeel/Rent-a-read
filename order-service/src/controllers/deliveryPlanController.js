const DeliveryPlan = require("../models/deliveryPlanModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const APIFeatures = require("../utils/apiFeatures");
const axios = require("axios");

// Configure base URLs for microservices
const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://localhost:8080";
const SUBSCRIPTION_SERVICE_URL =
  process.env.SUBSCRIPTION_SERVICE_URL ||
  "http://localhost:4004/api/v1/subscription-service";

// Helper function to get user details from profile
const getUserFromProfile = async (profileId, authToken) => {
  try {
    // First get the user ID from the profile
    const response = await axios.get(
      `${USER_SERVICE_URL}/users/profiles/${profileId}`,
      {
        headers: {
          Authorization: authToken,
        },
      }
    );

    console.log("Profile response:", JSON.stringify(response.data, null, 2));

    const profile =
      response.data?.data?.profile || response.data?.body || response.data;

    if (!profile) {
      throw new AppError("Profile not found", 404);
    }

    // Ensure we have a userId
    if (!profile.userId) {
      throw new AppError("Profile does not contain a userId", 400);
    }

    return profile;
  } catch (error) {
    console.error(
      "Profile fetch error:",
      error.response?.data || error.message,
      "\nFull error:",
      error
    );
    throw new AppError(
      `Failed to fetch user profile: ${error.response?.data?.message || error.message}`,
      error.response?.status || 500
    );
  }
};

// Helper function to get default address
const getDefaultAddress = async (userId, authToken) => {
  try {
    // Get all addresses for the user
    const response = await axios.get(
      `${USER_SERVICE_URL}/users/${userId}/addresses`,
      {
        headers: {
          Authorization: authToken,
        },
      }
    );

    console.log("Address response:", JSON.stringify(response.data, null, 2));

    // Find the default address from the response data
    const addresses = Array.isArray(response.data)
      ? response.data
      : response.data?.data?.addresses || response.data?.body || [];

    const defaultAddress = addresses.find(
      (addr) => addr.isDefault === true && !addr.isDeleted
    );

    if (!defaultAddress) {
      console.log("Available addresses:", JSON.stringify(addresses, null, 2));
      throw new AppError("No default address found for this user", 404);
    }

    // Concatenate address fields in the required format
    const addressString = `${defaultAddress.house || ""}, ${defaultAddress.landmark || ""}, ${defaultAddress.street || ""}, ${defaultAddress.city || ""}, ${defaultAddress.state || ""}, ${defaultAddress.country || ""} - ${defaultAddress.pincode || ""}`;

    // Remove any double commas from empty fields
    const cleanedAddress = addressString
      .replace(/,\s*,/g, ",")
      .replace(/^,\s*/, "")
      .replace(/,\s*-/, " -");

    return cleanedAddress;
  } catch (error) {
    console.error(
      "Address fetch error:",
      error.response?.data || error.message,
      "\nFull error:",
      error
    );
    throw new AppError(
      `Failed to fetch default address: ${error.response?.data?.message || error.message}`,
      error.response?.status || 500
    );
  }
};

// Helper function to validate subscription
const validateSubscription = async (subscriptionId, userId, authToken) => {
  try {
    const response = await axios.get(
      `${SUBSCRIPTION_SERVICE_URL}/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: authToken,
        },
      }
    );
    const subscription = response.data.data.subscription;

    if (!subscription) {
      throw new AppError("Subscription not found", 404);
    }

    if (subscription.userId.toString() !== userId.toString()) {
      throw new AppError("Subscription does not belong to this user", 403);
    }

    if (subscription.status !== "ACTIVE") {
      throw new AppError("Subscription is not active", 400);
    }

    return subscription;
  } catch (error) {
    throw new AppError(
      `Failed to validate subscription: ${error.response?.data?.message || error.message}`,
      error.response?.status || 500
    );
  }
};

// Create delivery plan
exports.createDeliveryPlan = catchAsync(async (req, res, next) => {
  const { profileId, subscriptionId, deliveryDay, deliveryNotes } = req.body;
  const authToken = req.headers.authorization;

  // Get user profile
  const userProfile = await getUserFromProfile(profileId, authToken);
  if (!userProfile) {
    return next(new AppError("User profile not found", 404));
  }

  // Validate subscription
  await validateSubscription(subscriptionId, userProfile.userId, authToken);

  // Check if user already has an active delivery plan
  const activePlan = await DeliveryPlan.findOne({
    userId: userProfile.userId,
    status: "ACTIVE",
  });

  if (activePlan) {
    return next(new AppError("User already has an active delivery plan", 400));
  }

  // Get default delivery address using userId
  const deliveryAddress = await getDefaultAddress(
    userProfile.userId,
    authToken
  );

  // Create delivery plan with all required fields
  const deliveryPlan = await DeliveryPlan.create({
    userId: userProfile.userId,
    subscriptionId,
    deliveryDay,
    deliveryAddress,
    deliveryNotes,
  });

  res.status(201).json({
    status: "success",
    data: {
      deliveryPlan,
    },
  });
});

// Get all delivery plans
exports.getAllDeliveryPlans = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  let query = DeliveryPlan.find();
  const features = new APIFeatures(query, req.query).filter().search();

  const totalDocuments = await DeliveryPlan.countDocuments(
    features.query.getFilter()
  );

  features.sort().limitFields().paginate();
  const deliveryPlans = await features.query;

  // Fetch subscription details for each delivery plan
  const enrichedDeliveryPlans = await Promise.all(
    deliveryPlans.map(async (plan) => {
      const subscription = await getSubscriptionDetails(plan.subscriptionId);
      const planObj = plan.toObject();
      return {
        ...planObj,
        subscription: subscription || null,
      };
    })
  );

  const totalPages = Math.ceil(totalDocuments / limit);
  const formattedResponse = {
    data: enrichedDeliveryPlans,
    pageNumber: page,
    pageSize: limit,
    totalPages,
    totalDocuments,
    first: page === 1,
    last: page === totalPages,
    numberOfDocuments: deliveryPlans.length,
  };

  res.status(200).json({
    status: "success",
    data: formattedResponse,
  });
});

// Get user's delivery plans
exports.getUserDeliveryPlans = catchAsync(async (req, res, next) => {
  const deliveryPlans = await DeliveryPlan.find({ userId: req.params.userId });

  res.status(200).json({
    status: "success",
    results: deliveryPlans.length,
    data: {
      deliveryPlans,
    },
  });
});

// Update delivery plan
exports.updateDeliveryPlan = catchAsync(async (req, res, next) => {
  const { deliveryDay, deliveryNotes } = req.body;
  const authToken = req.headers.authorization;
  const userId = req.user.userId;

  // First find the delivery plan
  const deliveryPlan = await DeliveryPlan.findById(req.params.id);
  if (!deliveryPlan) {
    return next(new AppError("No delivery plan found with that ID", 404));
  }

  // Verify ownership
  if (deliveryPlan.userId.toString() !== userId) {
    return next(
      new AppError("You are not authorized to update this delivery plan", 403)
    );
  }

  // Validate delivery day if it's being updated
  if (deliveryDay) {
    const validDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    if (!validDays.includes(deliveryDay)) {
      return next(new AppError("Invalid delivery day", 400));
    }
  }

  try {
    // Get current default address
    const deliveryAddress = await getDefaultAddress(userId, authToken);

    // Update delivery plan with new address and other fields
    const updatedDeliveryPlan = await DeliveryPlan.findByIdAndUpdate(
      req.params.id,
      {
        deliveryDay: deliveryDay || deliveryPlan.deliveryDay,
        deliveryNotes: deliveryNotes || deliveryPlan.deliveryNotes,
        deliveryAddress: deliveryAddress, // Always update with current default address
      },
      {
        new: true,
        runValidators: true,
      }
    );

    // Get subscription details
    const subscription = await validateSubscription(
      updatedDeliveryPlan.subscriptionId,
      userId,
      authToken
    );

    res.status(200).json({
      status: "success",
      data: {
        deliveryPlan: {
          ...updatedDeliveryPlan.toObject(),
          subscription,
        },
      },
    });
  } catch (error) {
    return next(new AppError(error.message, error.statusCode || 500));
  }
});

// Delete (soft) delivery plan
exports.deleteDeliveryPlan = catchAsync(async (req, res, next) => {
  const authToken = req.headers.authorization;
  const userId = req.user.userId;

  // Find the delivery plan
  const deliveryPlan = await DeliveryPlan.findById(req.params.id);
  if (!deliveryPlan) {
    return next(new AppError("No delivery plan found with that ID", 404));
  }

  // Verify ownership
  if (deliveryPlan.userId.toString() !== userId) {
    return next(
      new AppError("You are not authorized to delete this delivery plan", 403)
    );
  }

  // Soft delete the delivery plan by setting status to INACTIVE
  deliveryPlan.status = "INACTIVE";
  await deliveryPlan.save();

  res.status(204).json({
    status: "success",
    data: null,
  });
});

// Get active delivery plans for logged in user
exports.getMyActiveDeliveryPlans = catchAsync(async (req, res, next) => {
  // Get userId from the token
  const userId = req.user.userId;
  if (!userId) {
    return next(new AppError("User ID not found in token", 401));
  }

  // Find all active delivery plans for the user
  const deliveryPlans = await DeliveryPlan.find({
    userId: userId,
    status: "ACTIVE",
  }).sort("-createdAt");

  // If no plans found, return empty array
  if (!deliveryPlans || deliveryPlans.length === 0) {
    return res.status(200).json({
      status: "success",
      results: 0,
      data: {
        deliveryPlans: [],
      },
    });
  }

  // Get subscription details for each plan
  const enrichedDeliveryPlans = await Promise.all(
    deliveryPlans.map(async (plan) => {
      try {
        // Get subscription details
        const subscription = await validateSubscription(
          plan.subscriptionId,
          userId,
          req.headers.authorization
        );

        const planObj = plan.toObject();
        return {
          ...planObj,
          subscription,
        };
      } catch (error) {
        console.error(
          `Error fetching subscription for plan ${plan._id}:`,
          error
        );
        // Return plan without subscription details if there's an error
        return plan.toObject();
      }
    })
  );

  res.status(200).json({
    status: "success",
    results: enrichedDeliveryPlans.length,
    data: {
      deliveryPlans: enrichedDeliveryPlans,
    },
  });
});
