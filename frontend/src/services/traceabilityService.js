import { apiRequest as request } from './apiClient.js';

export async function getTraceabilityData() {
  return request('/traceability');
}

export async function saveRelationship(values, id) {
  const path = id ? `/relationships/${encodeURIComponent(id)}` : '/relationships';
  const { relationship } = await request(path, { method: id ? 'PUT' : 'POST', body: JSON.stringify(values) });
  return relationship;
}

export async function removeRelationship(id) {
  return request(`/relationships/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function saveTestCase(values, id) {
  const path = id ? `/test-cases/${encodeURIComponent(id)}` : '/test-cases';
  const { testCase } = await request(path, { method: id ? 'PUT' : 'POST', body: JSON.stringify(values) });
  return testCase;
}

export async function removeTestCase(id) {
  return request(`/test-cases/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function unlinkTestCaseRequirement(testCaseId, requirementId) {
  return request(`/test-cases/${encodeURIComponent(testCaseId)}/requirements/${encodeURIComponent(requirementId)}`, { method: 'DELETE' });
}
