const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);

  if (err.response) {
    // Forward error from microservices
    return res.status(err.response.status).json(err.response.data);
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      message: "Token has expired",
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      message: "Invalid token",
    });
  }

  res.status(500).json({
    message: "Internal server error",
  });
};

module.exports = errorHandler;
