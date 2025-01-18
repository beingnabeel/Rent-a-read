const Joi = require("joi");
const SchoolLeave = require("../models/schoolLeave");

const baseSchoolLeaveSchema = {
  title: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(500),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
};

const createSchoolLeaveSchema = Joi.object({
  ...baseSchoolLeaveSchema,
}).custom(async (value, helpers) => {
  const { startDate, endDate } = value;

  if (startDate > endDate) {
    return helpers.error("custom.dateRange", {
      message: "Start date must be before or equal to end date",
    });
  }

  return value;
});

const updateSchoolLeaveSchema = Joi.object({
  ...baseSchoolLeaveSchema,
  title: Joi.string().trim().min(2).max(100),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
})
  .min(1)
  .custom(async (value, helpers) => {
    const { startDate, endDate } = value;

    if (startDate && endDate && startDate > endDate) {
      return helpers.error("custom.dateRange", {
        message: "Start date must be before or equal to end date",
      });
    }

    return value;
  });

exports.validateCreateSchoolLeave = async (req, res, next) => {
  try {
    const { id: schoolId } = req.params;
    const validation = await createSchoolLeaveSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    // Check for duplicate title
    const existingLeave = await SchoolLeave.findOne({
      schoolId,
      title: validation.title,
    });
    if (existingLeave) {
      return res.status(400).json({
        status: "fail",
        message: "A leave with this title already exists for this school",
      });
    }

    next();
  } catch (error) {
    if (error.isJoi) {
      const errors = error.details.map((detail) => ({
        field: detail.context.label,
        message: detail.message,
      }));
      return res.status(400).json({
        status: "fail",
        message: "Invalid input data",
        errors,
      });
    }
    next(error);
  }
};

exports.validateUpdateSchoolLeave = async (req, res, next) => {
  try {
    const { id: leaveId } = req.params;
    const validation = await updateSchoolLeaveSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    const existingLeave = await SchoolLeave.findById(leaveId);
    if (!existingLeave) {
      return res.status(404).json({
        status: "fail",
        message: "No leave found with that ID",
      });
    }

    // Check for duplicate title if title is being updated
    if (validation.title && validation.title !== existingLeave.title) {
      const duplicateLeave = await SchoolLeave.findOne({
        schoolId: existingLeave.schoolId,
        title: validation.title,
        _id: { $ne: leaveId },
      });
      if (duplicateLeave) {
        return res.status(400).json({
          status: "fail",
          message: "A leave with this title already exists for this school",
        });
      }
    }

    next();
  } catch (error) {
    if (error.isJoi) {
      const errors = error.details.map((detail) => ({
        field: detail.context.label,
        message: detail.message,
      }));
      return res.status(400).json({
        status: "fail",
        message: "Invalid input data",
        errors,
      });
    }
    next(error);
  }
};
