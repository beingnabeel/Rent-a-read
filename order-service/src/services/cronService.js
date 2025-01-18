const cron = require("node-cron");
const Cart = require("../models/cartModel");
const logger = require("../utils/logger");

// Run every minute
const scheduleCartCleanup = () => {
  cron.schedule("* * * * *", async () => {
    try {
      logger.info("Running cart cleanup cron job");

      // Get current time in IST
      const currentDate = new Date();
      currentDate.setHours(currentDate.getHours() + 5);
      currentDate.setMinutes(currentDate.getMinutes() + 30);

      const expiredCarts = await Cart.find({
        status: "ACTIVE",
        expiryTime: { $lt: currentDate },
      });

      for (const cart of expiredCarts) {
        cart.status = "abandoned";
        await cart.save();
        logger.info(
          `Cart ${cart._id} marked as abandoned at ${currentDate.toISOString()} IST`
        );
      }

      logger.info(`Cleaned up ${expiredCarts.length} expired carts`);
    } catch (error) {
      logger.error("Error in cart cleanup cron job:", error);
    }
  });
};

module.exports = {
  scheduleCartCleanup,
};
