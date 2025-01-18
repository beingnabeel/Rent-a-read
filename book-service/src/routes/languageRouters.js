const express = require("express");

const languageController = require("../controllers/languageController");
const {
  validateCreateLanguage,
  validateUpdateLanguage,
} = require("../validator/languageValidator");

const router = express.Router();

router
  .route("/")
  .get(languageController.getAllLanguages)
  .post(validateCreateLanguage, languageController.createLanguage);

router
  .route("/:id")
  .get(languageController.getLanguagesById)
  .patch(validateUpdateLanguage, languageController.updateLanguage);

module.exports = router;
