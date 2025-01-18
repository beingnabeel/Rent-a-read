import asyncHandler from 'express-async-handler';
import { uploadToS3 } from '../utils/s3Uploader.js';
import eBookLibrary from '../models/ebookpdfSchema.js';
import logger from '../utils/logger.js';
import { EBOOK_ERRORS, STATUS_CODES } from '../utils/constant.js';
import ErrorResponse from '../utils/errorResponse.js';
import dotenv from 'dotenv';
dotenv.config();

// @desc    Create a new eBook with PDF and thumbnail upload to S3
// @route   POST /api/ebook/createEbook
// @access  Private
const createEbook = asyncHandler(async (req, res, next) => {
    const { title, description, CategoryId, author, publisher, Isbn, languageId, series, minAge, maxAge } = req.body;
  
    // Ensure both files (thumbnail and PDF) are uploaded
    if (!req.files || !req.files.thumbnailUrl || !req.files.pdfUrl) {
      return next(new ErrorResponse(STATUS_CODES.BAD_REQUEST, EBOOK_ERRORS.NO_FILES_FOUND));
    }
  
    try {
      const thumbnailUrl = await uploadToS3(req.files.thumbnailUrl[0], 'ebooks/thumbnails');
      const pdfUrl = await uploadToS3(req.files.pdfUrl[0], 'ebooks/pdf');
  
      const ebook = await eBookLibrary.create({
        title,
        description,
        CategoryId,
        author,
        publisher,
        Isbn,
        languageId,
        series,
        thumbnailUrl,
        pdfUrl,
        minAge,
        maxAge,
      });
  
      res.status(STATUS_CODES.CREATED).json({
        success: true,
        message: EBOOK_ERRORS.EBOOK_CREATED,
        ebook,
      });
    } catch (error) {
      logger.error(`Error creating eBook: ${error.message}`);
      next(new ErrorResponse(STATUS_CODES.SERVER_ERROR, 'eBook creation failed'));
    }
});
  
// @desc    Get all eBooks
// @route   GET /api/ebook
// @access  Public
const getAllEbooks = asyncHandler(async (req, res, next) => {
  try {
    logger.info(`Fetching all eBooks`);

    // Use advancedResults if it exists
    if (res.advancedResults) {
        return res.status(STATUS_CODES.OK).json(res.advancedResults);
    }

    // Fallback logic if advancedResults is not used
    const ebooks = await eBookLibrary.find()

    res.status(STATUS_CODES.OK).json({
      success: true,
      count: ebooks.length,
      data: ebooks,
    });
  } catch (error) {
    logger.error(`Error fetching eBooks: ${error.message}`);
    next(new ErrorResponse(STATUS_CODES.SERVER_ERROR, EBOOK_ERRORS.EBOOKS_FETCH_ERROR));
  }
});

// @desc    Get a single eBook by ID
// @route   GET /api/ebook/:id
// @access  Public
const getEbookById = asyncHandler(async (req, res, next) => {
  try {
    const id = req.params.id;
    logger.info(`Fetching eBook with ID: ${id}`);

    const ebook = await eBookLibrary.findById(id).populate('CategoryId languageId');

    if (!ebook) {
      return next(new ErrorResponse(STATUS_CODES.NOT_FOUND, EBOOK_ERRORS.EBOOK_NOT_FOUND));
    }

    res.status(STATUS_CODES.OK).json({
      success: true,
      ebook,
    });
  } catch (error) {
    logger.error(`Error fetching eBook: ${error.message}`);
    next(new ErrorResponse(STATUS_CODES.SERVER_ERROR, EBOOK_ERRORS.EBOOK_FETCH_ERROR));
  }
});

// @desc    Update an eBook
// @route   PUT /api/ebook/:id
// @access  Private
// @desc    Update an eBook
// @route   PUT /api/ebook/:id
// @access  Private
const updateEbook = asyncHandler(async (req, res, next) => {
    try {
      const id = req.params.id;
      let updates = req.body;
  
      // Ensure files are correctly uploaded
      if (req.files) {
        if (req.files.thumbnailUrl && req.files.thumbnailUrl[0]) {
          try {
            logger.info(`Uploading thumbnail for eBook ID: ${id}`);
            const thumbnailUrl = await uploadToS3(req.files.thumbnailUrl[0], 'ebooks/thumbnails');
            updates.thumbnailUrl = thumbnailUrl;
            logger.debug(`New Thumbnail URL: ${thumbnailUrl}`);
          } catch (uploadError) {
            logger.error(`Error uploading thumbnail to S3: ${uploadError.message}`);
            return next(
              new ErrorResponse(STATUS_CODES.SERVER_ERROR, EBOOK_ERRORS.THUMBNAIL_UPLOAD_ERROR)
            );
          }
        }
        
        if (req.files.pdfUrl && req.files.pdfUrl[0]) {
          try {
            logger.info(`Uploading PDF for eBook ID: ${id}`);
            const pdfUrl = await uploadToS3(req.files.pdfUrl[0], 'ebooks/pdf');
            updates.pdfUrl = pdfUrl;
            logger.debug(`New PDF URL: ${pdfUrl}`);
          } catch (uploadError) {
            logger.error(`Error uploading PDF to S3: ${uploadError.message}`);
            return next(
              new ErrorResponse(STATUS_CODES.SERVER_ERROR, EBOOK_ERRORS.PDF_UPLOAD_ERROR)
            );
          }
        }
      }
  
      // Update the eBook in the database
      const ebook = await eBookLibrary.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      });
  
      if (!ebook) {
        logger.error(`eBook not found with ID: ${id}`);
        return next(new ErrorResponse(STATUS_CODES.NOT_FOUND, EBOOK_ERRORS.EBOOK_NOT_FOUND));
      }
  
      logger.info(`eBook updated successfully with ID: ${id}`);
      res.status(STATUS_CODES.OK).json({
        success: true,
        message: EBOOK_ERRORS.EBOOK_UPDATED,
        ebook,
      });
    } catch (error) {
      logger.error(`Error updating eBook: ${error.message}`);
      next(new ErrorResponse(STATUS_CODES.SERVER_ERROR, EBOOK_ERRORS.EBOOK_UPDATE_ERROR));
    }
});

// @desc    Soft delete an eBook (update status to INACTIVE)
// @route   DELETE /api/ebook/:id
// @access  Private
const deleteEbook = asyncHandler(async (req, res, next) => {
  try {
    const id = req.params.id;
    logger.info(`Deleting eBook with ID: ${id}`);

    // Find the eBook by ID and delete it permanently
    const ebook = await eBookLibrary.findByIdAndDelete(id);

    if (!ebook) {
      return next(new ErrorResponse(STATUS_CODES.NOT_FOUND, EBOOK_ERRORS.EBOOK_NOT_FOUND));
    }

    res.status(STATUS_CODES.OK).json({
      success: true,
      message: 'eBook deleted successfully.',
    });
  } catch (error) {
    logger.error(`Error deleting eBook: ${error.message}`);
    next(new ErrorResponse(STATUS_CODES.SERVER_ERROR, 'Error deleting eBook.'));
  }
});

// Export all controllers
export {
  createEbook,
  getAllEbooks,
  getEbookById,
  updateEbook,
  deleteEbook,
};
