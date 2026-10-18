import { apiRequest as request } from './apiClient.js';

function normalizeRequirement(requirement) {
  return { ...requirement, id: requirement.requirementId };
}

export async function getRequirements() {
  const { requirements } = await request('/requirements');
  return requirements.map(normalizeRequirement);
}

export async function createRequirement(values) {
  const { requirement } = await request('/requirements', {
    method: 'POST',
    body: JSON.stringify(values),
  });
  return normalizeRequirement(requirement);
}

export async function updateRequirement(id, values) {
  const { requirement } = await request(`/requirements/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(values),
  });
  return normalizeRequirement(requirement);
}

export async function deleteRequirement(id) {
  return request(`/requirements/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
