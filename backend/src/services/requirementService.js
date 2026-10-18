import Counter from '../models/Counter.js';
import Requirement from '../models/Requirement.js';
import TestCase from '../models/TestCase.js';
import TraceabilityRelationship from '../models/TraceabilityRelationship.js';
import ApiError from '../utils/ApiError.js';
import { resolveRequirementId } from '../utils/requirementIds.js';
import { assertObjectInput } from '../utils/requestValidation.js';

const editableFields = ['title', 'description', 'type', 'priority', 'status'];
const allowedValues = {
  type: ['Functional', 'Non-functional'],
  priority: ['Low', 'Medium', 'High', 'Critical'],
  status: ['Draft', 'Approved', 'In Progress', 'Completed'],
};

function validateRequirement(input) {
  assertObjectInput(input);

  const missingFields = editableFields.filter((field) => typeof input[field] !== 'string' || !input[field].trim());
  if (missingFields.length) {
    throw new ApiError(400, 'Complete all required requirement fields.', { missingFields });
  }

  for (const [field, choices] of Object.entries(allowedValues)) {
    if (!choices.includes(input[field])) {
      throw new ApiError(400, `${field} must be one of: ${choices.join(', ')}.`, { field, allowedValues: choices });
    }
  }

  return Object.fromEntries(editableFields.map((field) => [field, input[field].trim()]));
}

async function generateRequirementId() {
  // Reconcile legacy/manual IDs on every create so a stale counter cannot reuse an ID.
  const existing = await Requirement.find({ requirementId: /^REQ-\d+$/i }).select('requirementId').lean();
  const highestExisting = existing.reduce((highest, item) => {
    const suffix = BigInt(item.requirementId.slice(4));
    if (suffix > BigInt(Number.MAX_SAFE_INTEGER)) throw new ApiError(409, 'A legacy requirement ID exceeds the supported sequence range. Resolve it before creating more requirements.');
    return Math.max(highest, Number(suffix));
  }, 0);
  try {
    await Counter.updateOne({ _id: 'requirements' }, { $max: { sequence: highestExisting } }, { upsert: true });
  } catch (error) {
    // Concurrent first-time requests can race while inserting the shared counter.
    if (error.code !== 11000) throw error;
  }

  const counter = await Counter.findOneAndUpdate(
    { _id: 'requirements' },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return `REQ-${String(counter.sequence).padStart(5, '0')}`;
}

export async function listRequirements(workspaceId) {
  return Requirement.find({ workspaceId }).sort({ updatedAt: -1, requirementId: 1 }).lean();
}

export async function getRequirement(requirementId, workspaceId) {
  const normalizedId = await resolveRequirementId(requirementId, workspaceId);
  const requirement = await Requirement.findOne({ requirementId: normalizedId, workspaceId }).lean();
  if (!requirement) throw new ApiError(404, `Requirement ${normalizedId} was not found.`);
  return requirement;
}

export async function createRequirement(input, workspaceId) {
  const values = validateRequirement(input);
  if (Object.hasOwn(input, 'requirementId')) throw new ApiError(400, 'Requirement IDs are generated automatically. Remove requirementId from the request.');
  const requirementId = await generateRequirementId();

  return Requirement.create({ ...values, requirementId, workspaceId });
}

export async function updateRequirement(requirementId, input, workspaceId) {
  const normalizedId = await resolveRequirementId(requirementId, workspaceId);
  const values = validateRequirement(input);
  const requirement = await Requirement.findOneAndUpdate(
    { requirementId: normalizedId, workspaceId },
    { $set: values },
    { new: true, runValidators: true },
  );
  if (!requirement) throw new ApiError(404, `Requirement ${normalizedId} was not found.`);
  return requirement;
}

export async function deleteRequirement(requirementId, workspaceId) {
  const normalizedId = await resolveRequirementId(requirementId, workspaceId);
  const requirement = await Requirement.findOne({ requirementId: normalizedId, workspaceId }).lean();
  if (!requirement) throw new ApiError(404, `Requirement ${normalizedId} was not found.`);

  // Remove the deleted requirement from links, but keep test cases as records.
  await TestCase.updateMany({ workspaceId, requirementIds: normalizedId }, { $pull: { requirementIds: normalizedId } });
  await TraceabilityRelationship.deleteMany({ workspaceId, $or: [{ fromRequirementId: normalizedId }, { toRequirementId: normalizedId }] });

  const deletedRequirement = await Requirement.findOneAndDelete({ requirementId: normalizedId, workspaceId });
  if (!deletedRequirement) throw new ApiError(409, `Requirement ${normalizedId} changed while it was being deleted. Refresh and try again.`);
  return deletedRequirement;
}
