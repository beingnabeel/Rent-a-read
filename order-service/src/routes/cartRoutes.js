const express = require("express");
const cartController = require("../controllers/cartController");

const router = express.Router();

router.post("/", cartController.createCart);
router.get("/:id", cartController.getCart);
router.patch("/:id", cartController.updateCart);
router.delete("/:id", cartController.abandonCart);
router.get("/:id/details", cartController.getCartWithDetails);
router.get("/user/:userId/active", cartController.getActiveCart);

module.exports = router;
