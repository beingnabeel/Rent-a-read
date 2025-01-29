const express = require("express");
const subscriptionController = require("../controllers/subscriptionController");
const AppError = require("../utils/appError");
const validator = (schema, source = "body") => {
  return (req, res, next) => {
    const dataToValidate = source === "body" ? req.body : req.params;
    const { error } = schema.validate(dataToValidate, {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(", ");
      return next(new AppError(errorMessage, 400));
    }

    next();
  };
};
const subscriptionValidator = require("../validators/subscriptionValidator");
const planOptionTypeController = require("../controllers/planOptionTypeController");
const planFrequencyTypeController = require("../controllers/planFrequencyTypeController");

const router = express.Router();

// Initialize subscription route
router.post(
  "/subscriptions/initialize",
  validator(subscriptionValidator.initializeSubscriptionSchema),
  subscriptionController.initializeSubscription
);

// Confirm subscription route
router.post(
  "/subscriptions/confirm",
  validator(subscriptionValidator.confirmPaymentSchema),
  subscriptionController.confirmSubscription
);

// Session details route
router.post(
  "/subscriptions/session/:sessionId",
  validator(subscriptionValidator.getSessionDetailsSchema, "params"),
  subscriptionController.getSessionDetails
);

// User-specific routes (me routes should come before :id routes)
router.get(
  "/subscriptions/me/active",
  subscriptionController.getMyActiveSubscription
);
router.get("/subscriptions/me", subscriptionController.getMySubscriptions);
router.get(
  "/subscriptions/user/:userId/active",
  subscriptionController.getUserActiveSubscription
);
router.get(
  "/subscriptions/user/:userId",
  subscriptionController.getSubscriptionByUserId
);

// Cancel subscription route
router.patch(
  "/subscriptions/:subscriptionId/cancel",
  subscriptionController.cancelSubscription
);

// Generic subscription routes
router
  .route("/subscriptions")
  .post(
    validator(subscriptionValidator.createSubscriptionSchema),
    subscriptionController.createSubscription
  )
  .get(subscriptionController.getAllSubscriptions);

router
  .route("/subscriptions/:id")
  .get(subscriptionController.getSubscription)
  .delete(subscriptionController.deleteSubscription);

// Plan Option Type routes
router
  .route("/plan-option-types")
  .post(
    validator(subscriptionValidator.createPlanOptionTypeSchema),
    planOptionTypeController.createPlanOptionType
  )
  .get(planOptionTypeController.getAllPlanOptionTypes);

router
  .route("/plan-option-types/:id")
  .get(planOptionTypeController.getPlanOptionType)
  .patch(
    validator(subscriptionValidator.updatePlanOptionTypeSchema),
    planOptionTypeController.updatePlanOptionType
  )
  .delete(planOptionTypeController.deletePlanOptionType);

// Plan Frequency Type routes
router
  .route("/plan-frequency-types")
  .post(
    validator(subscriptionValidator.createPlanFrequencyTypeSchema),
    planFrequencyTypeController.createPlanFrequencyType
  )
  .get(planFrequencyTypeController.getAllPlanFrequencyTypes);

router
  .route("/plan-frequency-types/:id")
  .get(planFrequencyTypeController.getPlanFrequencyType)
  .patch(
    validator(subscriptionValidator.updatePlanFrequencyTypeSchema),
    planFrequencyTypeController.updatePlanFrequencyType
  )
  .delete(planFrequencyTypeController.deletePlanFrequencyType);

module.exports = router;
