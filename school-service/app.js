const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const AppError = require("./src/utils/appError");
const globalErrorHandler = require("./src/controllers/errorController");
const schoolRouter = require("./src/routes/schoolRouter");
const schoolEnquiryRouter = require("./src/routes/schoolEnquiryRouter");

const app = express();
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

const corsOptions = {
  origin: "http://localhost:3000",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: "10kb" }));
app.use("/api/v1/schools-service/schools/enquiry", schoolEnquiryRouter);
app.use("/api/v1/schools-service/schools", schoolRouter);

app.use((req, res, next) => {
  console.log(`Hello from the middleware!`);
  next();
});

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
