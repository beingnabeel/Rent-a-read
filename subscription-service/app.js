const cors = require("cors");
const express = require("express");
const morgan = require("morgan");
const AppError = require("./src/utils/appError");
const globalErrorHandler = require("./src/controllers/errorController");
const subscriptionController = require("./src/controllers/subscriptionController");
const couponRoutes = require("./src/routes/couponRoutes");
const promotionCodeRoutes = require("./src/routes/promotionCodeRoutes");

const app = express();

// Webhook endpoint needs raw body parsing - MUST be before other middleware
app.post(
  "/api/v1/subscription-service/webhook",
  express.raw({ type: "application/json" }),
  subscriptionController.handleStripeWebhook
);

// Regular middleware for other routes
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use(express.json({ limit: "10kb" }));
const corsOptions = {
  origin: "http://localhost:3000",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Other routes
const subscriptionRoutes = require("./src/routes/subscriptionRoutes");
app.use("/api/v1/subscription-service", subscriptionRoutes);
app.use("/api/v1/subscription-service/coupons", couponRoutes);
app.use("/api/v1/subscription-service/promotion-codes", promotionCodeRoutes);

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
