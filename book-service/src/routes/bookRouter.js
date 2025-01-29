const express = require("express");
const bookController = require("../controllers/bookController");
const multerS3Uploader = require("../utils/multerConfig");
const {
  validateCreateBook,
  validateUpdateBook,
} = require("../validator/bookValidator");

const router = express.Router();

const setResourceType = (req, res, next) => {
  req.resourceType = "book";
  next();
};

router
  .route("/")
  .get(bookController.getAllBooks)
  .post(
    setResourceType,
    multerS3Uploader.single("image"),
    validateCreateBook,
    bookController.createBook
  );

router
  .route("/latest")
  .get(bookController.aliasLatestBooks, bookController.getAllBooks);
router
  .route("/top-pick")
  .get(bookController.topPickBooks, bookController.getAllBooks);
router
  .route("/just-pick")
  .get(bookController.justPickBooks, bookController.getAllBooks);

router.route("/:id").get(bookController.getBookById).patch(
  setResourceType,
  multerS3Uploader.single("image"),
  validateUpdateBook, // Add this middleware
  bookController.updateBook
);

router.route("/export/csv").get(bookController.exportCsvTemplate);

router.route("/:id/quantities").patch(bookController.updateBookQuantities);

module.exports = router;
