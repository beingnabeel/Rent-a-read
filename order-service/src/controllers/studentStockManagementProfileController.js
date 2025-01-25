const StudentStockManagementProfile = require("../models/studentStockManagementProfile");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const axios = require("axios");

const SUBSCRIPTION_SERVICE_URL =
  process.env.SUBSCRIPTION_SERVICE_URL ||
  "http://localhost:4004/api/v1/subscription-service";

// Get all student stock management profiles
exports.getAllProfiles = catchAsync(async (req, res, next) => {
  const profiles = await StudentStockManagementProfile.find()
    .sort({ createdAt: -1 }); // Sort by creation date, newest first

  res.status(200).json({
    status: "success",
    results: profiles.length,
    data: {
      profiles,
    },
  });
});

// Get student stock management profile by userId
exports.getProfileByUserId = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  // Find all profiles for the user
  const profiles = await StudentStockManagementProfile.find({ userId })
    .sort({ createdAt: -1 }); // Sort by creation date, newest first

  if (!profiles || profiles.length === 0) {
    return next(new AppError("No profiles found for this user", 404));
  }

  // Get subscription details for each profile
  const profilesWithDetails = await Promise.all(
    profiles.map(async (profile) => {
      const profileObj = profile.toObject();

      try {
        const subscriptionResponse = await axios.get(
          `${SUBSCRIPTION_SERVICE_URL}/subscriptions/${profile.subscriptionId}`,
          {
            headers: {
              Authorization: req.headers.authorization,
            },
          }
        );
        profileObj.subscription = subscriptionResponse.data.data.subscription;
      } catch (error) {
        console.error("Error fetching subscription details:", error);
        profileObj.subscription = null;
      }

      return profileObj;
    })
  );

  res.status(200).json({
    status: "success",
    results: profilesWithDetails.length,
    data: {
      profiles: profilesWithDetails,
    },
  });
});
