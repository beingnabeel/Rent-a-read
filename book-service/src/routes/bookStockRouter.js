const express = require("express");
const router = express.Router();
const bookStockController = require("../controllers/bookStockController");
const {
  validateQuantityUpdate,
  validateAddBookToSchool,
  validateUpdateSchoolBookTotalQuantity,
  validateUpdateSchoolBookAvailableQuantity,
} = require("../validator/bookStockValidator");

router
  .route("/:id/totalQuantity")
  .patch(validateQuantityUpdate, bookStockController.updateTotalQuantity);

router
  .route("/:id/availableQuantity")
  .patch(validateQuantityUpdate, bookStockController.updateAvailableQuantity);


router
  .route("/:id/noOfLostBook")
  .patch(validateQuantityUpdate, bookStockController.updateNoOfLostBook);

// Add this route to your existing routes
router
  .route("/:bookId/schools/:schoolId")
  .post(validateAddBookToSchool, bookStockController.addBookToSchool);

router
  .route("/:bookId/schools/:schoolId/totalQuantity")
  .patch(
    validateUpdateSchoolBookTotalQuantity,
    bookStockController.updateSchoolBookTotalQuantity
  );

router
  .route("/:bookId/schools/:schoolId/availableQuantity")
  .patch(
    validateUpdateSchoolBookAvailableQuantity,
    bookStockController.updateSchoolBookAvailableQuantity
  );

// Add this route with your existing routes
router
  .route("/:bookId/schools/:schoolId/deleteSchoolBook")
  .patch(bookStockController.deleteSchoolBook);

// Add this route with your existing routes
router
  .route("/:bookId/schools/:schoolId")
  .get(bookStockController.getSchoolBookQuantity);

// Add this route with your existing routes
router.route("/schools").get(bookStockController.getAllSchoolBooks);

// Route for updating reserved quantity
router.patch("/books/:id/reserved", bookStockController.updateReservedQuantity);

module.exports = router;
