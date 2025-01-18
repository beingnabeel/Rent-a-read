const express = require("express");
const schoolController = require("../controllers/schoolController");
const schoolValidator = require("../validator/schoolValidator");
const schoolLeaveRouter = require("./schoolLeaveRouter");

const router = express.Router();

router.use("/:schoolId/leaves", schoolLeaveRouter);

router
  .route("/")
  .post(schoolValidator.validateCreateSchool, schoolController.createSchool)
  .get(schoolController.getAllSchools);

router
  .route("/:id")
  .patch(
    // schoolValidator.validateUpdateSchool,
    schoolController.updateSchoolById
  )
  .get(schoolController.getSchoolById);

module.exports = router;
