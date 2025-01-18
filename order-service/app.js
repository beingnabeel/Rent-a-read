const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const orderRoutes = require("./src/routes/orderRoutes");
const cartRoutes = require("./src/routes/cartRoutes");
const deliveryPlanRoutes = require("./src/routes/deliveryPlanRoutes");
const globalErrorHandler = require("./src/controllers/errorController");

const app = express();

// Middleware
app.use(morgan("dev"));
app.use(express.json());
app.use(cors());

// Routes
app.use("/api/v1/order-service/orders", orderRoutes);
app.use("/api/v1/order-service/carts", cartRoutes);
app.use("/api/v1/order-service/delivery-plans", deliveryPlanRoutes);

// Error handling
app.use(globalErrorHandler);

module.exports = app;
