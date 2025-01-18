const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { scheduleCartCleanup } = require("./src/services/cronService");
const deliveryPlanRoutes = require("./src/routes/deliveryPlanRoutes");

process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION: 🔥 shutting down...", err);
  console.log(err.name, err.message);
  process.exit(1);
});
dotenv.config({ path: "./config.env" });
const app = require("./app");

const DB = process.env.MONGO_URi;

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((con) => {
    console.log("Connected to the database...");
  });

const port = process.env.PORT || 4005;
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  // Start the cron job
  scheduleCartCleanup();
});

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION:  shutting down...", err);
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  }); // closing the server and exiting the process if an unhandled rejection occurs  // This will prevent the server from running indefinitely
});

app.use("/api/v1/delivery-plans", deliveryPlanRoutes);
