const express = require("express");
const orderController = require("../controllers/orderController");

const router = express.Router();

router.route("/").post(orderController.createOrder);

router.route("/:id/approve").patch(orderController.approveOrder);

router
  .route("/:id/request-cancellation")
  .patch(orderController.requestCancellation);

router.route("/:id/cancel").patch(orderController.cancelOrder);

router.route("/:id/dispatch").patch(orderController.dispatchOrder);

router.route("/:id/confirm-received").patch(orderController.confirmReceived);

router.route("/:id/return").patch(orderController.returnOrder);

module.exports = router;
