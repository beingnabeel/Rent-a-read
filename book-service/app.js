const express = require("express");
const morgan = require("morgan");
const AppError = require("./src/utils/appError");
const globalErrorHandler = require("./src/controllers/errorController");
const { requestLogger, errorLogger } = require("./src/utils/logger");
const bookRouter = require("./src/routes/bookRouter");
const languageRouter = require("./src/routes/languageRouters");
const ParentCategoryRouter = require("./src/routes/parentCategoryRouter");
const categoryRouter = require("./src/routes/categoryRouter");
const bookStockRouter = require("./src/routes/bookStockRouter");

const app = express();

// Add request logging middleware
app.use(requestLogger);

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use(express.json({ limit: "10kb" }));

// FOR BOOKS MANAGEMENT
app.use("/api/v1/books-service/books", bookRouter);
app.use("/api/v1/books-service/languages", languageRouter);
app.use("/api/v1/books-service/parent-categories", ParentCategoryRouter);
app.use("/api/v1/books-service/categories", categoryRouter);

//FOR BOOK STOCK MANAGEMENT
app.use("/api/v1/books-service/book-stocks", bookStockRouter);
app.use((req, res, next) => {
  console.log(`Hello from the middleware!`);
  next();
});

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Add error logging middleware before global error handler
app.use(errorLogger);
app.use(globalErrorHandler);

module.exports = app;
