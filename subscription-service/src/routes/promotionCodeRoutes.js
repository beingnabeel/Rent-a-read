const express = require("express");
const promotionCodeController = require("../controllers/promotionCodeController");
const validator = require("../middleware/validator");
const promotionCodeValidator = require("../validators/promotionCodeValidator");

const router = express.Router();

router
  .route("/")
  .post(
    validator(promotionCodeValidator.createPromotionCodeSchema),
    promotionCodeController.createPromotionCode
  )
  .get(promotionCodeController.getAllPromotionCodes);

router
  .route("/:id")
  .get(promotionCodeController.getPromotionCode)
  .patch(
    validator(promotionCodeValidator.updatePromotionCodeSchema),
    promotionCodeController.updatePromotionCode
  );

module.exports = router;
