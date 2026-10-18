import * as aiAssistantService from '../services/aiAssistantService.js';

export async function ask(request, response) {
  response.json({ result: await aiAssistantService.answerProjectQuestion(request.body, request.user.workspaceId) });
}

export async function analyze(request, response) {
  response.json({ analysis: await aiAssistantService.analyzeAssistant(request.body, request.user.workspaceId) });
}

export async function saveAnalysis(request, response) {
  response.status(201).json({ analysis: await aiAssistantService.saveAssistantAnalysis(request.body, request.user.workspaceId) });
}

export async function listAnalyses(request, response) {
  response.json({ analyses: await aiAssistantService.listAssistantAnalyses(request.query.requirementId, request.user.workspaceId) });
}

export async function getAnalysis(request, response) {
  response.json({ analysis: await aiAssistantService.getAssistantAnalysis(request.params.id, request.user.workspaceId) });
}

export async function updateRecommendation(request, response) {
  response.json({ analysis: await aiAssistantService.updateRecommendation(request.params.id, request.params.recommendationId, request.body, request.user.workspaceId) });
}
