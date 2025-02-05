const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const orderRoutes = require("./src/routes/orderRoutes");
const cartRoutes = require("./src/routes/cartRoutes");
const deliveryPlanRoutes = require("./src/routes/deliveryPlanRoutes");
const globalErrorHandler = require("./src/controllers/errorController");
const studentStockManagementProfileRouter = require("./src/routes/studentStockManagementProfileRoutes");

const app = express();

// Middleware
app.use(morgan("dev"));
app.use(express.json());
const corsOptions = {
  origin: "http://localhost:3000",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Routes
app.use("/api/v1/order-service/orders", orderRoutes);
app.use("/api/v1/order-service/carts", cartRoutes);
app.use("/api/v1/order-service/delivery-plans", deliveryPlanRoutes);
app.use(
  "/api/v1/order-service/student-stock-management-profiles",
  studentStockManagementProfileRouter
);

// Error handling
app.use(globalErrorHandler);

module.exports = app;
