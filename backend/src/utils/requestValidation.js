import ApiError from './ApiError.js';

export function assertObjectInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'Request body must be a JSON object.');
  }
}
