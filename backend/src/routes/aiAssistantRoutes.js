import { Router } from 'express';
import * as controller from '../controllers/aiAssistantController.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();
router.post('/ask', asyncHandler(controller.ask));
router.get('/analyses', asyncHandler(controller.listAnalyses));
router.post('/analyze', asyncHandler(controller.analyze));
router.post('/analyses', asyncHandler(controller.saveAnalysis));
router.get('/analyses/:id', asyncHandler(controller.getAnalysis));
router.patch('/analyses/:id/recommendations/:recommendationId', asyncHandler(controller.updateRecommendation));
export default router;
