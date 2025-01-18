const Joi = require("joi");

exports.createOrderSchema = Joi.object({
  subscriptionId: Joi.string().required(),
  cartId: Joi.string().required(),
  deliveryId: Joi.string().required(),
});

exports.updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid("pending", "approved", "cancelled", "dispatched", "returned", "lost")
    .required(),
});
