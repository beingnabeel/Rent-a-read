const jwt = require("jsonwebtoken");
const axios = require("axios");

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // Verify token with user-management service using the correct endpoint
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/auth/validate?token=${token}`
    );

    if (!response.data) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Decode token to get user info
    const decoded = jwt.decode(token);
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      permissions: decoded.permissions,
    };

    // Forward token to downstream services
    req.headers["x-auth-token"] = token;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({ message: "Token verification failed" });
  }
};

const authorizeRoles = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Access denied - insufficient role" });
    }
    next();
  };
};

const authorizePermissions = (permissions) => {
  return (req, res, next) => {
    const hasPermissions = permissions.every((p) =>
      req.user.permissions.includes(p)
    );
    if (!hasPermissions) {
      return res
        .status(403)
        .json({ message: "Access denied - insufficient permissions" });
    }
    next();
  };
};

module.exports = {
  verifyToken,
  authorizeRoles,
  authorizePermissions,
};
