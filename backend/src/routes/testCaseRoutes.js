import { Router } from 'express';
import * as controller from '../controllers/traceabilityController.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();
router.route('/').get(asyncHandler(controller.getTestCases)).post(asyncHandler(controller.createTestCase));
router.delete('/:id/requirements/:requirementId', asyncHandler(controller.unlinkTestCaseRequirement));
router.route('/:id').get(asyncHandler(controller.getTestCase)).put(asyncHandler(controller.updateTestCase)).delete(asyncHandler(controller.deleteTestCase));
export default router;
