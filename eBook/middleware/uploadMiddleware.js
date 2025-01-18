import path from "path";
import multer from "multer";

// Configure multer to store files in memory
const storage = multer.memoryStorage();

// Define allowed extensions for both category images and eBook files (thumbnail & PDF)
const allowedExtensions = {
  category: [".jpeg", ".jpg", ".png"], // For categories, only images
  ebookThumbnail: [".jpeg", ".jpg", ".png"], // For eBook thumbnails, only images
  ebookPdf: [".pdf"], // For eBook PDFs, only PDFs
};

// File size limits (in bytes)
const fileSizeLimits = {
  thumbnailUrl: 5 * 1024 * 1024, // 5MB for thumbnails
  pdfUrl: 50 * 1024 * 1024, // 50MB for PDFs
  imageUrl: 5 * 1024 * 1024, // 5MB for category images
};

// Custom file filter function
const fileFilter = (req, file, cb) => {
  const field = file.fieldname;
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (field === "thumbnailUrl") {
    // For eBook thumbnails, allow image files
    if (!allowedExtensions.ebookThumbnail.includes(fileExtension)) {
      return cb(
        new Error(
          "Invalid file type for thumbnail. Only JPG, PNG, and JPEG are allowed."
        )
      );
    }
  } else if (field === "pdfUrl") {
    // For eBook PDFs, allow PDF files only
    if (!allowedExtensions.ebookPdf.includes(fileExtension)) {
      return cb(
        new Error("Invalid file type for PDF. Only PDF files are allowed.")
      );
    }
  } else if (field === "imageUrl") {
    // For category image upload
    if (!allowedExtensions.category.includes(fileExtension)) {
      return cb(
        new Error(
          "Invalid file type for category image. Only JPG, PNG, and JPEG are allowed."
        )
      );
    }
  }

  cb(null, true); // Accept the file if it's valid
};

// Middleware to check file size limits
const fileSizeCheck = (req, res, next) => {
  if (req.files) {
    for (const [field, files] of Object.entries(req.files)) {
      const maxFileSize = fileSizeLimits[field];
      if (!maxFileSize) continue; // Skip fields not defined in fileSizeLimits

      files.forEach((file) => {
        if (file.size > maxFileSize) {
          return next(
            new Error(
              `File size for ${field} exceeds the limit of ${
                maxFileSize / (1024 * 1024)
              }MB.`
            )
          );
        }
      });
    }
  }

  next();
};

// Multer setup
export const uploadMiddleware = [
  multer({
    storage,
    fileFilter,
  }).fields([
    { name: "thumbnailUrl", maxCount: 1 }, // Expect 1 file for 'thumbnail' (for eBook)
    { name: "pdfUrl", maxCount: 1 }, // Expect 1 file for 'pdf' (for eBook)
    { name: "imageUrl", maxCount: 1 }, // Expect 1 file for 'imageUrl' (for category)
  ]),
  fileSizeCheck, // Add file size check as middleware
];
