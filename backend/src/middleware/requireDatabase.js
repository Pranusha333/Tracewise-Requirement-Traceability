import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';

export function requireDatabase(_request, _response, next) {
  if (mongoose.connection.readyState !== 1) {
    return next(new ApiError(503, 'MongoDB is not connected. Configure MONGODB_URI and make sure MongoDB is running.'));
  }
  return next();
}
