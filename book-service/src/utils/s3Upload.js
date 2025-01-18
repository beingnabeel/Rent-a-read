const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const multer = require("multer");
const multerS3 = require("multer-s3");
const AppError = require("./appError");
const { v4: uuidv4 } = require("uuid");

// Configure S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// Upload an image to S3
exports.uploadImage = async (key, fileBuffer, mimeType) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  };

  const command = new PutObjectCommand(params);
  await s3Client.send(command);
  return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
};

// Multer upload configuration for S3
// const upload = multer({
//   fileFilter: imageFilter,
//   storage: multerS3({
//     s3: s3Client,
//     bucket: process.env.AWS_S3_BUCKET_NAME,
//     acl: "private",
//     key: function (req, file, cb) {
//       const fileName = `books/${uuidv4()}-${file.originalname}`;
//       cb(null, fileName);
//     },
//   }),
//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5MB file size limit
//   },
// });
// Get a signed URL for an image
exports.getImageSignedUrl = async (key) => {
  if (!key) throw new AppError("Invalid key provided", 400);
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  const command = new GetObjectCommand(params);
  try {
    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    }); // URL expires in 1 hour
    return signedUrl;
  } catch (error) {
    console.error("Error generating signed URL: ", error);
    throw new AppError("Error generating signed URL", 500);
  }
};

// Delete an image from S3
exports.deleteImage = async (key) => {
  const deleteParams = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  // const command = new DeleteObjectCommand(params);
  // await s3Client.send(command);
  try {
    await s3Client.send(new DeleteObjectCommand(deleteParams));
  } catch (err) {
    console.error("Error deleting S3 object:", err);
  }
};
