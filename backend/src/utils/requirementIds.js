import Requirement from '../models/Requirement.js';
import ApiError from './ApiError.js';

const requirementIdPattern = /^REQ-(\d{3,})$/i;

export function normalizeRequirementId(value, fieldName = 'Requirement ID') {
  if (typeof value !== 'string') throw new ApiError(400, `${fieldName} must use the format REQ-00001.`);
  const normalized = value.trim().toUpperCase();
  if (!requirementIdPattern.test(normalized)) throw new ApiError(400, `${fieldName} must use the format REQ-00001.`);
  return normalized;
}

export function formatRequirementId(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\bREQ-(\d{3,})\b/gi, (_match, digits) => `REQ-${digits.padStart(5, '0')}`);
}

// Resolve public, five-digit IDs to the unchanged stored identifier for legacy records.
export async function resolveRequirementId(value, workspaceId) {
  const normalized = normalizeRequirementId(value);
  const wanted = BigInt(normalized.slice(4));
  const candidates = await Requirement.find({ workspaceId, requirementId: /^REQ-\d{3,}$/i }).select('requirementId').lean();
  const matches = candidates.filter(({ requirementId }) => {
    const match = requirementIdPattern.exec(requirementId);
    return match && BigInt(match[1]) === wanted;
  });
  if (matches.length > 1) {
    throw new ApiError(409, `The displayed ID ${formatRequirementId(normalized)} matches multiple stored legacy requirements. Resolve the duplicate numeric suffixes before using this ID.`);
  }
  if (matches.length === 1) return matches[0].requirementId;
  return normalized;
}
