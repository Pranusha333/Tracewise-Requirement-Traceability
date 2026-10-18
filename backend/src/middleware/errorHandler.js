import ApiError from '../utils/ApiError.js';

export function notFound(request, _response, next) {
  next(new ApiError(404, `Route not found: ${request.method} ${request.originalUrl}`));
}

export function errorHandler(error, _request, response, _next) {
  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || 'An unexpected server error occurred.';
  let details = error.details;

  if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Request body must contain valid JSON.';
  } else if (error.code === 11000 && error.keyPattern?.requirementId) {
    statusCode = 409;
    message = 'That requirement ID already exists. Choose another ID or leave it blank to generate one.';
  } else if (error.code === 11000) {
    statusCode = 409;
    message = 'A record with those details already exists.';
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'The submitted record contains invalid fields.';
    details = Object.values(error.errors).map((item) => item.message);
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'A request field has an invalid value.';
  }

  if (statusCode >= 500) console.error(error);
  response.status(statusCode).json({ error: { message, ...(details ? { details } : {}) } });
}
