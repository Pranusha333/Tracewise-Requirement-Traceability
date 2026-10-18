import { Router } from 'express';
import * as controller from '../controllers/requirementController.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();

router.route('/')
  .get(asyncHandler(controller.getRequirements))
  .post(asyncHandler(controller.createRequirement));

router.route('/:id')
  .get(asyncHandler(controller.getRequirement))
  .put(asyncHandler(controller.updateRequirement))
  .delete(asyncHandler(controller.deleteRequirement));

export default router;
