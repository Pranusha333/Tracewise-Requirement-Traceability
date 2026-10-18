import mongoose from 'mongoose';

const requirementImpactSchema = new mongoose.Schema({
  requirementId: { type: String, required: true },
  title: { type: String, required: true },
  relationshipType: { type: String, required: true },
  reason: { type: String, required: true },
  level: { type: Number, required: true },
}, { _id: false });

const impactedTestCaseSchema = new mongoose.Schema({
  testCaseId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  requirementIds: { type: [String], default: [] },
  reason: { type: String, required: true },
}, { _id: false });

const graphNodeSchema = new mongoose.Schema({
  requirementId: { type: String, required: true },
  title: { type: String, required: true },
  level: { type: Number, required: true },
}, { _id: false });

const graphEdgeSchema = new mongoose.Schema({
  fromRequirementId: { type: String, required: true },
  toRequirementId: { type: String, required: true },
  relationshipType: { type: String, required: true },
}, { _id: false });

const similarRequirementSchema = new mongoose.Schema({
  requirementId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  reason: { type: String, required: true },
}, { _id: false });

const recommendationSchema = new mongoose.Schema({
  kind: { type: String, required: true },
  title: { type: String, required: true, maxlength: 180 },
  reason: { type: String, required: true, maxlength: 1000 },
  referenceIds: { type: [String], default: [] },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'edited'], default: 'pending' },
}, { timestamps: true });

const assistantResultSchema = new mongoose.Schema({
  source: { type: String, enum: ['fallback', 'openai'], required: true },
  model: { type: String, default: '' },
  fallbackReason: { type: String, default: '' },
  similarityMethod: { type: String, required: true },
  requirementPriority: { type: String, default: '' },
  requirementStatus: { type: String, default: '' },
  summary: { type: String, required: true },
  impactExplanation: { type: String, required: true },
  potentialRisks: { type: [String], default: [] },
  similarRequirements: { type: [similarRequirementSchema], default: [] },
  recommendations: { type: [recommendationSchema], default: [] },
}, { _id: false });

const impactAnalysisSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  requirementId: { type: String, required: true, index: true },
  requirementTitle: { type: String, required: true },
  requirementDescription: { type: String, required: true },
  proposedChange: { type: String, required: true, trim: true, maxlength: 4000 },
  directImpacts: { type: [requirementImpactSchema], default: [] },
  indirectImpacts: { type: [requirementImpactSchema], default: [] },
  affectedTestCases: { type: [impactedTestCaseSchema], default: [] },
  graph: {
    nodes: { type: [graphNodeSchema], default: [] },
    edges: { type: [graphEdgeSchema], default: [] },
  },
  counts: {
    affectedRequirements: { type: Number, required: true },
    affectedTestCases: { type: Number, required: true },
  },
  assistant: { type: assistantResultSchema, default: undefined },
}, { timestamps: true, versionKey: false });

export default mongoose.model('ImpactAnalysis', impactAnalysisSchema);
