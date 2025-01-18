import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import logger from './logger.js';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

export const uploadToS3 = async (file, folder) => {
  try {
    const fileKey = `${folder}/${Date.now()}-${file.originalname}`;
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    // logger.info(`Uploading to S3 with key: ${fileKey}`);
    // logger.debug(`S3 Upload Params: ${JSON.stringify(uploadParams)}`);

    await s3.send(new PutObjectCommand(uploadParams));

    const imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
    logger.info(`File uploaded successfully to S3: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    logger.error(`Error uploading file to S3: ${error.message}, Stack: ${error.stack}`);
    throw new Error('Failed to upload file to S3');
  }
};
