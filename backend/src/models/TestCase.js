import mongoose from 'mongoose';

const testCaseSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  testCaseId: { type: String, required: true, trim: true, uppercase: true, match: /^TC-\d{3,}$/ },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 4000 },
  requirementIds: { type: [{ type: String, trim: true, uppercase: true }], required: true, default: [] },
}, { timestamps: true, versionKey: false });

testCaseSchema.index({ workspaceId: 1, testCaseId: 1 }, { unique: true });

export default mongoose.model('TestCase', testCaseSchema);
