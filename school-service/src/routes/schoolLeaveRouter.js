const express = require("express");
const schoolLeaveController = require("../controllers/schoolLeaveController");
const schoolLeaveValidator = require("../validator/schoolLeaveValidator");

const router = express.Router({ mergeParams: true });

// the route structure will be like
// /api/v1/school-service/schools/:schoolId/leaves/
router
  .route("/")
  .post(
    schoolLeaveValidator.validateCreateSchoolLeave,
    schoolLeaveController.createSchoolLeave
  )
  .get(schoolLeaveController.getAllSchoolLeaves);

router
  .route("/:id")
  .get(schoolLeaveController.getSchoolLeaveById)
  .patch(
    schoolLeaveValidator.validateUpdateSchoolLeave,
    schoolLeaveController.updateSchoolLeave
  )
  .delete(schoolLeaveController.deleteSchoolLeave);

module.exports = router;
