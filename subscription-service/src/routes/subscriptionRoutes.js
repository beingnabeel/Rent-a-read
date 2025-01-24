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

// Add these new routes
router.post(
  "/subscriptions/initialize",
  validator(subscriptionValidator.initializeSubscriptionSchema),
  subscriptionController.initializeSubscription
);

router.post(
  "/subscriptions/confirm",
  validator(subscriptionValidator.confirmPaymentSchema),
  subscriptionController.confirmSubscription
);

router.patch(
  "/subscriptions/:subscriptionId/cancel",
  subscriptionController.cancelSubscription
);

// router.post(
//   "/webhook",
//   express.raw({ type: "application/json" }),
//   subscriptionController.handleStripeWebhook
// );

// Add new route
router.post(
  "/subscriptions/session/:sessionId",
  validator(subscriptionValidator.getSessionDetailsSchema, "params"),
  subscriptionController.getSessionDetails
);

router.get('/subscriptions/user/:userId', subscriptionController.getSubscriptionByUserId);

router.get(
  "/subscriptions/user/:userId/active",
  subscriptionController.getUserActiveSubscription
);

module.exports = router;
