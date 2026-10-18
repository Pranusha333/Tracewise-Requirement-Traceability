import * as impactAnalysisService from '../services/impactAnalysisService.js';

export async function analyzeImpact(request, response) {
  response.json({ analysis: await impactAnalysisService.analyzeImpact(request.body, request.user.workspaceId) });
}

export async function saveImpactAnalysis(request, response) {
  response.status(201).json({ analysis: await impactAnalysisService.saveImpactAnalysis(request.body, request.user.workspaceId) });
}

export async function listImpactAnalyses(request, response) {
  response.json({ analyses: await impactAnalysisService.listImpactAnalyses(request.query.requirementId, request.user.workspaceId) });
}

export async function countImpactAnalyses(request, response) {
  response.json({ total: await impactAnalysisService.countImpactAnalyses(request.user.workspaceId) });
}

export async function getImpactAnalysis(request, response) {
  response.json({ analysis: await impactAnalysisService.getImpactAnalysis(request.params.id, request.user.workspaceId) });
}

export async function deleteImpactAnalysis(request, response) {
  const analysis = await impactAnalysisService.deleteImpactAnalysis(request.params.id, request.user.workspaceId);
  response.json({ message: 'The saved impact analysis was deleted.', analysisId: String(analysis._id) });
}
