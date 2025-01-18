const express = require("express");

const parentCategoryController = require("../controllers/parentCategoryController");
const multerS3Uploader = require("../utils/multerConfig");
const {
  validateCreateParentCategory,
  validateUpdateParentCategory,
} = require("../validator/parentCategoryValidator");

const router = express.Router();

// Middleware to set the resource type
const setResourceType = (req, res, next) => {
  req.resourceType = "parentCategory";
  next();
};

router
  .route("/")
  .get(parentCategoryController.getAllParentCategories)
  .post(
    setResourceType,
    multerS3Uploader.single("image"),
    validateCreateParentCategory,
    parentCategoryController.createParentCategory
  );
router
  .route("/categories")
  .get(parentCategoryController.getAllParentCategoriesWithCategories);
router
  .route("/ACTIVE")
  .get(parentCategoryController.getAllActiveParentCategories);

router
  .route("/:id")
  .get(parentCategoryController.getParentCategoryById)
  .patch(
    setResourceType,
    multerS3Uploader.single("image"),
    validateUpdateParentCategory,
    parentCategoryController.updateParentCategory
  );

module.exports = router;
