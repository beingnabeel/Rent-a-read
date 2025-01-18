const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
const result = dotenv.config({ path: path.join(__dirname, "config.env") });
if (result.error) {
  console.error("Error loading .env file:", result.error);
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  console.log("Request Headers:", req.headers);
  console.log("Request Body:", req.body);
  next();
});

// Routes
app.use("/api/v1/auth", require("./src/routes/authRoutes"));
app.use("/", require("./src/routes/serviceRoutes"));

// Error handling
app.use(require("./src/middleware/errorHandler"));

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log("Environment Variables:", {
    USER_SERVICE_URL: process.env.USER_SERVICE_URL,
    BOOKS_SERVICE_URL: process.env.BOOKS_SERVICE_URL,
    ORDER_SERVICE_URL: process.env.ORDER_SERVICE_URL,
    SCHOOL_SERVICE_URL: process.env.SCHOOL_SERVICE_URL,
    SUBSCRIPTION_SERVICE_URL: process.env.SUBSCRIPTION_SERVICE_URL,
  });
});

// Increase server timeout to handle large file uploads
server.timeout = 120000; // 2 minutes
