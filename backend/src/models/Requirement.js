import mongoose from 'mongoose';

const requirementSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  requirementId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    match: /^REQ-\d{3,}$/,
  },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 4000 },
  type: { type: String, required: true, enum: ['Functional', 'Non-functional'] },
  priority: { type: String, required: true, enum: ['Low', 'Medium', 'High', 'Critical'] },
  status: { type: String, required: true, enum: ['Draft', 'Approved', 'In Progress', 'Completed'] },
}, { timestamps: true, versionKey: false });

requirementSchema.index({ workspaceId: 1, requirementId: 1 }, { unique: true });

export default mongoose.model('Requirement', requirementSchema);
