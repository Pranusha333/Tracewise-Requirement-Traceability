import * as traceabilityService from '../services/traceabilityService.js';

export async function getTraceabilityData(request, response) {
  response.json(await traceabilityService.getTraceabilityData(request.user.workspaceId));
}

export async function getRelationships(request, response) {
  response.json({ relationships: await traceabilityService.listRelationships(request.user.workspaceId) });
}

export async function getRelationship(request, response) {
  response.json({ relationship: await traceabilityService.getRelationship(request.params.id, request.user.workspaceId) });
}

export async function createRelationship(request, response) {
  response.status(201).json({ relationship: await traceabilityService.createRelationship(request.body, request.user.workspaceId) });
}

export async function updateRelationship(request, response) {
  response.json({ relationship: await traceabilityService.updateRelationship(request.params.id, request.body, request.user.workspaceId) });
}

export async function deleteRelationship(request, response) {
  const relationship = await traceabilityService.deleteRelationship(request.params.id, request.user.workspaceId);
  response.json({ message: 'The relationship was removed.', relationshipId: relationship._id });
}

export async function getTestCases(request, response) {
  response.json({ testCases: await traceabilityService.listTestCases(request.user.workspaceId) });
}

export async function getTestCase(request, response) {
  response.json({ testCase: await traceabilityService.getTestCase(request.params.id, request.user.workspaceId) });
}

export async function createTestCase(request, response) {
  response.status(201).json({ testCase: await traceabilityService.createTestCase(request.body, request.user.workspaceId) });
}

export async function updateTestCase(request, response) {
  response.json({ testCase: await traceabilityService.updateTestCase(request.params.id, request.body, request.user.workspaceId) });
}

export async function unlinkTestCaseRequirement(request, response) {
  const testCase = await traceabilityService.unlinkTestCaseRequirement(request.params.id, request.params.requirementId, request.user.workspaceId);
  response.json({ message: 'The requirement was unlinked. The test case was kept.', testCase });
}

export async function deleteTestCase(request, response) {
  const testCase = await traceabilityService.deleteTestCase(request.params.id, request.user.workspaceId);
  response.json({ message: `${testCase.testCaseId} was deleted.`, testCaseId: testCase.testCaseId });
}
