const express = require("express");
const couponController = require("../controllers/couponController");
const validator = require("../middleware/validator");
const couponValidator = require("../validators/couponValidator");

const router = express.Router();

router
  .route("/")
  .post(
    validator(couponValidator.createCouponSchema),
    couponController.createCoupon
  )
  .get(couponController.getAllCoupons);

router
  .route("/:id")
  .get(couponController.getCoupon)
  .delete(couponController.deleteCoupon);

module.exports = router;
