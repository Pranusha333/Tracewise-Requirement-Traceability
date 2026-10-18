import { apiRequest as request } from './apiClient.js';

export async function analyzeImpact(values) {
  const { analysis } = await request('/impact-analyses/analyze', { method: 'POST', body: JSON.stringify(values) });
  return analysis;
}

export async function saveImpactAnalysis(values) {
  const { analysis } = await request('/impact-analyses', { method: 'POST', body: JSON.stringify(values) });
  return analysis;
}

export async function getImpactAnalyses() {
  const { analyses } = await request('/impact-analyses');
  return analyses;
}

export async function getImpactAnalysisCount() {
  const { total } = await request('/impact-analyses/summary');
  return total;
}

export async function getImpactAnalysis(id) {
  const { analysis } = await request(`/impact-analyses/${encodeURIComponent(id)}`);
  return analysis;
}

export async function deleteImpactAnalysis(id) {
  return request(`/impact-analyses/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
