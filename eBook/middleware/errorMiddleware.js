import logger from '../utils/logger.js';
import ErrorResponse from '../utils/errorResponse.js';

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode; // Default to 500 for other errors
  let message = err.message || 'Internal Server Error'; // Use a fallback message

  // Handle specific error types
  if (err instanceof ErrorResponse) {
      statusCode = err.statusCode;
      message = err.message;
  } else if (err.name === 'CastError' && err.kind === 'ObjectId') {
      statusCode = 404;
      message = 'Resource not found';
  }

  // Log the error
  logger.error(`Error ${statusCode}: ${message}: ${err.stack}`);

  res.status(statusCode).json({
      success: false,
      // status: statusCode,
      message: message,
      stack: process.env.NODE_ENV === 'production' ? null : err.stack, // Show stack trace only in development
  });
};

export { notFound, errorHandler };