const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const axios = require("axios");

const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://localhost:8080";

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Get token from header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Authentication token is missing", 401));
  }

  const token = authHeader.split(" ")[1];

  try {
    // 2) Validate token with user service
    const response = await axios.get(
      `${USER_SERVICE_URL}/auth/validate?token=${token}`
    );

    if (!response.data) {
      return next(new AppError("Invalid token", 401));
    }

    // 3) Set user info from decoded token
    const decoded = jwt.decode(token);
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      permissions: decoded.permissions,
    };
    next();
  } catch (error) {
    return next(
      new AppError(
        "Authentication failed: " +
          (error.response?.data?.message || error.message),
        401
      )
    );
  }
});

// Middleware to forward auth token to other services
exports.forwardAuthToken = catchAsync(async (req, res, next) => {
  if (req.headers.authorization) {
    axios.defaults.headers.common["Authorization"] = req.headers.authorization;
  }
  next();
});
