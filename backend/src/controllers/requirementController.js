import * as requirementService from '../services/requirementService.js';

export async function getRequirements(request, response) {
  const requirements = await requirementService.listRequirements(request.user.workspaceId);
  response.json({ requirements });
}

export async function getRequirement(request, response) {
  const requirement = await requirementService.getRequirement(request.params.id, request.user.workspaceId);
  response.json({ requirement });
}

export async function createRequirement(request, response) {
  const requirement = await requirementService.createRequirement(request.body, request.user.workspaceId);
  response.status(201).json({ requirement });
}

export async function updateRequirement(request, response) {
  const requirement = await requirementService.updateRequirement(request.params.id, request.body, request.user.workspaceId);
  response.json({ requirement });
}

export async function deleteRequirement(request, response) {
  const requirement = await requirementService.deleteRequirement(request.params.id, request.user.workspaceId);
  response.json({ message: `${requirement.requirementId} was deleted.`, requirementId: requirement.requirementId });
}
