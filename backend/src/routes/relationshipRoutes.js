import { Router } from 'express';
import * as controller from '../controllers/traceabilityController.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();
router.route('/').get(asyncHandler(controller.getRelationships)).post(asyncHandler(controller.createRelationship));
router.route('/:id').get(asyncHandler(controller.getRelationship)).put(asyncHandler(controller.updateRelationship)).delete(asyncHandler(controller.deleteRelationship));
export default router;
