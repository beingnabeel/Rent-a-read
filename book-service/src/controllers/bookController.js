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
// const multer = require("multer");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Book = require("../models/bookModel");
const APIFeatures = require("../utils/apiFeatures");
const ParentCategory = require("../models/parentCategoryModel");
const Category = require("../models/categoryModel");
const Language = require("../models/languageModel");
const BookQuantity = require("../models/bookQuantity");

// alias route handler
exports.aliasLatestBooks = (req, res, next) => {
  req.query.limit = 5;
  req.query.sort = "-createdAt";
  // req.query.fields = "title,description,categoryId,languageId";
  console.log("dslfjsdoflsjd");
  next();
};

exports.getAllBooks = catchAsync(async (req, res, next) => {
  console.log("Request query:", req.query);

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  let query = Book.find();

  const features = new APIFeatures(query, req.query).filter().search();
  const totalElements = await Book.countDocuments(features.query.getFilter());
  features.sort().limitFields().paginate();
  const books = await features.query;

  if (!books) {
    return res.status(200).json({
      data: [],
      pageNumber: page,
      pageSize: limit,
      totalPages: 0,
      totalElements: 0,
      first: true,
      last: true,
      numberOfElements: 0,
    });
  }

  const totalPages = Math.ceil(totalElements / limit);

  // here we are generating signed URLs for images
  const booksWithSignedUrls = await Promise.all(
    books.map(async (book) => {
      if (!book) return null; // here we are handling the null/undefined book objects

      const bookObject = book.toObject();

      // Generate signed URLs for images if they exist
      if (bookObject.imageUrls && bookObject.imageUrls.length > 0) {
        const imageUrlPromises = bookObject.imageUrls.map(async (imageUrl) => {
          try {
            // Extract the key from the full URL
            const urlParts = imageUrl.split("/");
            const key = urlParts.slice(3).join("/"); // Assumes the key starts after "amazonaws.com/"
            return await getImageSignedUrl(key);
          } catch (error) {
            console.error(
              `Failed to generate signed URL for ${imageUrl}:`,
              error
            );
            return null;
          }
        });

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
    totalPages,
    totalElements,
    first: page === 1,
    last: page === totalPages,
    numberOfElements: validBooks.length,
  };

  res.status(200).json(formattedResponse);
});

exports.getBookById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid book ID", 404));
  }

  const book = await Book.findById(id);

  if (!book) {
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
      console.error("Error generating signed URL:", error);
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
    return next(new AppError("Invalid book ID", 400));
  }

  // Find the existing book
  const book = await Book.findById(id);
  if (!book) return next(new AppError("No book found with that ID", 404));

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
      return next(new AppError("Failed to update book", 500));
    }

    // If update is successful and we have a new image, delete the old one
    if (req.file && book.imageUrls && book.imageUrls.length > 0) {
      try {
        const oldImageKey = book.imageUrls[0].split(".com/")[1];
        await deleteImage(oldImageKey);
      } catch (error) {
        console.error("Error deleting old image", error);
        // Don't fail the request if old image deletion fails
      }
    }

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
        console.error(
          "Error deleting new image after update failure",
          deleteError
        );
      }
    }

    next(new AppError(error.message || "Failed to update book", 500));
  }
});

// // 1. Export CSV template
// exports.exportCsvTemplate = (req, res) => {
//   const csvStringifier = createCsvStringifier({
//     header: [
//       { id: "title", title: "Title" },
//       { id: "description", title: "Description" },
//       { id: "parentCategoryName", title: "Parent Category Name" },
//       { id: "subCategoryName", title: "Sub Category Name" },
//       { id: "paperType", title: "Paper Type" },
//       { id: "author", title: "Author" },
//       { id: "publisher", title: "Publisher" },
//       { id: "isbn", title: "ISBN" },
//       { id: "languageName", title: "Language Name" },
//       { id: "series", title: "Series" },
//       { id: "shelfId", title: "Shelf ID" },
//       { id: "googleUrl", title: "Google URL" },
//       { id: "status", title: "Status" },
//       { id: "minAge", title: "Min Age" },
//       { id: "maxAge", title: "Max Age" },
//       { id: "totalQuantity", title: "Total Quantity" },
//       { id: "availableQuantity", title: "Available Quantity" },
//     ],
//   });

//   const csvString = csvStringifier.getHeaderString();
//   res.setHeader(
//     "Content-disposition",
//     "attachment; filename=book_template.csv"
//   );
//   res.set("Content-Type", "text/csv");
//   res.status(200).send(csvString);
// };

// // 2. Import books from CSV
// const upload = multer({ dest: "uploads/" });

// exports.importBooksFromCsv = catchAsync(async (req, res, next) => {
//   upload.single('file')(req, res, async (err) => {
//     if (err) {
//       return next(new AppError('Error uploading file', 400));
//     }

//     if (!req.file) {
//       return next(new AppError('Please upload a CSV file', 400));
//     }

//     const results = [];
//     fs.createReadStream(req.file.path)
//       .pipe(csv())
//       .on('data', (data) => results.push(data))
//       .on('end', async () => {
//         const importedBooks = [];
//         const errors = [];

//         for (const row of results) {
//           try {
//             // Check if book already exists
//             const existingBook = await Book.findOne({
//               $or: [{ title: row.title }, { isbn: row.isbn }]
//             });

//             if (existingBook) {
//               errors.push(`Book with title "${row.title}" or ISBN "${row.isbn}" already exists`);
//               continue;
//             }

//             // Handle parent category
//             let parentCategory = await ParentCategory.findOne({ title: row.parentCategoryName });
//             if (!parentCategory) {
//               parentCategory = await ParentCategory.create({ title: row.parentCategoryName });
//             }

//             // Handle sub category
//             let subCategory = await Category.findOne({ title: row.subCategoryName });
//             if (!subCategory) {
//               subCategory = await Category.create({
//                 title: row.subCategoryName,
//                 parentCategoryId: parentCategory._id
//               });
//             }

//             // Handle language
//             let language = await Language.findOne({ name: row.languageName });
//             if (!language) {
//               errors.push(`Language "${row.languageName}" not found`);
//               continue;
//             }

//             // Create new book
//             const newBook = await Book.create({
//               title: row.title,
//               description: row.description,
//               categoryIds: [subCategory._id],
//               paperType: row.paperType,
//               author: row.author,
//               publisher: row.publisher,
//               isbn: row.isbn,
//               languageId: language._id,
//               series: row.series,
//               shelfId: row.shelfId,
//               googleUrl: row.googleUrl,
//               status: row.status,
//               minAge: parseInt(row.minAge),
//               maxAge: parseInt(row.maxAge),
//               totalQuantity: parseInt(row.totalQuantity),
//               availableQuantity: parseInt(row.availableQuantity),
//               noOfLostBook: parseInt(row.totalQuantity) - parseInt(row.availableQuantity)
//             });

//             importedBooks.push(newBook);
//           } catch (error) {
//             errors.push(`Error importing book "${row.title}": ${error.message}`);
//           }
//         }

//         // Delete the uploaded file
//         fs.unlinkSync(req.file.path);

//         res.status(200).json({
//           status: 'success',
//           data: {
//             importedBooks,
//             errors
//           }
//         });
//       });
//   });
// });
// exports.importBooksFromCsv = catchAsync(async (req, res, next) => {
//   upload.single("file")(req, res, async (err) => {
//     if (err) {
//       return next(new AppError("Error uploading file", 400));
//     }

//     if (!req.file) {
//       return next(new AppError("Please upload a CSV file", 400));
//     }

//     const results = [];
//     fs.createReadStream(req.file.path)
//       .pipe(csv())
//       .on("data", (data) => results.push(data))
//       .on("end", async () => {
//         const importedBooks = [];
//         const errors = [];

//         for (const row of results) {
//           try {
//             // Check if book already exists
//             const existingBook = await Book.findOne({
//               $or: [{ title: row.title }, { isbn: row.isbn }],
//             });

//             if (existingBook) {
//               errors.push(
//                 `Book with title "${row.title}" or ISBN "${row.isbn}" already exists`
//               );
//               continue;
//             }

//             // Handle parent category
//             let parentCategory = await ParentCategory.findOne({
//               title: row.parentCategoryName,
//             });
//             if (!parentCategory) {
//               parentCategory = await ParentCategory.create({
//                 title: row.parentCategoryName,
//                 imageUrl: "default-parent-category-image.jpg", // Add a default image URL
//               });
//             }

//             // Handle sub-category
//             let subCategory = await Category.findOne({
//               title: row.subCategoryName,
//               parentCategoryId: parentCategory._id,
//             });
//             if (!subCategory) {
//               subCategory = await Category.create({
//                 title: row.subCategoryName,
//                 parentCategoryId: parentCategory._id,
//               });
//             }

//             // Handle language
//             let language = await Language.findOne({ name: row.languageName });
//             if (!language) {
//               language = await Language.create({
//                 name: row.languageName,
//                 code: row.languageName.slice(0, 2).toLowerCase(), // Simple 2-letter code
//                 nativeName: row.languageName,
//               });
//             }

//             // Create book
//             const newBook = await Book.create({
//               title: row.title,
//               description: row.description,
//               categoryIds: [subCategory._id],
//               paperType: row.paperType,
//               author: row.author,
//               publisher: row.publisher,
//               isbn: row.isbn,
//               languageId: language._id,
//               series: row.series,
//               shelfId: row.shelfId,
//               googleUrl: row.googleUrl,
//               status: row.status,
//               minAge: parseInt(row.minAge),
//               maxAge: parseInt(row.maxAge),
//               totalQuantity: parseInt(row.totalQuantity),
//               availableQuantity: parseInt(row.availableQuantity) || parseInt(row.totalQuantity),
//             });

//             importedBooks.push(newBook);
//           } catch (error) {
//             errors.push(
//               `Error importing book "${row.title}": ${error.message}`
//             );
//           }
//         }

//         // Delete the uploaded file
//         fs.unlinkSync(req.file.path);

//         res.status(200).json({
//           status: "success",
//           data: {
//             importedBooks,
//             errors,
//           },
//         });
//       });
//   });
// });

// exports.importBooksFromCsv = catchAsync(async (req, res, next) => {
//   upload.single("file")(req, res, async (err) => {
//     if (err) {
//       return next(new AppError("Error uploading file", 400));
//     }

//     if (!req.file) {
//       return next(new AppError("Please upload a CSV file", 400));
//     }

//     const results = [];
//     fs.createReadStream(req.file.path)
//       .pipe(csv())
//       .on("data", (data) => results.push(data))
//       .on("end", async () => {
//         const importedBooks = [];
//         const errors = [];

//         for (const row of results) {
//           try {
//             // Validate required fields
//             if (
//               !row.Title ||
//               !row["Parent Category Name"] ||
//               !row["Sub Category Name"]
//             ) {
//               throw new Error(
//                 "Title, Parent Category Name, and Sub Category Name are required"
//               );
//             }

//             // Check if book already exists
//             const existingBook = await Book.findOne({
//               $or: [{ title: row.Title }, { isbn: row.ISBN }],
//             });

//             if (existingBook) {
//               errors.push(
//                 `Book with title "${row.Title}" or ISBN "${row.ISBN}" already exists`
//               );
//               continue;
//             }

//             // Handle parent category
//             let parentCategory = await ParentCategory.findOne({
//               title: row["Parent Category Name"],
//             });
//             if (!parentCategory) {
//               parentCategory = await ParentCategory.create({
//                 title: row["Parent Category Name"],
//                 imageUrl: "default-parent-category-image.jpg", // Add a default image URL
//               });
//             }

//             // Handle sub-category
//             let subCategory = await Category.findOne({
//               title: row["Sub Category Name"],
//               parentCategoryId: parentCategory._id,
//             });
//             if (!subCategory) {
//               subCategory = await Category.create({
//                 title: row["Sub Category Name"],
//                 parentCategoryId: parentCategory._id,
//               });
//             }

//             // Handle language
//             let language = await Language.findOne({
//               name: row["Language Name"],
//             });
//             if (!language) {
//               language = await Language.create({
//                 name: row["Language Name"],
//                 code: row["Language Name"].slice(0, 2).toLowerCase(), // Simple 2-letter code
//                 nativeName: row["Language Name"],
//               });
//             }

//             // Create book
//             const newBook = await Book.create({
//               title: row.Title,
//               description: row.Description,
//               categoryIds: [subCategory._id],
//               paperType: row["Paper Type"],
//               author: row.Author,
//               publisher: row.Publisher,
//               isbn: row.ISBN,
//               languageId: language._id,
//               series: row.Series,
//               shelfId: row["Shelf ID"],
//               googleUrl: row["Google URL"],
//               status: row.Status || "ACTIVE", // Add a default status
//               minAge: parseInt(row["Min Age"]),
//               maxAge: parseInt(row["Max Age"]),
//               totalQuantity: parseInt(row["Total Quantity"]),
//               availableQuantity:
//                 parseInt(row["Available Quantity"]) ||
//                 parseInt(row["Total Quantity"]),
//             });

//             importedBooks.push(newBook);
//           } catch (error) {
//             errors.push(
//               `Error importing book "${row.Title || "Unknown"}": ${error.message}`
//             );
//           }
//         }

//         // Delete the uploaded file
//         fs.unlinkSync(req.file.path);

//         res.status(200).json({
//           status: "success",
//           data: {
//             importedBooks,
//             errors,
//           },
//         });
//       });
//   });
// });

// 1. Export CSV Template
// exports.exportCsvTemplate = (req, res) => {
//   const csvStringifier = createCsvStringifier({
//     header: [
//       { id: "Title", title: "Title" },
//       { id: "Description", title: "Description" },
//       { id: "Parent Category Name", title: "Parent Category Name" },
//       { id: "Sub Category Name", title: "Sub Category Name" },
//       { id: "Paper Type", title: "Paper Type" },
//       { id: "Author", title: "Author" },
//       { id: "Publisher", title: "Publisher" },
//       { id: "ISBN", title: "ISBN" },
//       { id: "Language Name", title: "Language Name" },
//       { id: "Series", title: "Series" },
//       { id: "Shelf ID", title: "Shelf ID" },
//       { id: "Google URL", title: "Google URL" },
//       { id: "Status", title: "Status" },
//       { id: "Min Age", title: "Min Age" },
//       { id: "Max Age", title: "Max Age" },
//       { id: "Total Quantity", title: "Total Quantity" },
//       { id: "Available Quantity", title: "Available Quantity" },
//     ],
//   });

//   const csvString = csvStringifier.getHeaderString();
//   res.setHeader(
//     "Content-disposition",
//     "attachment; filename=book_template.csv"
//   );
//   res.set("Content-Type", "text/csv");
//   res.status(200).send(csvString);
// };
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
// 2. Import books from CSV
// const upload = multer({ dest: "uploads/" });

// exports.importBooksFromCsv = catchAsync(async (req, res, next) => {
//   upload.single("file")(req, res, async (err) => {
//     if (err) {
//       return next(new AppError("Error uploading file", 400));
//     }

//     if (!req.file) {
//       return next(new AppError("Please upload a CSV file", 400));
//     }

//     const results = [];
//     fs.createReadStream(req.file.path)
//       .pipe(csv())
//       .on("data", (data) => results.push(data))
//       .on("end", async () => {
//         const importedBooks = [];
//         const errors = [];

//         for (const row of results) {
//           try {
//             // Validate required fields
//             if (
//               !row.Title ||
//               !row["Parent Category Name"] ||
//               !row["Sub Category Name"]
//             ) {
//               throw new Error(
//                 "Title, Parent Category Name, and Sub Category Name are required"
//               );
//             }

//             // Check if book already exists
//             const existingBook = await Book.findOne({
//               $or: [{ title: row.Title }, { isbn: row.ISBN }],
//             });

//             if (existingBook) {
//               errors.push(
//                 `Book with title "${row.Title}" or ISBN "${row.ISBN}" already exists`
//               );
//               continue;
//             }

//             // Handle parent category
//             let parentCategory = await ParentCategory.findOne({
//               title: row["Parent Category Name"],
//             });
//             if (!parentCategory) {
//               parentCategory = await ParentCategory.create({
//                 title: row["Parent Category Name"],
//                 imageUrl: "default-parent-category-image.jpg", // Add a default image URL
//               });
//             }
//             // Handle sub-category
//             let subCategory = await Category.findOne({
//               title: row["Sub Category Name"],
//               parentCategoryId: parentCategory._id,
//             });
//             if (!subCategory) {
//               subCategory = await Category.create({
//                 title: row["Sub Category Name"],
//                 parentCategoryId: parentCategory._id,
//               });
//             }

//             // Handle language
//             let language = await Language.findOne({
//               name: row["Language Name"],
//             });
//             if (!language) {
//               language = await Language.create({
//                 name: row["Language Name"],
//                 code: row["Language Name"].slice(0, 2).toLowerCase(), // Simple 2-letter code
//                 nativeName: row["Language Name"],
//               });
//             }

//             // Create book
//             const newBook = await Book.create({
//               title: row.Title,
//               description: row.Description || "No description", // Add a fallback for optional description
//               categoryIds: [subCategory._id],
//               paperType: row["Paper Type"],
//               author: row.Author,
//               publisher: row.Publisher,
//               isbn: row.ISBN,
//               languageId: language._id,
//               series: row.Series,
//               shelfId: row["Shelf ID"],
//               googleUrl: row["Google URL"],
//               status: row.Status || "ACTIVE", // Add a default status
//               minAge: parseInt(row["Min Age"]),
//               maxAge: parseInt(row["Max Age"]),
//               totalQuantity: parseInt(row["Total Quantity"]),
//               availableQuantity:
//                 parseInt(row["Available Quantity"]) ||
//                 parseInt(row["Total Quantity"]),
//             });

//             importedBooks.push(newBook);
//           } catch (error) {
//             errors.push(
//               `Error importing book "${row.Title || "Unknown"}": ${error.message}`
//             );
//           }
//         }

//         // Delete the uploaded file
//         fs.unlinkSync(req.file.path);

//         res.status(200).json({
//           status: "success",
//           data: {
//             importedBooks,
//             errors,
//           },
//         });
//       });
//   });
// });

exports.updateBookQuantities = catchAsync(async (req, res, next) => {
  // Validate the updates
  const updates = req.body;
  const validFields = [
    "availableQuantity",
    "reserved",
    "inTransit",
    "noOfLostBook",
  ];

  // Check if all update fields are valid
  const invalidFields = Object.keys(updates).filter(
    (field) => !validFields.includes(field)
  );
  if (invalidFields.length > 0) {
    return next(
      new AppError(`Invalid fields: ${invalidFields.join(", ")}`, 400)
    );
  }

  // Find the book and update quantities
  const book = await Book.findById(req.params.id);
  if (!book) {
    return next(new AppError("No book found with that ID", 404));
  }

  // Calculate new quantities
  const newQuantities = {
    availableQuantity:
      book.availableQuantity + (updates.availableQuantity || 0),
    reserved: book.reserved + (updates.reserved || 0),
    inTransit: book.inTransit + (updates.inTransit || 0),
    noOfLostBook: book.noOfLostBook + (updates.noOfLostBook || 0),
  };

  // Validate total quantity constraint
  const totalQuantity = book.totalQuantity;
  const newTotal =
    newQuantities.availableQuantity +
    newQuantities.reserved +
    newQuantities.inTransit +
    newQuantities.noOfLostBook;

  if (newTotal > totalQuantity) {
    return next(
      new AppError(
        `Total quantity (${totalQuantity}) would be exceeded. New total would be ${newTotal}`,
        400
      )
    );
  }

  // Apply updates
  Object.assign(book, newQuantities);
  await book.save();

  res.status(200).json({
    status: "success",
    data: {
      book,
    },
  });
});
