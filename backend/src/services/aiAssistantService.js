import ImpactAnalysis from '../models/ImpactAnalysis.js';
import Requirement from '../models/Requirement.js';
import TestCase from '../models/TestCase.js';
import TraceabilityRelationship from '../models/TraceabilityRelationship.js';
import Workspace from '../models/Workspace.js';
import { analyzeImpact } from './impactAnalysisService.js';
import ApiError from '../utils/ApiError.js';
import { formatRequirementId, resolveRequirementId } from '../utils/requirementIds.js';
import { decryptSecret } from '../utils/secretVault.js';

const stopWords = new Set('a an and are as at be been being but by can could did do does for from had has have how i in into is it its may might must of on or our shall should that the their them then there these they this those to was we were what when where which who will with would you your'.split(' '));
const recommendationKinds = ['review_requirement', 'update_test_case', 'add_test_scenario', 'add_relationship', 'missing_coverage', 'possible_overlap', 'improve_description'];

function tokenize(text) {
  return String(text || '').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)?.filter((token) => !stopWords.has(token)) || [];
}

function termCounts(tokens) {
  return tokens.reduce((counts, token) => counts.set(token, (counts.get(token) || 0) + 1), new Map());
}

function vectorize(counts, idf) {
  return new Map([...counts].map(([token, count]) => [token, (1 + Math.log(count)) * (idf.get(token) || 0)]));
}

function cosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const [term, value] of left) {
    leftNorm += value * value;
    dot += value * (right.get(term) || 0);
  }
  for (const value of right.values()) rightNorm += value * value;
  return leftNorm && rightNorm ? dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)) : 0;
}

function findSimilarRequirements(selected, proposedChange, requirements) {
  const candidates = requirements.filter((item) => item.requirementId !== selected.requirementId);
  const queryTokens = tokenize(`${selected.title} ${selected.description} ${proposedChange}`);
  const documents = candidates.map((item) => ({ item, tokens: tokenize(`${item.title} ${item.description}`) }));
  const queryTerms = new Set(queryTokens);
  const documentFrequency = new Map();
  for (const term of queryTerms) documentFrequency.set(term, 1);
  documents.forEach(({ tokens }) => new Set(tokens).forEach((term) => documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1)));
  const documentCount = documents.length + 1;
  const idf = new Map([...documentFrequency].map(([term, frequency]) => [term, Math.log((documentCount + 1) / (frequency + 1)) + 1]));
  const queryVector = vectorize(termCounts(queryTokens), idf);

  return documents.map(({ item, tokens }) => {
    const candidateVector = vectorize(termCounts(tokens), idf);
    const score = cosine(queryVector, candidateVector);
    const sharedTerms = [...candidateVector.keys()]
      .filter((term) => queryTerms.has(term))
      .sort((left, right) => (candidateVector.get(right) || 0) - (candidateVector.get(left) || 0))
      .slice(0, 4);
    return { item, score, sharedTerms };
  })
    .filter(({ score, sharedTerms }) => score >= 0.06 && sharedTerms.length > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ item, score, sharedTerms }) => ({
      requirementId: item.requirementId,
      title: item.title,
      description: item.description,
      score: Math.round(score * 100),
      reason: `Shares project terms: ${sharedTerms.join(', ')}.`,
    }));
}

function makeRecommendations(impact, similarRequirements, coverageGaps) {
  const recommendations = [];
  const affectedRequirements = [...impact.directImpacts, ...impact.indirectImpacts];
  for (const item of affectedRequirements) {
    recommendations.push({
      kind: 'review_requirement',
      title: `Review ${item.requirementId}`,
      reason: item.reason,
      referenceIds: [item.requirementId],
      status: 'pending',
    });
  }
  for (const item of impact.affectedTestCases) {
    recommendations.push({
      kind: 'update_test_case',
      title: `Review test case ${item.testCaseId}`,
      reason: item.reason,
      referenceIds: [item.testCaseId, ...item.requirementIds],
      status: 'pending',
    });
  }
  for (const requirementId of coverageGaps) {
    recommendations.push({
      kind: 'add_test_scenario',
      title: `Add regression scenarios for ${requirementId}`,
      reason: `No test case is linked to ${requirementId}. Define scenarios for the changed behavior and link them to this requirement.`,
      referenceIds: [requirementId],
      status: 'pending',
    });
  }
  if (!impact.graph.edges.length) {
    recommendations.push({
      kind: 'add_relationship',
      title: 'Review missing requirement links',
      reason: `No downstream traceability relationship was found for ${impact.requirementId}. Add relevant links before relying on a complete change impact map.`,
      referenceIds: [impact.requirementId],
      status: 'pending',
    });
  }
  for (const item of similarRequirements.filter((candidate) => candidate.score >= 20)) {
    recommendations.push({
      kind: 'possible_overlap',
      title: `Review possible overlap with ${item.requirementId}`,
      reason: `${item.reason} Compare both requirement statements before treating them as separate behavior.`,
      referenceIds: [item.requirementId],
      status: 'pending',
    });
  }
  if (!/\b(shall|must|will|should)\b/i.test(impact.proposedChange) || impact.proposedChange.trim().length < 30) {
    recommendations.push({
      kind: 'improve_description',
      title: 'Make the change statement testable',
      reason: 'Consider stating the actor, expected behavior, and a measurable success condition in the proposed text.',
      referenceIds: [impact.requirementId],
      status: 'pending',
    });
  }
  return recommendations;
}

function makeFallback(impact, similarRequirements, coverageGaps, providerConfigured) {
  const direct = impact.directImpacts.map((item) => item.requirementId);
  const indirect = impact.indirectImpacts.map((item) => item.requirementId);
  const summary = `The proposed change reaches ${impact.counts.affectedRequirements} other requirement${impact.counts.affectedRequirements === 1 ? '' : 's'} and ${impact.counts.affectedTestCases} linked test case${impact.counts.affectedTestCases === 1 ? '' : 's'}. ${similarRequirements.length} similar requirement${similarRequirements.length === 1 ? '' : 's'} found by local text comparison.`;
  const impactExplanation = [
    `Functional: the proposed change is centered on ${impact.requirementId} (${impact.requirementTitle}).`,
    direct.length ? `Direct relationship paths reach ${direct.join(', ')}.` : 'No direct downstream relationship impacts were found.',
    indirect.length ? `Further dependency traversal reaches ${indirect.join(', ')}.` : 'No indirect dependency impacts were found.',
    impact.affectedTestCases.length ? `Testing: review linked cases ${impact.affectedTestCases.map((item) => item.testCaseId).join(', ')}.` : 'Testing: no linked test cases were found for the selected or affected requirements.',
    'The requirement database does not describe implementation internals, so technical implementation consequences need an owner review.',
  ].join(' ');
  const potentialRisks = [];
  if (impact.counts.affectedRequirements) potentialRisks.push(`${impact.counts.affectedRequirements} connected requirement${impact.counts.affectedRequirements === 1 ? ' may' : 's may'} need coordinated review.`);
  if (coverageGaps.length) potentialRisks.push(`Recorded test coverage is missing for ${coverageGaps.join(', ')}.`);
  if (!impact.graph.edges.length) potentialRisks.push('No linked requirement relationships were found; related impact may be untracked.');
  if (!similarRequirements.length) potentialRisks.push('No similar requirements were found by local text comparison.');
  return {
    source: 'fallback',
    model: '',
    fallbackReason: providerConfigured ? 'The configured AI service was unavailable or returned an invalid response; local analysis was used.' : 'No AI provider key is configured; local text similarity and rule-based explanations are active.',
    similarityMethod: 'Local TF-IDF text similarity',
    summary,
    impactExplanation,
    potentialRisks,
    recommendations: makeRecommendations(impact, similarRequirements, coverageGaps),
  };
}

const assistantSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    impactExplanation: { type: 'string' },
    potentialRisks: { type: 'array', items: { type: 'string' } },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', enum: recommendationKinds },
          title: { type: 'string' },
          reason: { type: 'string' },
          referenceIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['kind', 'title', 'reason', 'referenceIds'],
      },
    },
  },
  required: ['summary', 'impactExplanation', 'potentialRisks', 'recommendations'],
};

function readResponseText(payload) {
  if (payload.status !== 'completed') throw new Error('AI response was incomplete.');
  const parts = [];
  for (const output of payload.output || []) {
    if (output.type !== 'message') continue;
    for (const content of output.content || []) {
      if (content.type === 'refusal') throw new Error('AI response was refused.');
      if (content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  if (!parts.length) throw new Error('AI response contained no output text.');
  return parts.join('\n');
}

function validateAIResult(result, knownIds) {
  if (!result || typeof result.summary !== 'string' || typeof result.impactExplanation !== 'string' || !Array.isArray(result.potentialRisks) || !Array.isArray(result.recommendations)) {
    throw new Error('AI response did not match the expected format.');
  }
  for (const recommendation of result.recommendations) {
    if (!recommendationKinds.includes(recommendation.kind) || typeof recommendation.title !== 'string' || typeof recommendation.reason !== 'string' || !Array.isArray(recommendation.referenceIds)) {
      throw new Error('AI response contained an invalid recommendation.');
    }
    if (recommendation.referenceIds.some((id) => typeof id !== 'string' || !knownIds.has(id.toUpperCase()))) {
      throw new Error('AI response referenced a record that was not supplied.');
    }
  }
  const text = [result.summary, result.impactExplanation, ...result.potentialRisks, ...result.recommendations.flatMap((item) => [item.title, item.reason])].join(' ');
  const referencedIds = text.match(/\b(?:REQ|TC)-\d+\b/gi) || [];
  if (referencedIds.some((id) => !knownIds.has(id.toUpperCase()))) throw new Error('AI response referenced a record that was not supplied.');
  return {
    summary: result.summary.slice(0, 1000),
    impactExplanation: result.impactExplanation.slice(0, 4000),
    potentialRisks: result.potentialRisks.filter((item) => typeof item === 'string').slice(0, 8).map((item) => item.slice(0, 500)),
    recommendations: result.recommendations.slice(0, 12).map((item) => ({
      kind: item.kind,
      title: item.title.slice(0, 180),
      reason: item.reason.slice(0, 1000),
      referenceIds: [...new Set(item.referenceIds.filter((id) => typeof id === 'string' && knownIds.has(id.toUpperCase())).map((id) => id.toUpperCase()))],
      status: 'pending',
    })),
  };
}

async function requestOpenAI(context, knownIds, { apiKey, model }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 1400,
    instructions: 'You explain requirement changes for a traceability system. Use only the requirements, links, tests, and similarity results in the supplied JSON. The application has already calculated direct and indirect impacts; do not add, remove, or reinterpret graph edges. Explain functional consequences, technical consequences only where the records support them, and testing consequences. Do not invent requirement IDs, test-case IDs, relationships, test results, conflicts, or implementation facts. Distinguish evidence from a review suggestion. Return only the requested JSON object.',
      input: JSON.stringify(context),
      text: { format: { type: 'json_schema', name: 'tracewise_ai_analysis', strict: true, schema: assistantSchema } },
    }),
  });
  if (!response.ok) throw new Error(`AI service returned HTTP ${response.status}.`);
  const payload = await response.json();
  const result = validateAIResult(JSON.parse(readResponseText(payload)), knownIds);
  return { ...result, source: 'openai', model, fallbackReason: '' };
}

function makeLocalQuestionAnswer(question, requirements, relationships, testCases) {
  const tokens = new Set(tokenize(question));
  const ranked = requirements.map((item) => {
    const terms = new Set(tokenize(`${item.requirementId} ${item.title} ${item.description} ${item.status} ${item.priority}`));
    const score = [...tokens].reduce((total, term) => total + Number(terms.has(term)), 0);
    return { item, score };
  }).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score || left.item.requirementId.localeCompare(right.item.requirementId));
  const coveredIds = new Set(testCases.flatMap((item) => item.requirementIds));
  const coverageGaps = requirements.filter((item) => !coveredIds.has(item.requirementId));
  const asksForGaps = /\b(uncovered|without tests?|no linked tests?|missing tests?|no test coverage)\b/i.test(question);
  const matched = (asksForGaps ? coverageGaps : ranked.slice(0, 5).map(({ item }) => item)).slice(0, 5);
  const matchedIds = new Set(matched.map((item) => item.requirementId));
  const matchedLinks = relationships.filter((link) => matchedIds.has(link.fromRequirementId) || matchedIds.has(link.toRequirementId)).slice(0, 8);
  const matchedTests = testCases.filter((item) => item.requirementIds.some((id) => matchedIds.has(id))).slice(0, 8);
  const linkedCount = requirements.filter((item) => coveredIds.has(item.requirementId)).length;
  const asksForCount = /\b(how many|count|total|number of)\b/i.test(question);
  const asksForTests = /\b(test|tests|coverage|covered)\b/i.test(question);
  const asksForLinks = /\b(link|links|relationship|relationships|depends|implements)\b/i.test(question);
  const asksForStatus = /\b(status|approved|draft|completed|in progress)\b/i.test(question);
  let answer;
  if (asksForGaps) answer = `${coverageGaps.length} of ${requirements.length} requirements have no linked test case${coverageGaps.length === 1 ? '' : 's'}${coverageGaps.length ? `: ${coverageGaps.slice(0, 5).map((item) => item.requirementId).join(', ')}${coverageGaps.length > 5 ? ', and more' : ''}` : ''}.`;
  else if (asksForCount && asksForTests) answer = `There are ${testCases.length} test cases. They link to ${linkedCount} of ${requirements.length} requirements (${requirements.length ? Math.round(linkedCount / requirements.length * 100) : 0}% requirement coverage).`;
  else if (asksForCount && asksForLinks) answer = `There are ${relationships.length} saved requirement relationships in this workspace.`;
  else if (asksForCount && asksForStatus) {
    const counts = requirements.reduce((result, item) => { result[item.status] = (result[item.status] || 0) + 1; return result; }, {});
    answer = `There are ${requirements.length} requirements: ${Object.entries(counts).map(([status, count]) => `${count} ${status.toLowerCase()}`).join(', ') || 'none recorded'}.`;
  } else if (asksForCount) answer = `There are ${requirements.length} requirements in this workspace.`;
  else if (matched.length) answer = matched.slice(0, 3).map((item) => `${item.requirementId} (${item.title}) is ${item.status.toLowerCase()} with ${item.priority.toLowerCase()} priority.`).join(' ');
  else answer = `I could not find a matching requirement in the ${requirements.length} saved requirements. Try a requirement ID or a phrase from its title.`;

  if (asksForTests && matched.length) answer += matchedTests.length
    ? ` Matching tests include ${matchedTests.map((item) => `${item.testCaseId} (${item.title})`).join(', ')}.`
    : ` No test case is currently linked to the matching requirement${matched.length === 1 ? '' : 's'}.`;
  if (/\b(link|relationship|depends|implements|connected)\b/i.test(question) && matched.length) answer += matchedLinks.length
    ? ` Saved relationships include ${matchedLinks.map((item) => `${item.fromRequirementId} ${item.relationshipType.toLowerCase()} ${item.toRequirementId}`).join('; ')}.`
    : ' No saved relationship touches the matching requirements.';

  const suggestions = matched.filter((item) => !coveredIds.has(item.requirementId)).map((item) => `Consider adding a test case for ${item.requirementId} (${item.title}); no linked test case is recorded.`);
  const similar = matched.length ? findSimilarRequirements(matched[0], question, requirements).slice(0, 3) : [];
  if (similar.length) suggestions.push(`Compare ${similar.map((item) => item.requirementId).join(', ')} with ${matched[0].requirementId}. Text similarity can flag possible overlap, but it does not confirm a conflict.`);
  return { answer, suggestions, matched, matchedLinks, matchedTests };
}

async function requestOpenAIQuestion(question, records, knownIds, { apiKey, model }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      model, store: false, max_output_tokens: 700,
      instructions: 'Answer the user question in beginner-friendly language using only the supplied Tracewise records. Do not invent requirements, links, tests, statuses, or outcomes. Distinguish evidence in the records from suggestions. If the records do not answer the question, say so. Any IDs in your answer or suggestions must appear in the supplied records. Return only the requested JSON object.',
      input: JSON.stringify({ question, records }),
      text: { format: { type: 'json_schema', name: 'tracewise_project_answer', strict: true, schema: { type: 'object', additionalProperties: false, properties: { answer: { type: 'string' }, suggestions: { type: 'array', items: { type: 'string' } } }, required: ['answer', 'suggestions'] } } },
    }),
  });
  if (!response.ok) throw new Error('AI service request failed.');
  const answer = JSON.parse(readResponseText(await response.json()));
  if (typeof answer.answer !== 'string' || !Array.isArray(answer.suggestions) || answer.suggestions.some((item) => typeof item !== 'string')) throw new Error('AI answer had an invalid format.');
  const references = `${answer.answer} ${answer.suggestions.join(' ')}`.match(/\b(?:REQ|TC)-\d+\b/gi) || [];
  if (references.some((id) => !knownIds.has(id.toUpperCase()))) throw new Error('AI answer referenced a record that was not supplied.');
  return { answer: answer.answer.slice(0, 2500), suggestions: answer.suggestions.slice(0, 5).map((item) => item.slice(0, 500)) };
}

export async function answerProjectQuestion(input, workspaceId) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.question !== 'string' || !input.question.trim() || input.question.trim().length > 1200) {
    throw new ApiError(400, 'Enter a question of 1 to 1200 characters.');
  }
  const question = input.question.trim();
  const [requirements, relationships, testCases, aiWorkspace] = await Promise.all([
    Requirement.find({ workspaceId }).select('requirementId title description priority status').lean(),
    TraceabilityRelationship.find({ workspaceId }).select('fromRequirementId toRequirementId relationshipType').lean(),
    TestCase.find({ workspaceId }).select('testCaseId title requirementIds').lean(),
    Workspace.findById(workspaceId).select('+aiKeyEncrypted aiModel').lean(),
  ]);
  const local = makeLocalQuestionAnswer(question, requirements, relationships, testCases);
  const formatRecord = (record) => ({ ...record, ...(record.requirementId ? { requirementId: formatRequirementId(record.requirementId) } : {}), ...(record.fromRequirementId ? { fromRequirementId: formatRequirementId(record.fromRequirementId) } : {}), ...(record.toRequirementId ? { toRequirementId: formatRequirementId(record.toRequirementId) } : {}), ...(record.requirementIds ? { requirementIds: record.requirementIds.map(formatRequirementId) } : {}) });
  const evidence = {
    requirements: local.matched.map(formatRecord),
    relationships: local.matchedLinks.map(formatRecord),
    testCases: local.matchedTests.map(formatRecord),
    coverage: { linkedRequirements: requirements.filter((item) => testCases.some((testCase) => testCase.requirementIds.includes(item.requirementId))).length, totalRequirements: requirements.length, totalTestCases: testCases.length },
  };
  const apiKey = process.env.OPENAI_API_KEY?.trim() || decryptSecret(aiWorkspace?.aiKeyEncrypted);
  const model = aiWorkspace?.aiModel || process.env.OPENAI_MODEL || 'gpt-6-astra';
  let result = { answer: local.answer, suggestions: local.suggestions, source: 'local', model: '', fallbackReason: apiKey ? 'The configured provider was unavailable or its answer did not pass validation; a local record-based answer is shown.' : 'No provider key is configured; this answer uses saved workspace records and local text matching.' };
  if (apiKey) {
    const knownIds = new Set([...requirements.map((item) => formatRequirementId(item.requirementId)), ...testCases.map((item) => item.testCaseId)]);
    try {
      const providerAnswer = await requestOpenAIQuestion(question, evidence, knownIds, { apiKey, model });
      result = { ...providerAnswer, source: 'openai', model, fallbackReason: '' };
    } catch {
      console.warn('AI question response was unavailable or failed record validation; using local workspace results.');
    }
  }
  return { question, ...result, evidence };
}

export async function analyzeAssistant(input, workspaceId) {
  const impact = await analyzeImpact(input, workspaceId);
  const [selectedRequirement, requirements, testCases] = await Promise.all([
    Requirement.findOne({ requirementId: impact.requirementId, workspaceId }).lean(),
    Requirement.find({ workspaceId }).select('requirementId title description').lean(),
    TestCase.find({ workspaceId }).select('testCaseId title description requirementIds').lean(),
  ]);
  if (!selectedRequirement) throw new ApiError(404, `Requirement ${impact.requirementId} was not found.`);

  const similarRequirements = findSimilarRequirements(selectedRequirement, impact.proposedChange, requirements);
  const relevantRequirementIds = [impact.requirementId, ...impact.directImpacts.map((item) => item.requirementId), ...impact.indirectImpacts.map((item) => item.requirementId)];
  const coveredIds = new Set(testCases.flatMap((item) => item.requirementIds));
  const coverageGaps = relevantRequirementIds.filter((id) => !coveredIds.has(id));
  const knownIds = new Set([
    ...relevantRequirementIds,
    ...similarRequirements.map((item) => item.requirementId),
    ...impact.affectedTestCases.map((item) => item.testCaseId),
  ]);

  const aiWorkspace = await Workspace.findById(workspaceId).select('+aiKeyEncrypted aiModel').lean();
  const apiKey = process.env.OPENAI_API_KEY?.trim() || decryptSecret(aiWorkspace?.aiKeyEncrypted);
  const model = aiWorkspace?.aiModel || process.env.OPENAI_MODEL || 'gpt-6-astra';
  const fallback = makeFallback(impact, similarRequirements, coverageGaps, Boolean(apiKey));
  const context = {
    requirement: {
      id: selectedRequirement.requirementId,
      title: selectedRequirement.title,
      description: selectedRequirement.description,
      priority: selectedRequirement.priority,
      status: selectedRequirement.status,
    },
    proposedChange: impact.proposedChange,
    similarRequirements,
    directImpacts: impact.directImpacts,
    indirectImpacts: impact.indirectImpacts,
    affectedTestCases: impact.affectedTestCases,
    traceabilityLinks: impact.graph.edges,
    missingTestCoverageRequirementIds: coverageGaps,
  };

  let assistant = fallback;
  if (apiKey) {
    try { assistant = await requestOpenAI(context, knownIds, { apiKey, model }); }
    catch (error) {
      console.warn('OpenAI analysis failed; using validated local fallback.', error.message);
    }
  }
  assistant = {
    ...assistant,
    requirementPriority: selectedRequirement.priority,
    requirementStatus: selectedRequirement.status,
    similarityMethod: fallback.similarityMethod,
    similarRequirements,
  };
  return { ...impact, assistant };
}

export async function saveAssistantAnalysis(input, workspaceId) {
  if (!input?.assistant || typeof input.assistant !== 'object' || Array.isArray(input.assistant)) {
    throw new ApiError(400, 'The assistant analysis result is missing. Run the analysis before saving it.');
  }
  const impact = await analyzeImpact(input, workspaceId);
  const [selectedRequirement, requirements] = await Promise.all([
    Requirement.findOne({ requirementId: impact.requirementId, workspaceId }).lean(),
    Requirement.find({ workspaceId }).select('requirementId title description').lean(),
  ]);
  if (!selectedRequirement) throw new ApiError(404, `Requirement ${impact.requirementId} was not found.`);
  const similarRequirements = findSimilarRequirements(selectedRequirement, impact.proposedChange, requirements);
  const knownIds = new Set([
    impact.requirementId,
    ...impact.directImpacts.map((item) => item.requirementId),
    ...impact.indirectImpacts.map((item) => item.requirementId),
    ...impact.affectedTestCases.map((item) => item.testCaseId),
    ...similarRequirements.map((item) => item.requirementId),
  ]);
  const assistantInput = input.assistant;
  const validated = validateAIResult({
    summary: assistantInput.summary,
    impactExplanation: assistantInput.impactExplanation,
    potentialRisks: assistantInput.potentialRisks,
    recommendations: assistantInput.recommendations,
  }, knownIds);
  if (!['fallback', 'openai'].includes(assistantInput.source)) throw new ApiError(400, 'Analysis source must be fallback or openai.');
  const recommendations = validated.recommendations.map((recommendation, index) => {
    const requestedStatus = assistantInput.recommendations[index]?.status || 'pending';
    if (!['pending', 'accepted', 'rejected', 'edited'].includes(requestedStatus)) throw new ApiError(400, 'A recommendation has an invalid review status.');
    return { ...recommendation, status: requestedStatus };
  });
  const assistant = {
    ...validated,
    recommendations,
    source: assistantInput.source,
    model: typeof assistantInput.model === 'string' ? assistantInput.model.slice(0, 120) : '',
    fallbackReason: typeof assistantInput.fallbackReason === 'string' ? assistantInput.fallbackReason.slice(0, 500) : '',
    similarityMethod: 'Local TF-IDF text similarity',
    requirementPriority: selectedRequirement.priority,
    requirementStatus: selectedRequirement.status,
    similarRequirements,
  };
  return ImpactAnalysis.create({ ...impact, workspaceId, assistant });
}

export async function listAssistantAnalyses(requirementId, workspaceId) {
  const filter = { workspaceId, assistant: { $exists: true } };
  if (requirementId) filter.requirementId = await resolveRequirementId(requirementId, workspaceId);
  return ImpactAnalysis.find(filter).sort({ createdAt: -1 }).limit(30).lean();
}

export async function getAssistantAnalysis(id, workspaceId) {
  const analysis = await ImpactAnalysis.findOne({ _id: id, workspaceId, assistant: { $exists: true } }).lean();
  if (!analysis) throw new ApiError(404, 'The saved AI Assistant analysis was not found.');
  return analysis;
}

export async function updateRecommendation(id, recommendationId, input, workspaceId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Request body must be a JSON object.');
  const allowedStatuses = ['accepted', 'rejected', 'edited', 'pending'];
  if (input.status !== undefined && !allowedStatuses.includes(input.status)) throw new ApiError(400, `status must be one of: ${allowedStatuses.join(', ')}.`);
  if (input.title !== undefined && (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 180)) throw new ApiError(400, 'Recommendation title must be between 1 and 180 characters.');
  if (input.reason !== undefined && (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 1000)) throw new ApiError(400, 'Recommendation reason must be between 1 and 1000 characters.');
  const analysis = await ImpactAnalysis.findOne({ _id: id, workspaceId, assistant: { $exists: true } });
  if (!analysis) throw new ApiError(404, 'The saved AI Assistant analysis was not found.');
  const recommendation = analysis.assistant.recommendations.id(recommendationId);
  if (!recommendation) throw new ApiError(404, 'The recommendation was not found.');
  if (input.status) recommendation.status = input.status;
  if (input.title !== undefined) recommendation.title = input.title.trim();
  if (input.reason !== undefined) recommendation.reason = input.reason.trim();
  if ((input.title !== undefined || input.reason !== undefined) && input.status === undefined) recommendation.status = 'edited';
  await analysis.save();
  return analysis;
}
