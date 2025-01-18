import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
// import User from '../models/userModels.js';  
import ErrorResponse from '../utils/errorResponse.js';
import logger from '../utils/logger.js';

// Middleware to protect routes
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        logger.warn('User not found for the provided token', { token });
        res.status(401);
        throw new Error('User not found');
      }

      // Validate that req.user._id is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
        logger.warn('Invalid user ID detected', { userId: req.user._id });
        res.status(400);
        throw new Error('Invalid user ID');
      }

      next();
    } catch (error) {
      logger.error('Token verification failed', { error: error.message });
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  } else {
    logger.warn('No token provided in request');
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

  // Middleware to grant access to specific roles
  const authorize = (...roles) => {
    return (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        logger.warn(`Unauthorized access attempt ${ req.user._id,  req.user.role }`);
        return next(
          new ErrorResponse(
            403,
            `User role ${req.user.role} is not authorized to access this route`
          )
        );
      }
      next();
    };
  };


export { protect, authorize };