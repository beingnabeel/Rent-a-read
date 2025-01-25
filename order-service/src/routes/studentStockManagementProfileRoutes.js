const express = require("express");
const studentStockManagementProfileController = require("../controllers/studentStockManagementProfileController");

const router = express.Router();

router
  .route("/")
  .get(studentStockManagementProfileController.getAllProfiles);

router
  .route("/user/:userId")
  .get(studentStockManagementProfileController.getProfileByUserId);

module.exports = router;
