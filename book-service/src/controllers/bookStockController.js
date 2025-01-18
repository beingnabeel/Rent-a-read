const BookQuantity = require("../models/bookQuantity");
const SchoolBookQuantity = require("../models/schoolBookQuantity");
const Book = require("../models/bookModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const mongoose = require("mongoose");
const APIFeatures = require("../utils/apiFeatures");

exports.addBookToSchool = catchAsync(async (req, res, next) => {
  const { bookId, schoolId } = req.params;
  const { totalQuantity } = req.body;

  try {
    // 1. Check if book exists
    const book = await Book.findById(bookId);
    if (!book) {
      return next(new AppError("Book not found", 404));
    }

    // 2. Check if bookQuantity exists
    const bookQuantity = await BookQuantity.findByBookId(bookId);
    if (!bookQuantity) {
      return next(new AppError("Book quantity record not found", 404));
    }

    // 3. Check for existing active schoolBookQuantity
    const existingSchoolBook = await SchoolBookQuantity.findOne({
      bookId,
      schoolId,
      isDeleted: false,
    });

    if (existingSchoolBook) {
      return next(new AppError("Book is already assigned to this school", 400));
    }

    // 4. Validate available quantity in both book and bookQuantity
    const currentAvailableQuantity = Math.min(
      book.availableQuantity,
      bookQuantity.availableQuantity
    );

    if (currentAvailableQuantity < totalQuantity) {
      return next(
        new AppError(
          `Insufficient available quantity. Current available: ${currentAvailableQuantity}`,
          400
        )
      );
    }

    // 5. Create new schoolBookQuantity document
    const newSchoolBookQuantity = new SchoolBookQuantity({
      bookId,
      schoolId,
      totalQuantity,
      availableQuantity: totalQuantity,
    });

    // 6. Update book and bookQuantity documents with validation disabled
    const updatedBook = await Book.findOneAndUpdate(
      { _id: bookId },
      {
        $set: {
          availableQuantity: book.availableQuantity - totalQuantity,
        },
      },
      {
        new: true,
        runValidators: false, // Disable mongoose validation
      }
    );

    const updatedBookQuantity = await BookQuantity.findOneAndUpdate(
      { bookId },
      {
        $set: {
          availableQuantity: bookQuantity.availableQuantity - totalQuantity,
        },
      },
      {
        new: true,
        runValidators: false, // Disable mongoose validation
      }
    );

    // 7. Save the new schoolBookQuantity
    await newSchoolBookQuantity.save();

    if (!updatedBook || !updatedBookQuantity) {
      return next(new AppError("Failed to update quantities", 500));
    }

    res.status(201).json({
      status: "success",
      data: {
        schoolBookQuantity: newSchoolBookQuantity,
        book: updatedBook,
        bookQuantity: updatedBookQuantity,
      },
    });
  } catch (error) {
    return next(
      new AppError(
        error.message || "Failed to add book to school",
        error.statusCode || 500
      )
    );
  }
});

exports.updateTotalQuantity = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { totalQuantity: newTotalQuantity } = req.body;

  try {
    // Find the book and its quantity record
    const book = await Book.findById(id);
    if (!book) {
      return next(new AppError("Book not found", 404));
    }

    const bookQuantity = await BookQuantity.findByBookId(id);
    if (!bookQuantity) {
      return next(new AppError("Book quantity record not found", 404));
    }

    const currentTotalQuantity = book.totalQuantity;
    const currentAvailableQuantity = book.availableQuantity;

    // Calculate new available quantity based on the cases
    let newAvailableQuantity;

    if (newTotalQuantity >= currentTotalQuantity) {
      // Case 1: New total is greater or equal
      const quantityDifference = newTotalQuantity - currentTotalQuantity;
      newAvailableQuantity = currentAvailableQuantity + quantityDifference;
    } else {
      // Case 2: New total is less
      const quantityDifference = currentTotalQuantity - newTotalQuantity;
      newAvailableQuantity = currentAvailableQuantity - quantityDifference;
    }

    // Validate the new quantities
    if (newAvailableQuantity < 0) {
      return next(new AppError("Available quantity cannot be negative", 400));
    }

    if (newAvailableQuantity + book.noOfLostBook > newTotalQuantity) {
      return next(
        new AppError(
          "Sum of available and lost books cannot exceed total quantity",
          400
        )
      );
    }

    // Update book document using findOneAndUpdate with validation disabled
    const updatedBook = await Book.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          totalQuantity: newTotalQuantity,
          availableQuantity: newAvailableQuantity,
        },
      },
      {
        new: true,
        runValidators: false, // Disable validation since we've already validated
      }
    );

    // Update book quantity document
    const updatedBookQuantity = await BookQuantity.findOneAndUpdate(
      { bookId: id },
      {
        $set: {
          totalQuantity: newTotalQuantity,
          availableQuantity: newAvailableQuantity,
        },
      },
      {
        new: true,
        runValidators: false,
      }
    );

    if (!updatedBook || !updatedBookQuantity) {
      return next(new AppError("Failed to update quantities", 500));
    }

    res.status(200).json({
      status: "success",
      data: {
        book: updatedBook,
        bookQuantity: updatedBookQuantity,
      },
    });
  } catch (error) {
    return next(
      new AppError(error.message || "Failed to update quantities", 500)
    );
  }
});

exports.updateAvailableQuantity = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { availableQuantity } = req.body;

  const book = await Book.findById(id);
  if (!book) {
    return next(new AppError("Book not found", 404));
  }

  const bookQuantity = await BookQuantity.findByBookId(id);
  if (!bookQuantity) {
    return next(new AppError("Book quantity record not found", 404));
  }

  // Validate available quantity
  if (availableQuantity + book.noOfLostBook > book.totalQuantity) {
    return next(
      new AppError(
        "Available quantity plus lost books cannot exceed total quantity",
        400
      )
    );
  }

  try {
    // Update book
    book.availableQuantity = availableQuantity;
    await book.save();

    // Update book quantity
    bookQuantity.availableQuantity = availableQuantity;
    await bookQuantity.save();

    res.status(200).json({
      status: "success",
      data: {
        book,
        bookQuantity,
      },
    });
  } catch (error) {
    return next(
      new AppError(`Failed to update available quantity: ${error.message}`, 500)
    );
  }
});

exports.updateNoOfLostBook = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { noOfLostBook: newNoOfLostBook } = req.body;

  try {
    // Find the book
    const book = await Book.findById(id);
    if (!book) {
      return next(new AppError("Book not found", 404));
    }

    // Validate the new noOfLostBook value
    if (newNoOfLostBook > book.totalQuantity) {
      return next(
        new AppError("Number of lost books cannot exceed total quantity", 400)
      );
    }

    // New validation: Check if noOfLostBook + availableQuantity <= totalQuantity
    if (newNoOfLostBook + book.availableQuantity > book.totalQuantity) {
      return next(
        new AppError(
          "Sum of lost books and available quantity cannot exceed total quantity",
          400
        )
      );
    }

    // Update book document using findOneAndUpdate with validation disabled
    const updatedBook = await Book.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          noOfLostBook: newNoOfLostBook,
        },
      },
      {
        new: true,
        runValidators: false, // Disable validation since we've already validated
      }
    );

    if (!updatedBook) {
      return next(new AppError("Failed to update lost books quantity", 500));
    }

    res.status(200).json({
      status: "success",
      data: {
        book: updatedBook,
      },
    });
  } catch (error) {
    return next(
      new AppError(error.message || "Failed to update lost books quantity", 500)
    );
  }
});

exports.updateSchoolBookTotalQuantity = catchAsync(async (req, res, next) => {
  const { bookId, schoolId } = req.params;
  const { totalQuantity: newTotalQuantity } = req.body;

  // Find the schoolBookQuantity document
  const schoolBookQuantity = await SchoolBookQuantity.findByBookIdAndSchoolId(
    bookId,
    schoolId
  );

  if (!schoolBookQuantity) {
    return next(new AppError("School book quantity record not found", 404));
  }

  // Find the book and bookQuantity documents
  const book = await Book.findById(bookId);
  if (!book) {
    return next(new AppError("Book not found", 404));
  }

  const bookQuantity = await BookQuantity.findByBookId(bookId);
  if (!bookQuantity) {
    return next(new AppError("Book quantity record not found", 404));
  }

  const currentSchoolTotalQuantity = schoolBookQuantity.totalQuantity;
  const quantityDifference = newTotalQuantity - currentSchoolTotalQuantity;

  // Case 1: Increasing total quantity
  if (quantityDifference > 0) {
    const availableInStock = book.totalQuantity - book.availableQuantity;

    if (quantityDifference > book.availableQuantity) {
      return next(
        new AppError(
          `Cannot add ${quantityDifference} books. Only ${book.availableQuantity} books available in library stock.`,
          400
        )
      );
    }

    // Update schoolBookQuantity
    schoolBookQuantity.totalQuantity = newTotalQuantity;
    schoolBookQuantity.availableQuantity += quantityDifference;

    // Update book and bookQuantity
    book.availableQuantity -= quantityDifference;
    bookQuantity.availableQuantity -= quantityDifference;
  }
  // Case 2: Decreasing total quantity
  else if (quantityDifference < 0) {
    const decreaseAmount = Math.abs(quantityDifference);

    if (decreaseAmount > schoolBookQuantity.availableQuantity) {
      return next(
        new AppError(
          `Cannot remove ${decreaseAmount} books. Only ${schoolBookQuantity.availableQuantity} books available in school stock.`,
          400
        )
      );
    }

    // Update schoolBookQuantity
    schoolBookQuantity.totalQuantity = newTotalQuantity;
    schoolBookQuantity.availableQuantity -= decreaseAmount;

    // Update book and bookQuantity
    book.availableQuantity += decreaseAmount;
    bookQuantity.availableQuantity += decreaseAmount;
  }

  try {
    // Save all updates
    await Promise.all([
      schoolBookQuantity.save(),
      book.save(),
      bookQuantity.save(),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        schoolBookQuantity,
        book,
        bookQuantity,
      },
    });
  } catch (error) {
    return next(
      new AppError(
        `Failed to update school book quantity: ${error.message}`,
        500
      )
    );
  }
});

exports.updateSchoolBookAvailableQuantity = catchAsync(
  async (req, res, next) => {
    const { bookId, schoolId } = req.params;
    const { availableQuantity: newAvailableQuantity } = req.body;

    // Find the schoolBookQuantity document
    const schoolBookQuantity = await SchoolBookQuantity.findByBookIdAndSchoolId(
      bookId,
      schoolId
    );

    if (!schoolBookQuantity) {
      return next(new AppError("School book quantity record not found", 404));
    }

    // Validate that new available quantity doesn't exceed total quantity
    if (newAvailableQuantity > schoolBookQuantity.totalQuantity) {
      return next(
        new AppError(
          `Available quantity (${newAvailableQuantity}) cannot exceed total quantity (${schoolBookQuantity.totalQuantity})`,
          400
        )
      );
    }

    try {
      // Calculate new bookOnHold
      const newBookOnHold =
        schoolBookQuantity.totalQuantity - newAvailableQuantity;

      // Update using save() to trigger middleware
      schoolBookQuantity.availableQuantity = newAvailableQuantity;
      await schoolBookQuantity.save();

      res.status(200).json({
        status: "success",
        data: {
          schoolBookQuantity,
        },
      });
    } catch (error) {
      return next(
        new AppError(
          `Failed to update school book available quantity: ${error.message}`,
          500
        )
      );
    }
  }
);

exports.deleteSchoolBook = catchAsync(async (req, res, next) => {
  const { bookId, schoolId } = req.params;

  try {
    // Find the school book quantity document
    const schoolBookQuantity = await SchoolBookQuantity.findByBookIdAndSchoolId(
      bookId,
      schoolId
    );

    if (!schoolBookQuantity) {
      return next(new AppError("School book quantity record not found", 404));
    }

    if (schoolBookQuantity.isDeleted) {
      return next(new AppError("School book is already deleted", 400));
    }

    // Get the total quantity that needs to be returned to book and bookQuantity
    const quantityToReturn = schoolBookQuantity.totalQuantity;

    // Update book document
    const updatedBook = await Book.findOneAndUpdate(
      { _id: bookId },
      {
        $inc: { availableQuantity: quantityToReturn },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedBook) {
      return next(new AppError("Failed to update book quantity", 500));
    }

    // Update bookQuantity document
    const updatedBookQuantity = await BookQuantity.findOneAndUpdate(
      { bookId },
      {
        $inc: { availableQuantity: quantityToReturn },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedBookQuantity) {
      // Rollback book update if bookQuantity update fails
      await Book.findOneAndUpdate(
        { _id: bookId },
        {
          $inc: { availableQuantity: -quantityToReturn },
        }
      );
      return next(new AppError("Failed to update book quantity record", 500));
    }

    // Mark school book as deleted
    schoolBookQuantity.isDeleted = true;
    await schoolBookQuantity.save();

    // If everything succeeded, send 204 response
    res.status(204).send();
  } catch (error) {
    return next(
      new AppError(`Failed to delete school book: ${error.message}`, 500)
    );
  } finally {
    session.endSession();
  }
});

exports.getSchoolBookQuantity = catchAsync(async (req, res, next) => {
  const { bookId, schoolId } = req.params;

  // Validate bookId format
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return next(new AppError("Invalid book ID format", 400));
  }

  // Validate schoolId format
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    return next(new AppError("Invalid school ID format", 400));
  }

  // Check if book exists
  const book = await Book.findById(bookId);
  if (!book) {
    return next(new AppError("Book not found", 404));
  }

  // Find the school book quantity document
  const schoolBookQuantity = await SchoolBookQuantity.findByBookIdAndSchoolId(
    bookId,
    schoolId
  );

  // If no record found, return message only
  if (!schoolBookQuantity) {
    return res.status(404).json({
      status: "fail",
      message: `No record found for book ID ${bookId} and school ID ${schoolId}`,
    });
  }

  // Return the found document
  res.status(200).json({
    status: "success",
    data: {
      schoolBookQuantity,
    },
  });
});

exports.getAllSchoolBooks = catchAsync(async (req, res, next) => {
  try {
    console.log("Request query: ", req.query);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    let query = SchoolBookQuantity.find({ isDeleted: false });

    const features = new APIFeatures(query, req.query).filter().search();

    // Get total count before pagination
    const totalDocuments = await SchoolBookQuantity.countDocuments(
      features.query.getFilter()
    );

    // Apply remaining features
    features.sort().limitFields().paginate();

    // Execute the query with population
    const schoolBooks = await features.query.populate({
      path: "bookId",
      populate: {
        path: "categoryIds",
        populate: {
          path: "parentCategoryId",
        },
      },
    });

    if (!schoolBooks) {
      return res.status(200).json({
        data: [],
        pageNumber: page,
        pageSize: limit,
        totalPages: 0,
        totalDocuments: 0,
        first: true,
        last: true,
        numberOfElements: 0,
      });
    }

    // Calculate pagination details
    const totalPages = Math.ceil(totalDocuments / limit);
    const numberOfDocuments = schoolBooks.length;

    // Send response
    res.status(200).json({
      status: "success",
      data: {
        schoolBooks,
        pageNumber: page,
        pageSize: limit,
        totalPages,
        totalDocuments,
        first: page === 1,
        last: page === totalPages,
        numberOfDocuments,
      },
    });
  } catch (error) {
    return next(
      new AppError(`Failed to fetch school books: ${error.message}`, 500)
    );
  }
});
