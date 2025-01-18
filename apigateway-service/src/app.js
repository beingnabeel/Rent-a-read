const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const multer = require("multer");
const serviceRoutes = require("./routes/serviceRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Configure multer for file uploads
const upload = multer();

// Middleware
app.use(cors());
app.use(morgan("dev"));

// Body parsing middleware with increased limits
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Debug logging middleware
app.use((req, res, next) => {
  console.log("Request path:", req.path);
  console.log("Content-Type:", req.headers["content-type"]);
  console.log("Content-Length:", req.headers["content-length"]);

  // Log when the response is finished
  res.on("finish", () => {
    console.log("Response finished with status:", res.statusCode);
  });

  next();
});

// Routes
app.use("/api/v1/auth", require("./routes/authRoutes"));
app.use("/", serviceRoutes);

// Error handling
app.use(errorHandler);

module.exports = app;
