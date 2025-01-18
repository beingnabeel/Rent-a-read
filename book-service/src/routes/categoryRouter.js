const express = require("express");
const categoryController = require("../controllers/categoryController");
const {
  validateCreateCategory,
  validateUpdateCategory,
} = require("../validator/categoryValidator");

const router = express.Router();

router
  .route("/")
  .get(categoryController.getAllCategories)
  .post(validateCreateCategory, categoryController.createCategory);

//   router.get('/parent/:parentId', categoryController.getCategoriesByParent);
router
  .route("/parent-categories/:parentId")
  .get(categoryController.getCategoriesByParent);

router
  .route("/:id")
  .get(categoryController.getCategoryById)
  .patch(validateUpdateCategory, categoryController.updateCategory);

module.exports = router;
