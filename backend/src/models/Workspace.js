import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema({
  key: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', trim: true, maxlength: 1000 },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  inviteCode: { type: String, required: true, unique: true, select: false },
  preferences: {
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'dark' },
    notifications: { type: Boolean, default: true },
    compactMode: { type: Boolean, default: false },
  },
  aiModel: { type: String, default: 'gpt-6-astra', maxlength: 120 },
  aiKeyEncrypted: { type: String, select: false },
}, { timestamps: true, versionKey: false });

export default mongoose.model('Workspace', workspaceSchema);
