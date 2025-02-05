const mongoose = require("mongoose");
const {
  uploadImage,
  deleteImage,
  getImageSignedUrl,
} = require("../utils/s3Upload");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const fs = require("fs");
const csv = require("csv-parser");
const createCsvStringifier = require("csv-writer").createObjectCsvStringifier;
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Book = require("../models/bookModel");
const APIFeatures = require("../utils/apiFeatures");
const ParentCategory = require("../models/parentCategoryModel");
const Category = require("../models/categoryModel");
const Language = require("../models/languageModel");
const BookQuantity = require("../models/bookQuantity");
const { logger } = require("../utils/logger");

exports.aliasLatestBooks = (req, res, next) => {
  req.query.limit = 5;
  req.query.sort = "-createdAt";
  logger.info("Alias Latest Books middleware applied", { query: req.query });
  next();
};

exports.topPickBooks = (req, res, next) => {
  req.query.limit = 5;
  req.query.sort = "-availableQuantity";
  logger.info("Top Pick Books middleware applied", { query: req.query });
  next();
};

exports.justPickBooks = (req, res, next) => {
  req.query.limit = 5;
  req.query.sort = "availableQuantity";
  logger.info("Just Pick Books middleware applied", { query: req.query });
  next();
};

exports.getAllBooks = catchAsync(async (req, res, next) => {
  logger.info("Fetching all books", {
    query: req.query,
    page: req.query.page || 1,
    limit: req.query.limit || 10,
  });

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  let query = Book.find();

  const features = new APIFeatures(query, req.query).filter().search();
  const totalElements = await Book.countDocuments(features.query.getFilter());
  features.sort().limitFields().paginate();

  try {
    const books = await features.query;

    if (!books || books.length === 0) {
      logger.warn("No books found for the given criteria", {
        query: req.query,
        filter: features.query.getFilter(),
      });
    }

    logger.info("Books fetched successfully", {
      count: books.length,
      totalElements,
      page,
      limit,
    });

    // here we are generating signed URLs for images
    const booksWithSignedUrls = await Promise.all(
      books.map(async (book) => {
        if (!book) return null; // here we are handling the null/undefined book objects

        const bookObject = book.toObject();

        // Generate signed URLs for images if they exist
        if (bookObject.imageUrls && bookObject.imageUrls.length > 0) {
          const imageUrlPromises = bookObject.imageUrls.map(
            async (imageUrl) => {
              try {
                // Extract the key from the full URL
                const urlParts = imageUrl.split("/");
                const key = urlParts.slice(3).join("/"); // Assumes the key starts after "amazonaws.com/
                return await getImageSignedUrl(key);
              } catch (error) {
                logger.error(
                  `Failed to generate signed URL for ${imageUrl}:`,
                  error
                );
                return null;
              }
            }
          );

          // Wait for all signed URLs to be generated
          const signedImageUrls = await Promise.all(imageUrlPromises);

          // here we are replacing the image URLs with signed URLs, filtering out any failed generations
          bookObject.imageUrls = signedImageUrls.filter((url) => url !== null);
        }

        return {
          ...bookObject,
          createdBy: null,
          updatedBy: null,
        };
      })
    );

    // Filter out any null values from the results
    const validBooks = booksWithSignedUrls.filter((book) => book !== null);

    const formattedResponse = {
      data: validBooks,
      pageNumber: page,
      pageSize: limit,
      totalPages: Math.ceil(totalElements / limit),
      totalElements,
      first: page === 1,
      last: page === Math.ceil(totalElements / limit),
      numberOfElements: validBooks.length,
    };

    res.status(200).json(formattedResponse);
  } catch (error) {
    logger.error("Error fetching books", {
      error: error.message,
      stack: error.stack,
      query: req.query,
    });
    return next(new AppError("Error fetching books", 500));
  }
});

exports.getBookById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.error("Invalid book ID", { id });
    return next(new AppError("Invalid book ID", 404));
  }

  const book = await Book.findById(id);

  if (!book) {
    logger.error("No book found with that ID", { id });
    return next(new AppError("No book found with that ID", 404));
  }

  let bookObject = book.toObject();

  // Check if the book has any image URLs
  if (book.imageUrls && book.imageUrls.length > 0) {
    try {
      // Assuming the imageUrls are stored as full S3 URLs
      const imageUrl = book.imageUrls[0];

      // Extract the key from the full URL
      const urlParts = new URL(imageUrl);
      const imageKey = urlParts.pathname.slice(1); // Remove the leading '/'

      if (!imageKey) {
        throw new Error("Invalid image key");
      }

      const signedImageUrl = await getImageSignedUrl(imageKey);
      bookObject.imageUrls[0] = signedImageUrl;
    } catch (error) {
      logger.error("Error generating signed URL:", error);
      // Instead of failing, we'll just leave the original URL
      bookObject.imageUrls[0] = book.imageUrls[0];
    }
  }

  res.status(200).json({
    status: "success",
    data: {
      book: bookObject,
    },
  });
});

// exports.createBook = catchAsync(async (req, res, next) => {
//   // logger.info("Creating new book", {
//   //   bookData: { ...req.body, image: req.file ? "Present" : "Not present" },
//   // });

//   // Validate image upload
//   if (!req.file || !req.file.location) {
//     logger.error("Image upload failed during book creation", {
//       file: req.file,
//       body: req.body,
//     });
//     return next(new AppError("Image upload failed", 400));
//   }

//   try {
//     // Additional validation
//     if (!req.body.title || !req.body.categoryId || !req.body.languageId) {
//       logger.error("Missing required fields in book creation", {
//         providedFields: Object.keys(req.body),
//       });
//       return next(new AppError("Missing required fields", 400));
//     }

//     const newBook = await Book.create({
//       title: req.body.title,
//       description: req.body.description,
//       categoryIds: req.body.categoryIds,
//       paperType: req.body.paperType,
//       author: req.body.author,
//       publisher: req.body.publisher,
//       isbn: req.body.isbn,
//       languageId: req.body.languageId,
//       series: req.body.series,
//       shelfId: req.body.shelfId,
//       googleUrl: req.body.googleUrl,
//       status: req.body.status || "ACTIVE",
//       minAge: req.body.minAge,
//       maxAge: req.body.maxAge,
//       totalQuantity: req.body.totalQuantity,
//       availableQuantity: req.body.availableQuantity,
//       noOfLostBook: req.body.noOfLostBook || 0,
//       imageUrls: [req.file.location],
//     });

//     // Create corresponding BookQuantity document
//     const bookQuantity = await BookQuantity.create({
//       bookId: newBook._id,
//       totalQuantity: req.body.totalQuantity,
//       availableQuantity: req.body.availableQuantity || req.body.totalQuantity,
//     });

//     // If book creation succeeds but quantity creation fails
//     if (!bookQuantity) {
//       // Cleanup: delete the created book
//       await Book.findByIdAndDelete(newBook._id);
//       await deleteImage(req.file.key);
//       logger.error("Failed to create book quantity record", {
//         bookId: newBook._id,
//         totalQuantity: req.body.totalQuantity,
//         availableQuantity: req.body.availableQuantity,
//       });
//       return next(new AppError("Failed to create book quantity record", 500));
//     }

//     logger.info("Book created successfully", {
//       bookId: newBook._id,
//       title: newBook.title,
//     });

//     res.status(201).json({
//       status: "success",
//       data: {
//         book: newBook,
//         bookQuantity,
//       },
//     });
//   } catch (error) {
//     // Cleanup on error
//     if (req.file) {
//       await deleteImage(req.file.key);
//     }
//     logger.error("Error creating book", {
//       error: error.message,
//       stack: error.stack,
//       requestBody: req.body,
//     });
//     return next(new AppError(`Failed to create book: ${error.message}`, 500));
//   }
// });

exports.createBook = catchAsync(async (req, res, next) => {
  // Validate image upload
  if (!req.file || !req.file.location) {
    return next(new AppError("Image upload failed", 400));
  }

  try {
    // Create the book
    const newBook = await Book.create({
      title: req.body.title,
      description: req.body.description,
      categoryIds: req.body.categoryIds,
      paperType: req.body.paperType,
      author: req.body.author,
      publisher: req.body.publisher,
      isbn: req.body.isbn,
      languageId: req.body.languageId,
      series: req.body.series,
      shelfId: req.body.shelfId,
      googleUrl: req.body.googleUrl,
      status: req.body.status || "ACTIVE",
      minAge: req.body.minAge,
      maxAge: req.body.maxAge,
      totalQuantity: req.body.totalQuantity,
      availableQuantity: req.body.availableQuantity,
      noOfLostBook: req.body.noOfLostBook || 0,
      imageUrls: [req.file.location],
    });

    // Create corresponding BookQuantity document
    const bookQuantity = await BookQuantity.create({
      bookId: newBook._id,
      totalQuantity: req.body.totalQuantity,
      availableQuantity: req.body.availableQuantity || req.body.totalQuantity,
    });

    // If book creation succeeds but quantity creation fails
    if (!bookQuantity) {
      // Cleanup: delete the created book
      await Book.findByIdAndDelete(newBook._id);
      await deleteImage(req.file.key);
      return next(new AppError("Failed to create book quantity record", 500));
    }

    res.status(201).json({
      status: "success",
      data: {
        book: newBook,
        bookQuantity,
      },
    });
  } catch (error) {
    // Cleanup on error
    if (req.file) {
      await deleteImage(req.file.key);
    }
    return next(new AppError(`Failed to create book: ${error.message}`, 500));
  }
});

exports.updateBook = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.error("Invalid book ID", { id });
    return next(new AppError("Invalid book ID", 400));
  }

  // Find the existing book
  const book = await Book.findById(id);
  if (!book) {
    logger.error("No book found with that ID", { id });
    return next(new AppError("No book found with that ID", 404));
  }

  // Prepare updated data
  const updateData = { ...req.body };
  let newImageKey;

  try {
    // Handle image update if file is present
    if (req.file) {
      // Store the new image key but don't delete the old one yet
      newImageKey = req.file.key;
      const bucketName = process.env.AWS_S3_BUCKET_NAME;
      if (!bucketName) {
        throw new Error(
          "AWS_S3_BUCKET_NAME environment variable is not defined"
        );
      }
      updateData.imageUrls = [
        `https://${bucketName}.s3.amazonaws.com/${newImageKey}`,
      ];
    }

    // Perform the update
    const updatedBook = await Book.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedBook) {
      // If update fails, delete the newly uploaded image
      if (newImageKey) {
        await deleteImage(newImageKey);
      }
      logger.error("Failed to update book", {
        bookId: id,
        updateData,
      });
      return next(new AppError("Failed to update book", 500));
    }

    // If update is successful and we have a new image, delete the old one
    if (req.file && book.imageUrls && book.imageUrls.length > 0) {
      try {
        const oldImageKey = book.imageUrls[0].split(".com/")[1];
        await deleteImage(oldImageKey);
      } catch (error) {
        logger.error("Error deleting old image", error);
        // Don't fail the request if old image deletion fails
      }
    }

    logger.info("Book updated successfully", {
      bookId: updatedBook._id,
      title: updatedBook.title,
    });

    res.status(200).json({
      status: "success",
      data: {
        book: updatedBook,
      },
    });
  } catch (error) {
    // If there's any error, delete the newly uploaded image
    if (newImageKey) {
      try {
        await deleteImage(newImageKey);
      } catch (deleteError) {
        logger.error(
          "Error deleting new image after update failure",
          deleteError
        );
      }
    }

    logger.error("Error updating book", {
      error: error.message,
      stack: error.stack,
      bookId: id,
      updateData,
    });
    next(new AppError(error.message || "Failed to update book", 500));
  }
});

exports.updateBookQuantities = catchAsync(async (req, res, next) => {
  logger.info("Updating book quantities", {
    updates: req.body,
  });

  // Validate the updates
  const updates = req.body;
  const validFields = [
    "availableQuantity",
    "reserved",
    "inTransit",
    "noOfLostBook",
  ];

  const invalidFields = Object.keys(updates).filter(
    (field) => !validFields.includes(field)
  );
  if (invalidFields.length > 0) {
    logger.error("Invalid fields in book quantity update", {
      invalidFields,
      providedUpdates: updates,
    });
    return next(
      new AppError(`Invalid fields: ${invalidFields.join(", ")}`, 400)
    );
  }

  const book = await Book.findById(req.params.id);
  if (!book) {
    logger.error("Book not found", { id: req.params.id });
    return next(new AppError("Book not found", 404));
  }

  // Calculate new quantities
  const newQuantities = {
    availableQuantity:
      updates.availableQuantity !== undefined
        ? updates.availableQuantity
        : book.availableQuantity,
    reserved:
      updates.reserved !== undefined
        ? book.reserved + updates.reserved
        : book.reserved,
    inTransit:
      updates.inTransit !== undefined
        ? book.inTransit + updates.inTransit
        : book.inTransit,
    noOfLostBook:
      updates.noOfLostBook !== undefined
        ? book.noOfLostBook + updates.noOfLostBook
        : book.noOfLostBook,
  };

  // Validate total quantity constraint
  const totalQuantity = book.totalQuantity;
  const newTotal =
    newQuantities.availableQuantity +
    newQuantities.reserved +
    newQuantities.inTransit +
    newQuantities.noOfLostBook;

  if (newTotal > totalQuantity) {
    logger.error("Total quantity exceeded", {
      totalQuantity,
      newTotal,
    });
    return next(
      new AppError(
        `Total quantity (${totalQuantity}) would be exceeded. New total would be ${newTotal}`,
        400
      )
    );
  }

  // Validate available quantity is not negative
  if (newQuantities.availableQuantity < 0) {
    logger.error("Available quantity is negative", {
      availableQuantity: newQuantities.availableQuantity,
    });
    return next(
      new AppError(
        `Available quantity cannot be negative. New value would be ${newQuantities.availableQuantity}`,
        400
      )
    );
  }

  // Apply updates
  Object.assign(book, newQuantities);
  await book.save();

  logger.info("Book quantities updated successfully", {
    bookId: book._id,
    updates,
  });

  res.status(200).json({
    status: "success",
    data: {
      book,
    },
  });
});

// 1. Export CSV template
exports.exportCsvTemplate = catchAsync(async (req, res, next) => {
  const csvStringifier = createCsvStringifier({
    header: [
      { id: "title", title: "Title" },
      { id: "description", title: "Description" },
      { id: "parentCategoryName", title: "Parent Category Name" },
      { id: "subCategoryName", title: "Sub Category Name" },
      { id: "paperType", title: "Paper Type" },
      { id: "author", title: "Author" },
      { id: "publisher", title: "Publisher" },
      { id: "isbn", title: "ISBN" },
      { id: "languageName", title: "Language Name" },
      { id: "series", title: "Series" },
      { id: "shelfId", title: "Shelf ID" },
      { id: "googleUrl", title: "Google URL" },
      { id: "imageUrl", title: "Image URL" }, // Added Image URL field
      { id: "status", title: "Status" },
      { id: "minAge", title: "Min Age" },
      { id: "maxAge", title: "Max Age" },
      { id: "totalQuantity", title: "Total Quantity" },
      { id: "availableQuantity", title: "Available Quantity" },
      { id: "reserved", title: "Reserved Quantity" },
      { id: "inTransit", title: "In-Transit Quantity" },
    ],
  });

  const csvString = csvStringifier.getHeaderString();
  res.setHeader(
    "Content-disposition",
    "attachment; filename=book_template.csv"
  );
  res.set("Content-Type", "text/csv");
  res.status(200).send(csvString);
});
