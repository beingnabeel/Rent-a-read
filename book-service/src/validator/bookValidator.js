const Joi = require("joi");
const AppError = require("../utils/appError");
const { deleteImage } = require("../utils/s3Upload");
const Book = require("../models/bookModel");

const createBookSchema = Joi.object({
  title: Joi.string().trim().min(1).max(100).required().messages({
    "string.base": "Title must be a string",
    "string.empty": "Title is required",
    "string.min": "Title must be at least 1 character long",
    "string.max": "Title cannot exceed 100 characters",
    "any.required": "Title is required",
  }),
  description: Joi.string().trim().max(1000).required().messages({
    "string.base": "Description must be a string",
    "string.empty": "Description is required",
    "string.max": "Description cannot exceed 1000 characters",
    "any.required": "Description is required",
  }),
  categoryIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1)
    .required()
    .messages({
      "array.base": "Category IDs must be an array",
      "array.min": "At least one category ID is required",
      "string.hex": "Category ID must be a valid hexadecimal string",
      "string.length": "Category ID must be 24 characters long",
      "any.required": "Category IDs are required",
    }),
  paperType: Joi.string()
    .valid("Hardcover", "Paperback", "E-book")
    .required()
    .messages({
      "string.base": "Paper type must be a string",
      "any.only": "Paper type must be either Hardcover, Paperback, or E-book",
      "any.required": "Paper type is required",
    }),
  author: Joi.string().trim().max(100).required().messages({
    "string.base": "Author must be a string",
    "string.empty": "Author is required",
    "string.max": "Author name cannot exceed 100 characters",
    "any.required": "Author is required",
  }),
  publisher: Joi.string().trim().max(100).required().messages({
    "string.base": "Publisher must be a string",
    "string.empty": "Publisher is required",
    "string.max": "Publisher name cannot exceed 100 characters",
    "any.required": "Publisher is required",
  }),
  isbn: Joi.string()
    .pattern(/^(?=(?:\D*\d){10}(?:(?:\D*\d){3})?$)[\d-]+$/)
    .required()
    .messages({
      "string.base": "ISBN must be a string",
      "string.pattern.base": "ISBN must be a valid ISBN-10 or ISBN-13 format",
      "any.required": "ISBN is required",
    }),
  languageId: Joi.string().hex().length(24).required().messages({
    "string.base": "Language ID must be a string",
    "string.hex": "Language ID must be a valid hexadecimal string",
    "string.length": "Language ID must be 24 characters long",
    "any.required": "Language ID is required",
  }),
  series: Joi.string().trim().max(100).allow("").messages({
    "string.base": "Series must be a string",
    "string.max": "Series name cannot exceed 100 characters",
  }),
  shelfId: Joi.string().trim().required().messages({
    "string.base": "Shelf ID must be a string",
    "string.empty": "Shelf ID is required",
    "any.required": "Shelf ID is required",
  }),
  imageUrls: Joi.array().items(Joi.string().uri()).messages({
    "array.base": "Image URLs must be an array",
    "string.uri": "Image URL must be a valid URI",
  }),
  googleUrl: Joi.string().uri().allow("").messages({
    "string.base": "Google URL must be a string",
    "string.uri": "Google URL must be a valid URI",
  }),
  status: Joi.string().valid("ACTIVE", "INACTIVE").default("ACTIVE").messages({
    "any.only": "Status must be either ACTIVE or INACTIVE",
  }),
  minAge: Joi.number().min(0).max(100).required().messages({
    "number.base": "Minimum age must be a number",
    "number.min": "Minimum age cannot be less than 0",
    "number.max": "Minimum age cannot be more than 100",
    "any.required": "Minimum age is required",
  }),
  maxAge: Joi.number().min(0).max(100).required().messages({
    "number.base": "Maximum age must be a number",
    "number.min": "Maximum age cannot be less than 0",
    "number.max": "Maximum age cannot be more than 100",
    "any.required": "Maximum age is required",
  }),
  totalQuantity: Joi.number().min(0).required().messages({
    "number.base": "Total quantity must be a number",
    "number.min": "Total quantity cannot be negative",
    "any.required": "Total quantity is required",
  }),
  availableQuantity: Joi.number().min(0).required().messages({
    "number.base": "Available quantity must be a number",
    "number.min": "Available quantity cannot be negative",
    "any.required": "Available quantity is required",
  }),
  noOfLostBook: Joi.number().min(0).default(0).messages({
    "number.base": "Number of lost books must be a number",
    "number.min": "Number of lost books cannot be negative",
  }),
  reserved: Joi.number().min(0).default(0).messages({
    "number.base": "Reserved quantity must be a number",
    "number.min": "Reserved quantity cannot be negative",
  }),
  inTransit: Joi.number().min(0).default(0).messages({
    "number.base": "In-transit quantity must be a number",
    "number.min": "In-transit quantity cannot be negative",
  }),
});

const updateBookSchema = Joi.object({
  title: Joi.string().trim().min(1).max(100).messages({
    "string.base": "Title must be a string",
    "string.empty": "Title is required",
    "string.min": "Title must be at least 1 character long",
    "string.max": "Title cannot exceed 100 characters",
  }),
  description: Joi.string().trim().max(1000).messages({
    "string.base": "Description must be a string",
    "string.max": "Description cannot exceed 1000 characters",
  }),
  categoryIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1)
    .messages({
      "array.base": "Category IDs must be an array",
      "array.min": "At least one category ID is required",
      "string.hex": "Category ID must be a valid hexadecimal string",
      "string.length": "Category ID must be 24 characters long",
    }),
  paperType: Joi.string().valid("Hardcover", "Paperback", "E-book").messages({
    "string.base": "Paper type must be a string",
    "any.only": "Paper type must be either Hardcover, Paperback, or E-book",
  }),
  author: Joi.string().trim().max(100).messages({
    "string.base": "Author must be a string",
    "string.empty": "Author is required",
    "string.max": "Author name cannot exceed 100 characters",
  }),
  publisher: Joi.string().trim().max(100).messages({
    "string.base": "Publisher must be a string",
    "string.empty": "Publisher is required",
    "string.max": "Publisher name cannot exceed 100 characters",
  }),
  isbn: Joi.string()
    .pattern(/^(?=(?:\D*\d){10}(?:(?:\D*\d){3})?$)[\d-]+$/)
    .messages({
      "string.base": "ISBN must be a string",
      "string.pattern.base": "ISBN must be a valid ISBN-10 or ISBN-13 format",
    }),
  languageId: Joi.string().hex().length(24).messages({
    "string.base": "Language ID must be a string",
    "string.hex": "Language ID must be a valid hexadecimal string",
    "string.length": "Language ID must be 24 characters long",
  }),
  series: Joi.string().trim().max(100).allow("").messages({
    "string.base": "Series must be a string",
    "string.max": "Series name cannot exceed 100 characters",
  }),
  shelfId: Joi.string().trim().messages({
    "string.base": "Shelf ID must be a string",
    "string.empty": "Shelf ID is required",
  }),
  imageUrls: Joi.array().items(Joi.string().uri()).messages({
    "array.base": "Image URLs must be an array",
    "string.uri": "Image URL must be a valid URI",
  }),
  googleUrl: Joi.string().uri().allow("").messages({
    "string.base": "Google URL must be a string",
    "string.uri": "Google URL must be a valid URI",
  }),
  status: Joi.string().valid("ACTIVE", "INACTIVE").default("ACTIVE").messages({
    "any.only": "Status must be either ACTIVE or INACTIVE",
  }),
  minAge: Joi.number().min(0).max(100).messages({
    "number.base": "Minimum age must be a number",
    "number.min": "Minimum age cannot be less than 0",
    "number.max": "Minimum age cannot be more than 100",
  }),
  maxAge: Joi.number().min(0).max(100).messages({
    "number.base": "Maximum age must be a number",
    "number.min": "Maximum age cannot be less than 0",
    "number.max": "Maximum age cannot be more than 100",
  }),
}).min(1);

exports.validateCreateBook = async (req, res, next) => {
  try {
    console.log("Request body before parsing: ", req.body);
    const body = req.body || {};
    // Parse categoryIds if it's a string
    let categoryIds = body.categoryIds;
    if (typeof categoryIds === "string") {
      try {
        categoryIds = categoryIds
          .replace(/[\[\]]/g, "")
          .split(",")
          .map((id) => id.trim());
      } catch (err) {
        console.error("Error parsing categoryIds:", err);
        categoryIds = [];
      }
    }

    // Here we are using parseInt for properly number parsing
    const totalQuantity = parseInt(body.totalQuantity, 10);
    const availableQuantity = parseInt(body.availableQuantity, 10);
    const noOfLostBook = parseInt(body.noOfLostBook || 0, 10);
    const reserved = parseInt(body.reserved || 0, 10);
    const inTransit = parseInt(body.inTransit || 0, 10);
    const minAge = parseInt(body.minAge, 10);
    const maxAge = parseInt(body.maxAge, 10);

    // Log parsed values for debugging
    console.log("Parsed values:", {
      totalQuantity,
      availableQuantity,
      noOfLostBook,
      reserved,
      inTransit,
      sum: availableQuantity + noOfLostBook + reserved + inTransit,
    });

    // Validate total quantity equals sum of all quantity types
    if (
      totalQuantity !==
      availableQuantity + noOfLostBook + reserved + inTransit
    ) {
      if (req.file) {
        await deleteImage(req.file.key);
      }
      return res.status(400).json({
        status: "fail",
        message: `Total quantity (${totalQuantity}) must equal sum of available (${availableQuantity}), lost (${noOfLostBook}), reserved (${reserved}), and in-transit (${inTransit}) quantities. Current sum: ${availableQuantity + noOfLostBook + reserved + inTransit}`,
      });
    }

    const { error, value } = createBookSchema.validate(
      {
        title: body.title,
        description: body.description,
        categoryIds: categoryIds,
        paperType: body.paperType,
        author: body.author,
        publisher: body.publisher,
        isbn: body.isbn,
        languageId: body.languageId,
        series: body.series,
        shelfId: body.shelfId,
        imageUrls: body.imageUrls,
        googleUrl: body.googleUrl,
        status: body.status,
        minAge: minAge,
        maxAge: maxAge,
        totalQuantity: totalQuantity,
        availableQuantity: availableQuantity,
        noOfLostBook: noOfLostBook,
        reserved: reserved,
        inTransit: inTransit,
      },
      { abortEarly: false }
    );

    if (error) {
      if (req.file) {
        await deleteImage(req.file.key);
      }
      const errors = error.details.map((detail) => ({
        field: detail.context.key,
        message: detail.message,
      }));
      return res.status(400).json({
        status: "fail",
        message: "Validation failed",
        errors,
      });
    }

    // Check for existing book
    const existingBook = await Book.findOne({ isbn: body.isbn });
    if (existingBook) {
      if (req.file) {
        await deleteImage(req.file.key);
      }
      return res.status(400).json({
        status: "fail",
        message: "Book with the same ISBN already exists",
      });
    }

    if (maxAge < minAge) {
      if (req.file) {
        await deleteImage(req.file.key);
      }
      return res.status(400).json({
        status: "fail",
        message: "Max age must be greater than or equal to min age",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: "fail",
        message: "Image file is required",
      });
    }

    // Add parsed values to req.body to ensure they're used in the controller
    req.body.totalQuantity = totalQuantity;
    req.body.availableQuantity = availableQuantity;
    req.body.noOfLostBook = noOfLostBook;
    req.body.reserved = reserved;
    req.body.inTransit = inTransit;
    req.body.minAge = minAge;
    req.body.maxAge = maxAge;
    req.body.categoryIds = categoryIds;

    req.validatedBody = value;
    next();
  } catch (error) {
    console.error("Validation error:", error);
    if (req.file) {
      await deleteImage(req.file.key);
    }
    next(error);
  }
};

exports.validateUpdateBook = async (req, res, next) => {
  try {
    console.log("Request body before parsing: ", req.body);
    const body = req.body || {};

    // Check if any quantity-related fields are being updated
    if (
      body.totalQuantity !== undefined ||
      body.availableQuantity !== undefined ||
      body.noOfLostBook !== undefined
    ) {
      if (req.file) {
        await deleteImage(req.file.key);
      }
      return res.status(400).json({
        status: "fail",
        message:
          "Quantity updates must be done through the dedicated stock management endpoints: " +
          "/api/v1/books-service/stock/:id/totalQuantity, " +
          "/api/v1/books-service/stock/:id/availableQuantity, or " +
          "/api/v1/books-service/stock/:id/noOfLostBook",
      });
    }

    // Find existing book
    const existingBook = await Book.findById(req.params.id);
    if (!existingBook) {
      if (req.file) {
        await deleteImage(req.file.key);
      }
      return res.status(404).json({
        status: "fail",
        message: "Book not found",
      });
    }

    // Check for duplicate ISBN if ISBN is being updated
    if (body.isbn) {
      const duplicateBook = await Book.findOne({
        isbn: body.isbn,
        _id: { $ne: req.params.id },
      });

      if (duplicateBook) {
        if (req.file) {
          await deleteImage(req.file.key);
        }
        return res.status(400).json({
          status: "fail",
          message: "Book with this ISBN already exists",
        });
      }
    }

    // Parse numbers, using existing values if not provided
    // Handle both string and number inputs for minAge and maxAge
    let minAge = existingBook.minAge;
    let maxAge = existingBook.maxAge;

    if (body.minAge !== undefined) {
      // Remove quotes if present and parse
      minAge = parseInt(body.minAge.toString().replace(/['"]+/g, ""), 10);
      if (isNaN(minAge)) {
        throw new Error("Invalid minAge value");
      }
    }

    if (body.maxAge !== undefined) {
      // Remove quotes if present and parse
      maxAge = parseInt(body.maxAge.toString().replace(/['"]+/g, ""), 10);
      if (isNaN(maxAge)) {
        throw new Error("Invalid maxAge value");
      }
    }

    // Validate age range if either age is being updated
    if (body.minAge !== undefined || body.maxAge !== undefined) {
      console.log("Validating age range:", { minAge, maxAge });
      if (minAge > maxAge) {
        if (req.file) {
          await deleteImage(req.file.key);
        }
        return res.status(400).json({
          status: "fail",
          message: "Maximum age must be greater than or equal to minimum age",
        });
      }
    }

    // Parse categoryIds if provided
    if (body.categoryIds) {
      try {
        if (typeof body.categoryIds === "string") {
          body.categoryIds = body.categoryIds
            .replace(/[\[\]]/g, "")
            .split(",")
            .map((id) => id.trim());
        }
      } catch (err) {
        console.error("Error parsing categoryIds:", err);
        if (req.file) {
          await deleteImage(req.file.key);
        }
        return res.status(400).json({
          status: "fail",
          message: "Invalid category IDs format",
        });
      }
    }

    // Add parsed values to req.body only if they were provided in the request
    if (body.minAge !== undefined) req.body.minAge = minAge;
    if (body.maxAge !== undefined) req.body.maxAge = maxAge;
    if (body.categoryIds !== undefined) req.body.categoryIds = body.categoryIds;

    next();
  } catch (error) {
    console.error("Validation error:", error);
    if (req.file) {
      await deleteImage(req.file.key);
    }
    next(new AppError(error.message || "Validation failed", 400));
  }
};
