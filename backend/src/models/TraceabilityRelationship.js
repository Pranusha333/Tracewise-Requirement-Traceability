import mongoose from 'mongoose';

const relationshipSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  fromRequirementId: { type: String, required: true, trim: true, uppercase: true },
  toRequirementId: { type: String, required: true, trim: true, uppercase: true },
  relationshipType: { type: String, required: true, enum: ['Depends On', 'Related To', 'Implements'] },
}, { timestamps: true, versionKey: false });

relationshipSchema.index({ workspaceId: 1, fromRequirementId: 1, toRequirementId: 1 }, { unique: true });

export default mongoose.model('TraceabilityRelationship', relationshipSchema);
