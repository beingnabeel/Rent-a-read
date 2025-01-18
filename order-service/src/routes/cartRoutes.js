const express = require("express");
const cartController = require("../controllers/cartController");

const router = express.Router();

router.route("/").post(cartController.createCart);

router
  .route("/:id")
  .get(cartController.getCart)
  .patch(cartController.updateCart)
  .delete(cartController.deleteCart);

router.route("/:id/details").get(cartController.getCartWithDetails);

router.route("/user/:userId/active").get(cartController.getActiveCart);

module.exports = router;
