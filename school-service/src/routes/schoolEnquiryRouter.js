const express = require("express");
const schoolEnquiryController = require("../controllers/schoolEnquiryController");
const validateSchoolEnquiry = require("../validator/schoolEnquiryValidator");

const router = express.Router();

router
  .route("/")
  .get(schoolEnquiryController.getAllSchoolEnquiries)
  .post(validateSchoolEnquiry, schoolEnquiryController.createSchoolEnquiry);

module.exports = router;
