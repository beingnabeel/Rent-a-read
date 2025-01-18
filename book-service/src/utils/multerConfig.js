const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

const multerS3Uploader = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: BUCKET_NAME,
    key: (req, file, cb) => {
      // Use the resource type passed in the request
      const resourceType = req.resourceType || "default";

      if (req.params && req.params.id) {
        // Updating existing resource
        const fileName = `${resourceType}/${req.params.id}-${file.originalname}`;
        cb(null, fileName);
      } else {
        // New upload
        const fileName = `${resourceType}/${Date.now()}-${file.originalname}`;
        cb(null, fileName);
      }
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed."));
    }
  },
});

module.exports = multerS3Uploader;

// const multer = require("multer");
// const multerS3 = require("multer-s3");
// const { S3Client } = require("@aws-sdk/client-s3");

// // const s3Client = new S3Client({ region: "your-region" }); // Replace 'your-region' with your AWS region
// const s3Client = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });
// const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME; // Replace with your S3 bucket name

// // const multerS3Uploader = multer({
// //   storage: multerS3({
// //     s3: s3Client,
// //     bucket: BUCKET_NAME,
// //     // acl: "public-read", // Optional: Set access permissions
// //     key: (req, file, cb) => {
// //       const fileName = `parentCategory/${Date.now()}-${file.originalname}`;
// //       cb(null, fileName); // Unique file name in the bucket
// //     },
// //     contentType: multerS3.AUTO_CONTENT_TYPE, // Automatically set content type
// //   }),
// //   limits: {
// //     fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
// //   },
// //   fileFilter: (req, file, cb) => {
// //     const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
// //     if (allowedMimeTypes.includes(file.mimetype)) {
// //       cb(null, true);
// //     } else {
// //       cb(new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed."));
// //     }
// //   },
// // });
// //     UPDATED VERSION OF MULTER S3 UPLOADS
// const multerS3Uploader = multer({
//   storage: multerS3({
//     s3: s3Client,
//     bucket: BUCKET_NAME,
//     key: (req, file, cb) => {
//       // Use the existing image key if updating
//       if (req.params && req.params.id) {
//         const fileName = `parentCategory/${req.params.id}-${file.originalname}`;
//         cb(null, fileName);
//       } else {
//         // New upload
//         const fileName = `parentCategory/${Date.now()}-${file.originalname}`;
//         cb(null, fileName);
//       }
//     },
//     contentType: multerS3.AUTO_CONTENT_TYPE,
//   }),
//   limits: {
//     fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
//     if (allowedMimeTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed."));
//     }
//   },
// });

// module.exports = multerS3Uploader;
