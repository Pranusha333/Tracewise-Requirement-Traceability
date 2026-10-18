import { Router } from 'express';
import * as controller from '../controllers/traceabilityController.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();
router.get('/', asyncHandler(controller.getTraceabilityData));
export default router;
