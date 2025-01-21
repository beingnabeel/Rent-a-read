const Joi = require("joi");

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const SCHOOL_STATUS = ["ACTIVE", "INACTIVE", "SUSPENDED"];
const BOOK_FREQUENCY = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"];

const baseSchoolSchema = {
  name: Joi.string().trim().min(2).max(100),
  branch: Joi.string().trim().min(2).max(50),
  address: Joi.string().trim().min(5).max(200),
  pincode: Joi.string().pattern(/^\d{6}$/),
  weekDay: Joi.string().valid(...WEEK_DAYS),
  isStockManagementAllowed: Joi.boolean(),
  bookFrequency: Joi.string().valid(...BOOK_FREQUENCY),
  numberOfBooksAllowed: Joi.number().min(0).max(100),
  status: Joi.string().valid(...SCHOOL_STATUS),
};

const createSchoolSchema = Joi.object({
  ...baseSchoolSchema,
  name: baseSchoolSchema.name.required(),
  branch: baseSchoolSchema.branch.required(),
  address: baseSchoolSchema.address.required(),
  pincode: baseSchoolSchema.pincode.required(),
  weekDay: baseSchoolSchema.weekDay.required(),
  isStockManagementAllowed:
    baseSchoolSchema.isStockManagementAllowed.default(false),
  status: baseSchoolSchema.status.default("ACTIVE"),
}).custom((value, helpers) => {
  if (value.isStockManagementAllowed) {
    if (!value.bookFrequency) {
      return helpers.message(
        "bookFrequency is required when isStockManagementAllowed is true"
      );
    }
    if (value.numberOfBooksAllowed === undefined) {
      return helpers.message(
        "numberOfBooksAllowed is required when isStockManagementAllowed is true"
      );
    }
  } else {
    if (value.bookFrequency || value.numberOfBooksAllowed !== undefined) {
      return helpers.message(
        "bookFrequency and numberOfBooksAllowed should not be provided when isStockManagementAllowed is false"
      );
    }
  }
  return value;
});

// // const updateSchoolSchema = Joi.object(baseSchoolSchema)
// //   .min(1)
// //   .custom((value, helpers) => {
// //     if (value.isStockManagementAllowed !== undefined) {
// //       if (value.isStockManagementAllowed) {
// //         if (
// //           value.bookFrequency === undefined ||
// //           value.numberOfBooksAllowed === undefined
// //         ) {
// //           return helpers.message(
// //             "When enabling stock management, bookFrequency and numberOfBooksAllowed must be provided"
// //           );
// //         }
// //       } else {
// //         if (
// //           value.bookFrequency !== undefined ||
// //           value.numberOfBooksAllowed !== undefined
// //         ) {
// //           return helpers.message(
// //             "When disabling stock management, bookFrequency and numberOfBooksAllowed should not be provided"
// //           );
// //         }
// //         value.bookFrequency = null;
// //         value.numberOfBooksAllowed = null;
// //       }
// //     } else {
// //       const school = helpers.state.ancestors[0];
// //       if (school.isStockManagementAllowed) {
// //         if (
// //           value.bookFrequency === null ||
// //           value.numberOfBooksAllowed === null
// //         ) {
// //           return helpers.message(
// //             "Cannot remove bookFrequency or numberOfBooksAllowed when stock management is enabled"
// //           );
// //         }
// //       } else {
// //         if (
// //           value.bookFrequency !== undefined ||
// //           value.numberOfBooksAllowed !== undefined
// //         ) {
// //           return helpers.message(
// //             "Cannot add bookFrequency or numberOfBooksAllowed when stock management is disabled"
// //           );
// //         }
// //       }
// //     }
// //     return value;
// //   });
// const updateSchoolSchema = Joi.object(baseSchoolSchema)
//   .min(1)
//   .custom((value, helpers) => {
//     const existingSchool = helpers.state.ancestors[0];

//     if (value.isStockManagementAllowed !== undefined) {
//       if (
//         existingSchool.isStockManagementAllowed &&
//         !value.isStockManagementAllowed
//       ) {
//         return helpers.message(
//           "Cannot disable stock management once it has been enabled"
//         );
//       }

//       if (value.isStockManagementAllowed) {
//         if (
//           value.bookFrequency === undefined &&
//           existingSchool.bookFrequency === undefined
//         ) {
//           return helpers.message(
//             "bookFrequency is required when enabling stock management"
//           );
//         }
//         if (
//           value.numberOfBooksAllowed === undefined &&
//           existingSchool.numberOfBooksAllowed === undefined
//         ) {
//           return helpers.message(
//             "numberOfBooksAllowed is required when enabling stock management"
//           );
//         }
//       } else {
//         if (
//           value.bookFrequency !== undefined ||
//           value.numberOfBooksAllowed !== undefined
//         ) {
//           return helpers.message(
//             "bookFrequency and numberOfBooksAllowed should not be provided when stock management is disabled"
//           );
//         }
//       }
//     } else {
//       if (existingSchool.isStockManagementAllowed) {
//         if (
//           value.bookFrequency === null ||
//           value.numberOfBooksAllowed === null
//         ) {
//           return helpers.message(
//             "Cannot remove bookFrequency or numberOfBooksAllowed when stock management is enabled"
//           );
//         }
//       } else {
//         if (
//           value.bookFrequency !== undefined ||
//           value.numberOfBooksAllowed !== undefined
//         ) {
//           return helpers.message(
//             "Cannot add bookFrequency or numberOfBooksAllowed when stock management is disabled"
//           );
//         }
//       }
//     }
//     return value;
//   });

exports.validateCreateSchool = (req, res, next) => {
  const validation = createSchoolSchema.validate(req.body, {
    abortEarly: false,
  });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));
    return res.status(400).json({
      status: "fail",
      message: "Invalid input data",
      errors,
    });
  }
  next();
};

// exports.validateUpdateSchool = (req, res, next) => {
//   const existingSchool = req.school;
//   const validation = updateSchoolSchema.validate(req.body, {
//     abortEarly: false,
//     context: {
//       school: existingSchool,
//     },
//   });

//   if (validation.error) {
//     const errors = validation.error.details.map((detail) => ({
//       field: detail.path.join("."),
//       message: detail.message,
//     }));
//     return res.status(400).json({
//       status: "fail",
//       message: "Invalid input data",
//       errors,
//     });
//   }
//   next();
// };

// // exports.validateUpdateSchool = (req, res, next) => {
// //   const existingSchool = req.school;
// //   const validation = updateSchoolSchema.validate(req.body, {
// //     abortEarly: false,
// //     context: {
// //       school: existingSchool,
// //     },
// //   });

// //   if (validation.error) {
// //     const errors = validation.error.details.map((detail) => ({
// //       field: detail.path.join("."),
// //       message: detail.message,
// //     }));
// //     return res.status(400).json({
// //       status: "fail",
// //       message: "Invalid input data",
// //       errors,
// //     });
// //   }
// //   next();
// // };
// // const Joi = require("joi");

// // const WEEK_DAYS = [
// //   "MONDAY",
// //   "TUESDAY",
// //   "WEDNESDAY",
// //   "THURSDAY",
// //   "FRIDAY",
// //   "SATURDAY",
// //   "SUNDAY",
// // ];
// // const SCHOOL_STATUS = ["ACTIVE", "INACTIVE", "SUSPENDED"];
// // const BOOK_FREQUENCY = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"];

// // const baseSchoolSchema = {
// //   name: Joi.string().trim().min(2).max(100),
// //   branch: Joi.string().trim().min(2).max(50),
// //   address: Joi.string().trim().min(5).max(200),
// //   pincode: Joi.string().pattern(/^\d{6}$/),
// //   weekDay: Joi.string().valid(...WEEK_DAYS),
// //   isStockManagementAllowed: Joi.boolean(),
// //   bookFrequency: Joi.string().valid(...BOOK_FREQUENCY),
// //   numberOfBooksAllowed: Joi.number().min(0).max(100),
// //   status: Joi.string().valid(...SCHOOL_STATUS),
// // };

// // const createSchoolSchema = Joi.object({
// //   ...baseSchoolSchema,
// //   name: baseSchoolSchema.name.required(),
// //   branch: baseSchoolSchema.branch.required(),
// //   address: baseSchoolSchema.address.required(),
// //   pincode: baseSchoolSchema.pincode.required(),
// //   weekDay: baseSchoolSchema.weekDay.required(),
// //   isStockManagementAllowed:
// //     baseSchoolSchema.isStockManagementAllowed.default(false),
// //   status: baseSchoolSchema.status.default("ACTIVE"),
// // }).custom((value, helpers) => {
// //   if (value.isStockManagementAllowed) {
// //     if (!value.bookFrequency) {
// //       return helpers.error("custom.bookFrequency", {
// //         message:
// //           "bookFrequency is required when isStockManagementAllowed is true",
// //       });
// //     }
// //     if (value.numberOfBooksAllowed === undefined) {
// //       return helpers.error("custom.numberOfBooksAllowed", {
// //         message:
// //           "numberOfBooksAllowed is required when isStockManagementAllowed is true",
// //       });
// //     }
// //   } else {
// //     if (value.bookFrequency || value.numberOfBooksAllowed !== undefined) {
// //       return helpers.error("custom.stockManagement", {
// //         message:
// //           "bookFrequency and numberOfBooksAllowed should not be provided when isStockManagementAllowed is false",
// //       });
// //     }
// //   }
// //   return value;
// // });

const updateSchoolSchema = Joi.object(baseSchoolSchema)
  .min(1)
  .custom((value, helpers) => {
    if (value.isStockManagementAllowed !== undefined) {
      if (value.isStockManagementAllowed) {
        if (
          value.bookFrequency === undefined ||
          value.numberOfBooksAllowed === undefined
        ) {
          return helpers.error("custom.stockManagement", {
            message:
              "When enabling stock management, bookFrequency and numberOfBooksAllowed must be provided",
          });
        }
      } else {
        if (
          value.bookFrequency !== undefined ||
          value.numberOfBooksAllowed !== undefined
        ) {
          return helpers.error("custom.stockManagement", {
            message:
              "When disabling stock management, bookFrequency and numberOfBooksAllowed should not be provided",
          });
        }
        value.bookFrequency = null;
        value.numberOfBooksAllowed = null;
      }
    } else {
      const school = helpers.state.ancestors[0];
      if (school.isStockManagementAllowed) {
        if (
          value.bookFrequency === null ||
          value.numberOfBooksAllowed === null
        ) {
          return helpers.error("custom.stockManagement", {
            message:
              "Cannot remove bookFrequency or numberOfBooksAllowed when stock management is enabled",
          });
        }
      } else {
        if (
          value.bookFrequency !== undefined ||
          value.numberOfBooksAllowed !== undefined
        ) {
          return helpers.error("custom.stockManagement", {
            message:
              "Cannot add bookFrequency or numberOfBooksAllowed when stock management is disabled",
          });
        }
      }
    }
    return value;
  });

// // exports.validateCreateSchool = (req, res, next) => {
// //   const validation = createSchoolSchema.validate(req.body, {
// //     abortEarly: false,
// //   });

// //   if (validation.error) {
// //     const errors = validation.error.details.map((detail) => ({
// //       field: detail.context.label,
// //       message: detail.message,
// //     }));
// //     return res.status(400).json({
// //       status: "fail",
// //       message: "Invalid input data",
// //       errors,
// //     });
// //   }
// //   next();
// // };

exports.validateUpdateSchool = (req, res, next) => {
  const existingSchool = req.school;
  const validation = updateSchoolSchema.validate(req.body, {
    abortEarly: false,
    context: {
      school: existingSchool,
    },
  });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => ({
      field: detail.context.label,
      message: detail.message,
    }));
    return res.status(400).json({
      status: "fail",
      message: "Invalid input data",
      errors,
    });
  }
  next();
};
