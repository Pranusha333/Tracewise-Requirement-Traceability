import Counter from '../models/Counter.js';
import Requirement from '../models/Requirement.js';
import TestCase from '../models/TestCase.js';
import TraceabilityRelationship from '../models/TraceabilityRelationship.js';
import ApiError from '../utils/ApiError.js';
import { normalizeRequirementId, resolveRequirementId } from '../utils/requirementIds.js';
import { assertObjectInput } from '../utils/requestValidation.js';

const relationshipTypes = ['Depends On', 'Related To', 'Implements'];
const testCaseFields = ['title', 'description', 'requirementIds'];

async function ensureRequirementsExist(requirementIds, workspaceId) {
  const resolved = await Promise.all(requirementIds.map((id) => resolveRequirementId(id, workspaceId)));
  const uniqueIds = [...new Set(resolved)];
  const existing = await Requirement.find({ workspaceId, requirementId: { $in: uniqueIds } }).select('requirementId').lean();
  const found = new Set(existing.map(({ requirementId }) => requirementId));
  const missing = uniqueIds.filter((id) => !found.has(id));
  if (missing.length) throw new ApiError(404, `Requirement${missing.length > 1 ? 's' : ''} ${missing.join(', ')} ${missing.length > 1 ? 'were' : 'was'} not found.`, { requirementIds: missing });
  return uniqueIds;
}

function validateRelationship(input) {
  assertObjectInput(input);
  const fromRequirementId = normalizeRequirementId(input.fromRequirementId, 'Source requirement ID');
  const toRequirementId = normalizeRequirementId(input.toRequirementId, 'Related requirement ID');
  if (fromRequirementId === toRequirementId) throw new ApiError(400, 'A requirement cannot be linked to itself.');
  if (!relationshipTypes.includes(input.relationshipType)) throw new ApiError(400, `relationshipType must be one of: ${relationshipTypes.join(', ')}.`);
  return { fromRequirementId, toRequirementId, relationshipType: input.relationshipType };
}

function validateTestCase(input, { allowNoRequirementLinks = false } = {}) {
  assertObjectInput(input);
  const missingFields = testCaseFields.filter((field) => field === 'requirementIds'
    ? !Array.isArray(input[field]) || (!allowNoRequirementLinks && input[field].length === 0)
    : typeof input[field] !== 'string' || !input[field].trim());
  if (missingFields.length) throw new ApiError(400, 'Complete the test case title, description, and linked requirements.', { missingFields });
  if (input.title.trim().length > 160) throw new ApiError(400, 'Test case title must be 160 characters or fewer.');
  if (input.description.trim().length > 4000) throw new ApiError(400, 'Test case description must be 4000 characters or fewer.');
  const requirementIds = [...new Set(input.requirementIds.map((id) => normalizeRequirementId(id)))];
  return { title: input.title.trim(), description: input.description.trim(), requirementIds };
}

async function generateTestCaseId() {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'test-cases' },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return `TC-${String(counter.sequence).padStart(3, '0')}`;
}

export async function getTraceabilityData(workspaceId) {
  const [requirements, relationships, testCases] = await Promise.all([
    Requirement.find({ workspaceId }).lean(),
    TraceabilityRelationship.find({ workspaceId }).sort({ createdAt: 1 }).lean(),
    TestCase.find({ workspaceId }).sort({ testCaseId: 1 }).lean(),
  ]);
  requirements.sort((left, right) => {
    const leftNumber = BigInt(left.requirementId.slice(4));
    const rightNumber = BigInt(right.requirementId.slice(4));
    return leftNumber < rightNumber ? -1 : leftNumber > rightNumber ? 1 : left.requirementId.localeCompare(right.requirementId);
  });
  return { requirements, relationships, testCases };
}

export async function listRelationships(workspaceId) {
  return TraceabilityRelationship.find({ workspaceId }).sort({ createdAt: 1 }).lean();
}

export async function getRelationship(id, workspaceId) {
  const relationship = await TraceabilityRelationship.findOne({ _id: id, workspaceId }).lean();
  if (!relationship) throw new ApiError(404, 'The requirement relationship was not found.');
  return relationship;
}

export async function createRelationship(input, workspaceId) {
  const values = validateRelationship(input);
  [values.fromRequirementId, values.toRequirementId] = await ensureRequirementsExist([values.fromRequirementId, values.toRequirementId], workspaceId);
  if (await TraceabilityRelationship.exists({ workspaceId, fromRequirementId: values.fromRequirementId, toRequirementId: values.toRequirementId })) {
    throw new ApiError(409, 'These requirements are already linked.');
  }
  return TraceabilityRelationship.create({ ...values, workspaceId });
}

export async function updateRelationship(id, input, workspaceId) {
  const values = validateRelationship(input);
  [values.fromRequirementId, values.toRequirementId] = await ensureRequirementsExist([values.fromRequirementId, values.toRequirementId], workspaceId);
  const relationship = await TraceabilityRelationship.findOne({ _id: id, workspaceId });
  if (!relationship) throw new ApiError(404, 'The requirement relationship was not found.');
  if (await TraceabilityRelationship.exists({ _id: { $ne: id }, workspaceId, fromRequirementId: values.fromRequirementId, toRequirementId: values.toRequirementId })) {
    throw new ApiError(409, 'These requirements are already linked.');
  }
  Object.assign(relationship, values);
  return relationship.save();
}

export async function deleteRelationship(id, workspaceId) {
  const relationship = await TraceabilityRelationship.findOneAndDelete({ _id: id, workspaceId });
  if (!relationship) throw new ApiError(404, 'The requirement relationship was not found.');
  return relationship;
}

export async function listTestCases(workspaceId) {
  return TestCase.find({ workspaceId }).sort({ testCaseId: 1 }).lean();
}

export async function getTestCase(id, workspaceId) {
  const testCase = await TestCase.findOne({ _id: id, workspaceId }).lean();
  if (!testCase) throw new ApiError(404, 'The test case was not found.');
  return testCase;
}

export async function createTestCase(input, workspaceId) {
  const values = validateTestCase(input);
  values.requirementIds = await ensureRequirementsExist(values.requirementIds, workspaceId);
  return TestCase.create({ ...values, testCaseId: await generateTestCaseId(), workspaceId });
}

export async function updateTestCase(id, input, workspaceId) {
  const values = validateTestCase(input, { allowNoRequirementLinks: true });
  values.requirementIds = await ensureRequirementsExist(values.requirementIds, workspaceId);
  const testCase = await TestCase.findOneAndUpdate({ _id: id, workspaceId }, { $set: values }, { new: true, runValidators: true });
  if (!testCase) throw new ApiError(404, 'The test case was not found.');
  return testCase;
}

export async function unlinkTestCaseRequirement(id, requirementId, workspaceId) {
  const [storedRequirementId] = await ensureRequirementsExist([requirementId], workspaceId);
  const testCase = await TestCase.findOneAndUpdate(
    { _id: id, workspaceId, requirementIds: storedRequirementId },
    { $pull: { requirementIds: storedRequirementId } },
    { new: true, runValidators: true },
  ).lean();
  if (!testCase) throw new ApiError(404, 'That requirement is not linked to this test case. Refresh and try again.');
  return testCase;
}

export async function deleteTestCase(id, workspaceId) {
  const testCase = await TestCase.findOneAndDelete({ _id: id, workspaceId });
  if (!testCase) throw new ApiError(404, 'The test case was not found.');
  return testCase;
}
