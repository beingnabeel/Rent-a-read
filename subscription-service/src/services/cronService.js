const cron = require("node-cron");
const Subscription = require("../models/subscription");

// Function to update subscription statuses
const updateSubscriptionStatuses = async () => {
  try {
    const currentDate = new Date();
    console.log(`Running subscription status update at ${currentDate}`);

    // Update expired subscriptions (endDate < currentDate)
    const expiredSubscriptions = await Subscription.updateMany(
      {
        status: "ACTIVE",
        endDate: { $lt: currentDate },
        paymentStatus: { $in: ["succeeded", "paid"] },
      },
      {
        $set: { status: "EXPIRED" },
      }
    );

    // Log the results
    console.log(
      `Updated ${expiredSubscriptions.modifiedCount} subscriptions to EXPIRED status`
    );

    // For debugging purposes, log the affected subscription IDs
    if (expiredSubscriptions.modifiedCount > 0) {
      const affectedSubscriptions = await Subscription.find({
        status: "EXPIRED",
        updatedAt: { $gte: new Date(Date.now() - 1000 * 60) }, // Updated in the last minute
      }).select("_id userId endDate");

      console.log(
        "Affected subscriptions:",
        JSON.stringify(affectedSubscriptions, null, 2)
      );
    }
  } catch (error) {
    console.error("Error updating subscription statuses:", error);
  }
};

// Schedule cron job to run every day at midnight
const initSubscriptionStatusCron = () => {
  // Run immediately when the service starts
  updateSubscriptionStatuses();

  // Schedule to run every day at midnight
  cron.schedule("0 0 * * *", async () => {
    console.log("Running scheduled subscription status update cron job...");
    await updateSubscriptionStatuses();
  });

  // Also run every hour as a safeguard
  cron.schedule("0 * * * *", async () => {
    console.log("Running hourly subscription status check...");
    await updateSubscriptionStatuses();
  });
};

module.exports = {
  initSubscriptionStatusCron,
  updateSubscriptionStatuses, // Exported for testing purposes
};
