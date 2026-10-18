import { Router } from 'express';
import * as controller from '../controllers/impactAnalysisController.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();
router.get('/summary', asyncHandler(controller.countImpactAnalyses));
router.get('/', asyncHandler(controller.listImpactAnalyses));
router.post('/analyze', asyncHandler(controller.analyzeImpact));
router.post('/', asyncHandler(controller.saveImpactAnalysis));
router.get('/:id', asyncHandler(controller.getImpactAnalysis));
router.delete('/:id', asyncHandler(controller.deleteImpactAnalysis));
export default router;
