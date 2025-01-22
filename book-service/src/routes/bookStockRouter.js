const express = require("express");
const router = express.Router();
const bookStockController = require("../controllers/bookStockController");
const {
  validateQuantityUpdate,
  validateAddBookToSchool,
  validateUpdateSchoolBookTotalQuantity,
  validateUpdateSchoolBookAvailableQuantity,
} = require("../validator/bookStockValidator");
// const { body, param } = require("express-validator");

// Validation middleware
// const validate = (validations) => {
//   return async (req, res, next) => {
//     await Promise.all(validations.map((validation) => validation.run(req)));

//     const errors = validationResult(req);
//     if (errors.isEmpty()) {
//       return next();
//     }

//     return res.status(400).json({ errors: errors.array() });
//   };
// };

// Get School Book Quantity Details
// router.get(
//   "/school/:schoolId/book/:bookId",
//   [param("schoolId").isInt().toInt(), param("bookId").isString()],
//   //   validate,
//   bookStockController.getSchoolBookQuantityDetails
// );

// Add Book to School
// router.post(
//   "/school/add",
//   [
//     body("id").isString(),
//     body("schoolId").isInt().toInt(),
//     body("quantity").isInt().toInt().positive(),
//   ],
//   //   validate,
//   bookStockController.addBookToSchool
// );

// Increment School Book Total
// router.put(
//   "/school/increment",
//   [
//     body("id").isString(),
//     body("schoolId").isInt().toInt(),
//     body("quantity").isInt().toInt().positive(),
//   ],
//   //   validate,
//   bookStockController.incrementSchoolBookTotal
// );

// Update School Book Available Quantity
// router.put(
//   "/school/update-available",
//   [
//     body("schoolId").isInt().toInt(),
//     body("updates").isArray(),
//     body("updates.*.bookId").isString(),
//     body("updates.*.qty").isInt().toInt(),
//   ],
//   //   validate,
//   bookStockController.updateSchoolBookAvailable
// );

// Add these new routes
// router.patch(
//   "/books/:id/totalQuantity",
//   bookStockController.updateTotalQuantity
// );
router
  .route("/:id/totalQuantity")
  .patch(validateQuantityUpdate, bookStockController.updateTotalQuantity);

router
  .route("/:id/availableQuantity")
  .patch(validateQuantityUpdate, bookStockController.updateAvailableQuantity);

// router.patch(
//   "/books/:id/availableQuantity",
//   bookStockController.updateAvailableQuantity
// );

// router.patch("/books/:id/noOfLostBook", bookStockController.updateNoOfLostBook);
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
