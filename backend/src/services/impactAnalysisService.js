import ImpactAnalysis from '../models/ImpactAnalysis.js';
import Requirement from '../models/Requirement.js';
import TestCase from '../models/TestCase.js';
import TraceabilityRelationship from '../models/TraceabilityRelationship.js';
import ApiError from '../utils/ApiError.js';
import { normalizeRequirementId, resolveRequirementId } from '../utils/requirementIds.js';
import { assertObjectInput } from '../utils/requestValidation.js';

function validateInput(input) {
  assertObjectInput(input);
  const requirementId = normalizeRequirementId(input.requirementId);
  if (typeof input.proposedChange !== 'string' || !input.proposedChange.trim()) throw new ApiError(400, 'Enter the proposed requirement change.');
  if (input.proposedChange.trim().length > 4000) throw new ApiError(400, 'The proposed change must be 4000 characters or fewer.');
  return { requirementId, proposedChange: input.proposedChange.trim() };
}

function getImpactNeighbors(requirementId, relationships) {
  const neighbors = [];
  for (const relationship of relationships) {
    const { fromRequirementId, toRequirementId, relationshipType } = relationship;
    if (relationshipType === 'Related To') {
      if (fromRequirementId === requirementId) neighbors.push({ requirementId: toRequirementId, relationship });
      else if (toRequirementId === requirementId) neighbors.push({ requirementId: fromRequirementId, relationship });
    } else if (toRequirementId === requirementId) {
      // A change to a dependency or specification affects the requirement that depends on or implements it.
      neighbors.push({ requirementId: fromRequirementId, relationship });
    }
  }
  return neighbors;
}

function makeReason(changedId, affectedId, relationship) {
  if (relationship.relationshipType === 'Related To') {
    return `${changedId} is related to ${affectedId}; a change to one may require reviewing the other.`;
  }
  return `${relationship.fromRequirementId} ${relationship.relationshipType.toLowerCase()} ${relationship.toRequirementId}; a change to ${changedId} may affect ${affectedId}.`;
}

export async function analyzeImpact(input, workspaceId) {
  const { requirementId: requestedId, proposedChange } = validateInput(input);
  const requirementId = await resolveRequirementId(requestedId, workspaceId);
  const [rootRequirement, requirements, relationships, testCases] = await Promise.all([
    Requirement.findOne({ requirementId, workspaceId }).lean(),
    Requirement.find({ workspaceId }).select('requirementId title').lean(),
    TraceabilityRelationship.find({ workspaceId }).lean(),
    TestCase.find({ workspaceId }).lean(),
  ]);
  if (!rootRequirement) throw new ApiError(404, `Requirement ${requirementId} was not found.`);

  const requirementById = new Map(requirements.map((item) => [item.requirementId, item]));
  const seen = new Set([requirementId]);
  const queue = [{ requirementId, level: 0 }];
  const nodes = [{ requirementId, title: rootRequirement.title, level: 0 }];
  const edges = [];
  const directImpacts = [];
  const indirectImpacts = [];
  const paths = new Map([[requirementId, [requirementId]]]);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const neighbor of getImpactNeighbors(current.requirementId, relationships)) {
      if (seen.has(neighbor.requirementId)) continue;
      const affectedRequirement = requirementById.get(neighbor.requirementId);
      if (!affectedRequirement) continue;

      seen.add(neighbor.requirementId);
      const level = current.level + 1;
      queue.push({ requirementId: neighbor.requirementId, level });
      nodes.push({ requirementId: neighbor.requirementId, title: affectedRequirement.title, level });
      edges.push({ fromRequirementId: current.requirementId, toRequirementId: neighbor.requirementId, relationshipType: neighbor.relationship.relationshipType });

      const impactPath = [...paths.get(current.requirementId), neighbor.requirementId];
      const reason = `${makeReason(current.requirementId, neighbor.requirementId, neighbor.relationship)} Impact path from ${requirementId}: ${impactPath.join(' → ')}.`;
      const impact = { requirementId: neighbor.requirementId, title: affectedRequirement.title, relationshipType: neighbor.relationship.relationshipType, reason, level };
      if (level === 1) directImpacts.push(impact);
      else indirectImpacts.push(impact);
      paths.set(neighbor.requirementId, impactPath);
    }
  }

  const impactedIds = new Set(seen);
  const affectedTestCases = testCases
    .filter((testCase) => testCase.requirementIds.some((id) => impactedIds.has(id)))
    .map((testCase) => {
      const affectedLinks = testCase.requirementIds.filter((id) => impactedIds.has(id));
      const explanations = affectedLinks.map((id) => id === requirementId
        ? `${id} is the selected requirement`
        : `${id} is affected through ${paths.get(id).join(' → ')}`);
      return {
        testCaseId: testCase.testCaseId,
        title: testCase.title,
        description: testCase.description,
        requirementIds: affectedLinks,
        reason: `Linked to ${explanations.join('; ')}.`,
      };
    })
    .sort((left, right) => left.testCaseId.localeCompare(right.testCaseId));

  return {
    requirementId,
    requirementTitle: rootRequirement.title,
    requirementDescription: rootRequirement.description,
    proposedChange,
    directImpacts,
    indirectImpacts,
    affectedTestCases,
    graph: { nodes, edges },
    counts: { affectedRequirements: directImpacts.length + indirectImpacts.length, affectedTestCases: affectedTestCases.length },
  };
}

export async function saveImpactAnalysis(input, workspaceId) {
  return ImpactAnalysis.create({ ...await analyzeImpact(input, workspaceId), workspaceId });
}

export async function listImpactAnalyses(requirementId, workspaceId) {
  const resolvedId = requirementId ? await resolveRequirementId(requirementId, workspaceId) : undefined;
  const filter = { workspaceId, assistant: { $exists: false }, ...(resolvedId ? { requirementId: resolvedId } : {}) };
  return ImpactAnalysis.find(filter).sort({ createdAt: -1 }).limit(30).lean();
}

export async function countImpactAnalyses(workspaceId) {
  return ImpactAnalysis.countDocuments({ workspaceId, assistant: { $exists: false } });
}

export async function getImpactAnalysis(id, workspaceId) {
  const analysis = await ImpactAnalysis.findOne({ _id: id, workspaceId, assistant: { $exists: false } }).lean();
  if (!analysis) throw new ApiError(404, 'The saved impact analysis was not found.');
  return analysis;
}

export async function deleteImpactAnalysis(id, workspaceId) {
  const analysis = await ImpactAnalysis.findOneAndDelete({ _id: id, workspaceId, assistant: { $exists: false } });
  if (!analysis) throw new ApiError(404, 'The saved impact analysis was not found.');
  return analysis;
}
