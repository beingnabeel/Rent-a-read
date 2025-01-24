const express = require("express");
const deliveryPlanController = require("../controllers/deliveryPlanController");
const { protect, forwardAuthToken } = require("../middleware/authMiddleware");

const router = express.Router();

// Protect all routes
router.use(protect);
router.use(forwardAuthToken);

// Get active delivery plans for logged in user
router.get("/my-active-plans", deliveryPlanController.getMyActiveDeliveryPlans);

router
  .route("/")
  .post(deliveryPlanController.createDeliveryPlan)
  .get(deliveryPlanController.getAllDeliveryPlans);

router
  .route("/:id")
  .get(deliveryPlanController.getDeliveryPlan)
  .patch(deliveryPlanController.updateDeliveryPlan)
  .delete(deliveryPlanController.deleteDeliveryPlan);

router.get("/user/:userId", deliveryPlanController.getUserDeliveryPlans);

module.exports = router;
