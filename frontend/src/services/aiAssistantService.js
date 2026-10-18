import { apiRequest as request } from './apiClient.js';

export async function analyzeAssistant(values) {
  const { analysis } = await request('/ai-assistant/analyze', { method: 'POST', body: JSON.stringify(values) });
  return analysis;
}

export async function askAssistant(question) {
  const { result } = await request('/ai-assistant/ask', { method: 'POST', body: JSON.stringify({ question }) });
  return result;
}

export async function saveAssistantAnalysis(values) {
  const { analysis } = await request('/ai-assistant/analyses', { method: 'POST', body: JSON.stringify(values) });
  return analysis;
}

export async function getAssistantAnalyses(requirementId) {
  const query = requirementId ? `?requirementId=${encodeURIComponent(requirementId)}` : '';
  const { analyses } = await request(`/ai-assistant/analyses${query}`);
  return analyses;
}

export async function getAssistantAnalysis(id) {
  const { analysis } = await request(`/ai-assistant/analyses/${encodeURIComponent(id)}`);
  return analysis;
}

export async function reviewRecommendation(analysisId, recommendationId, values) {
  const { analysis } = await request(`/ai-assistant/analyses/${encodeURIComponent(analysisId)}/recommendations/${encodeURIComponent(recommendationId)}`, {
    method: 'PATCH',
    body: JSON.stringify(values),
  });
  return analysis;
}
